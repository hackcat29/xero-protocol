// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {RiskGuardian} from "../src/RiskGuardian.sol";
import {CorporateActionEngine} from "../src/CorporateActionEngine.sol";
import {ICorporateActionEngine} from "../src/interfaces/ICorporateActionEngine.sol";
import {IRiskGuardian} from "../src/interfaces/IRiskGuardian.sol";
import {IStockToken} from "../src/interfaces/IScaledUIAmount.sol";
import {IXeroMath} from "../src/interfaces/IXeroMath.sol";
import {IXeroOracle} from "../src/interfaces/IXeroOracle.sol";
import {XeroFactory} from "../src/XeroFactory.sol";
import {XeroVault} from "../src/XeroVault.sol";
import {XeroMathSol} from "../src/math/XeroMathSol.sol";
import {XeroOracle, IAggregatorV3} from "../src/oracle/XeroOracle.sol";
import {YieldMarketFactory, IVaultRegistry} from "../src/market/YieldMarketFactory.sol";
import {CurveLens, IXeroFactoryView, IYieldMarketFactoryView} from "../src/market/CurveLens.sol";
import {XeroRouter, IVaultRegistryView} from "../src/periphery/XeroRouter.sol";

/// @notice Production deployment for Robinhood Chain (or any chain with ERC-8056 Stock Tokens).
///
/// Flow: preflight the config against live contracts -> deploy -> configure with the deployer as a
/// temporary admin -> create vaults and (uninitialised) markets -> hand every admin power to a
/// TimelockController run by the governance Safe, the pause role to the guardian Safe -> renounce
/// all deployer roles -> assert post-conditions -> write the address book and the Safe batch that
/// completes the two-step ownership transfers.
///
///   XERO_CONFIG=../deploy/robinhood-mainnet.json forge script script/DeployProduction.s.sol \
///     --rpc-url $ROBINHOOD_RPC_URL --broadcast --slow --verify --account deployer
///
/// Rehearsal on a local fork (fills missing governance addresses with throwaway keys):
///   anvil --fork-url https://rpc.mainnet.chain.robinhood.com
///   XERO_REHEARSAL=true forge script script/DeployProduction.s.sol --rpc-url http://127.0.0.1:8545 \
///     --broadcast --slow --private-key <anvil key>
contract DeployProduction is Script {
    uint256 internal constant WAD = 1e18;

    string internal json;
    bool internal rehearsal;
    address internal deployer;

    address internal safe;
    address internal guardianSafe;
    address internal treasury;
    uint256 internal delay;
    address[] internal reporters;
    uint8 internal quorum;

    address[] internal tokens;
    address[] internal feeds;
    uint256[] internal yields;
    string[] internal labels;
    uint256[] internal maturities;

    TimelockController internal timelock;
    RiskGuardian internal guardian;
    CorporateActionEngine internal engine;
    XeroFactory internal factory;
    IXeroMath internal math;
    YieldMarketFactory internal markets;
    XeroOracle internal oracle;
    CurveLens internal lens;
    XeroRouter internal router;
    address[] internal vaults;
    address[] internal pools;

    function run() external {
        json = vm.readFile(vm.envOr("XERO_CONFIG", string("../deploy/robinhood-mainnet.json")));
        rehearsal = vm.envOr("XERO_REHEARSAL", false);
        _loadConfig();
        _preflight();

        vm.startBroadcast();
        deployer = msg.sender;
        _deployCore();
        _configure();
        _createMarkets();
        _handOff();
        vm.stopBroadcast();

        _assertPostConditions();
        _writeOutputs();
    }

    // ================================================================ config

    function _loadConfig() internal {
        require(block.chainid == vm.parseJsonUint(json, ".chainId"), "config chainId != connected chain");
        safe = vm.parseJsonAddress(json, ".governance.safe");
        guardianSafe = vm.parseJsonAddress(json, ".governance.guardianSafe");
        treasury = vm.parseJsonAddress(json, ".governance.treasury");
        delay = vm.parseJsonUint(json, ".governance.timelockDelay");
        reporters = vm.parseJsonAddressArray(json, ".reporters.addresses");
        quorum = uint8(vm.parseJsonUint(json, ".reporters.quorum"));
        tokens = vm.parseJsonAddressArray(json, ".assets.tokens");
        feeds = vm.parseJsonAddressArray(json, ".assets.feeds");
        yields = vm.parseJsonUintArray(json, ".assets.openingYieldsWad");
        labels = vm.parseJsonStringArray(json, ".maturities.labels");
        maturities = vm.parseJsonUintArray(json, ".maturities.timestamps");

        if (rehearsal) {
            console2.log("REHEARSAL: substituting throwaway governance and reporter addresses");
            if (safe == address(0)) safe = vm.addr(0xA11CE);
            if (guardianSafe == address(0)) guardianSafe = vm.addr(0xB0B);
            if (treasury == address(0)) treasury = vm.addr(0xCAFE);
            while (reporters.length < quorum) reporters.push(vm.addr(0x5EED + reporters.length));
        }
        require(safe != address(0) && guardianSafe != address(0) && treasury != address(0), "governance unset");
        require(quorum > 0 && reporters.length >= quorum, "need >= quorum reporters");
        require(delay >= 1 days || rehearsal, "timelock delay < 1 day");
        require(tokens.length == feeds.length && tokens.length == yields.length, "asset arrays mismatch");
        require(labels.length == maturities.length, "maturity arrays mismatch");
    }

    /// @dev Verifies every external dependency before a single transaction is sent.
    function _preflight() internal view {
        address usdg = vm.parseJsonAddress(json, ".usdg");
        require(IERC20Metadata(usdg).decimals() == 6, "USDG decimals");
        for (uint256 i; i < tokens.length; ++i) {
            IStockToken t = IStockToken(tokens[i]);
            string memory sym = vm.parseJsonString(json, string.concat(".assets.symbols[", vm.toString(i), "]"));
            require(keccak256(bytes(IERC20Metadata(address(t)).symbol())) == keccak256(bytes(sym)), "symbol mismatch");
            require(IERC20Metadata(address(t)).decimals() == 18, "token decimals");
            require(t.uiMultiplier() > 0, "uiMultiplier");
            require(!t.oraclePaused(), "token in corporate action");
            if (feeds[i] != address(0)) {
                (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(feeds[i]).latestRoundData();
                require(answer > 0 && updatedAt > 0, "feed unhealthy");
            } else {
                console2.log("WARN no Chainlink feed for", sym);
            }
            require(yields[i] > 0 && yields[i] < 0.5e18, "opening yield out of range");
        }
        for (uint256 j; j < maturities.length; ++j) {
            require(maturities[j] > block.timestamp + 30 days, "maturity too close");
        }
    }

    // ================================================================ deployment

    function _deployCore() internal {
        guardian = new RiskGuardian(deployer);
        engine = new CorporateActionEngine(deployer, IRiskGuardian(address(guardian)), quorum);
        factory = new XeroFactory(
            deployer,
            IERC20(vm.parseJsonAddress(json, ".usdg")),
            ICorporateActionEngine(address(engine)),
            IRiskGuardian(address(guardian)),
            treasury
        );
        address mathAddr = vm.parseJsonAddress(json, ".xeroMath");
        math = mathAddr == address(0) ? IXeroMath(address(new XeroMathSol())) : IXeroMath(mathAddr);
        markets = new YieldMarketFactory(deployer, IVaultRegistry(address(factory)), IRiskGuardian(address(guardian)), math);
        oracle = new XeroOracle(deployer, uint32(vm.parseJsonUint(json, ".oracle.defaultMaxAge")));
        lens = new CurveLens(
            IXeroFactoryView(address(factory)), IYieldMarketFactoryView(address(markets)), IXeroOracle(address(oracle)), math
        );
        router = new XeroRouter(IVaultRegistryView(address(factory)));

        address[] memory proposers = new address[](1);
        proposers[0] = safe;
        timelock = new TimelockController(delay, proposers, proposers, address(0));
    }

    function _configure() internal {
        guardian.grantRole(guardian.ENGINE_ROLE(), address(engine));
        for (uint256 i; i < reporters.length; ++i) engine.grantRole(engine.REPORTER_ROLE(), reporters[i]);
        factory.setFees(
            uint16(vm.parseJsonUint(json, ".fees.stripBps")),
            uint16(vm.parseJsonUint(json, ".fees.redeemBps")),
            uint16(vm.parseJsonUint(json, ".fees.yieldBps")),
            vm.parseJsonUint(json, ".fees.marketCreationFee")
        );
        for (uint256 i; i < tokens.length; ++i) {
            guardian.setAssetAllowed(tokens[i], true);
            if (feeds[i] != address(0)) oracle.configureAsset(tokens[i], IAggregatorV3(feeds[i]), 0);
        }
    }

    function _createMarkets() internal {
        uint256 fee = vm.parseJsonUint(json, ".market.fee");
        uint256 numerator = vm.parseJsonUint(json, ".market.scalarNumerator");
        for (uint256 i; i < tokens.length; ++i) {
            for (uint256 j; j < maturities.length; ++j) {
                XeroVault v = XeroVault(factory.createVault(tokens[i], uint64(maturities[j]), labels[j], 0));
                uint256 rate = yields[i] * WAD / v.dividendIndex();
                uint256 refPrice = rate * (maturities[j] - block.timestamp) / 365 days;
                address pool = markets.createPool(address(v), refPrice, int256(numerator / rate), fee);
                vaults.push(address(v));
                pools.push(pool);
            }
        }
    }

    /// @dev Every admin power goes to the timelock (run by the governance Safe); emergency pause to the
    ///      guardian Safe. The deployer keeps nothing except being creator of the uninitialised markets.
    function _handOff() internal {
        bytes32 admin = 0x00;
        guardian.grantRole(admin, address(timelock));
        guardian.grantRole(guardian.GUARDIAN_ROLE(), guardianSafe);
        guardian.renounceRole(guardian.GUARDIAN_ROLE(), deployer);
        guardian.renounceRole(admin, deployer);

        engine.grantRole(admin, address(timelock));
        engine.renounceRole(admin, deployer);

        oracle.grantRole(admin, address(timelock));
        oracle.renounceRole(admin, deployer);

        factory.transferOwnership(address(timelock));
        markets.transferOwnership(address(timelock));
    }

    function _assertPostConditions() internal view {
        bytes32 admin = 0x00;
        require(guardian.hasRole(admin, address(timelock)) && !guardian.hasRole(admin, deployer), "guardian admin");
        require(guardian.hasRole(guardian.GUARDIAN_ROLE(), guardianSafe), "guardian role");
        require(!guardian.hasRole(guardian.GUARDIAN_ROLE(), deployer), "deployer still guardian");
        require(engine.hasRole(admin, address(timelock)) && !engine.hasRole(admin, deployer), "engine admin");
        require(!engine.hasRole(engine.REPORTER_ROLE(), deployer), "deployer is reporter");
        require(oracle.hasRole(admin, address(timelock)) && !oracle.hasRole(admin, deployer), "oracle admin");
        require(factory.pendingOwner() == address(timelock), "factory pending owner");
        require(markets.pendingOwner() == address(timelock), "markets pending owner");
        require(timelock.getMinDelay() == delay, "timelock delay");
        for (uint256 i; i < vaults.length; ++i) require(XeroVault(vaults[i]).invariantHolds(), "vault invariant");
        console2.log("post-conditions OK:", vaults.length, "vaults and markets");
    }

    // ================================================================ outputs

    function _writeOutputs() internal {
        string memory k = "book";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "startBlock", block.number);
        vm.serializeAddress(k, "deployer", deployer);
        vm.serializeAddress(k, "usdg", vm.parseJsonAddress(json, ".usdg"));
        vm.serializeAddress(k, "timelock", address(timelock));
        vm.serializeAddress(k, "safe", safe);
        vm.serializeAddress(k, "guardianSafe", guardianSafe);
        vm.serializeAddress(k, "guardian", address(guardian));
        vm.serializeAddress(k, "engine", address(engine));
        vm.serializeAddress(k, "factory", address(factory));
        vm.serializeAddress(k, "math", address(math));
        vm.serializeAddress(k, "markets", address(markets));
        vm.serializeAddress(k, "oracle", address(oracle));
        vm.serializeAddress(k, "lens", address(lens));
        vm.serializeAddress(k, "router", address(router));
        vm.serializeAddress(k, "vaults", vaults);
        vm.serializeAddress(k, "pools", pools);
        vm.serializeAddress(k, "feeds", feeds);
        string memory book = vm.serializeAddress(k, "stocks", tokens);
        // Rehearsals write to a separate file and never touch the app's address books.
        string memory id = rehearsal ? string.concat("rehearsal-", vm.toString(block.chainid)) : vm.toString(block.chainid);
        vm.writeJson(book, string.concat("../deploy/out/", id, ".json"));
        if (!rehearsal) vm.writeJson(book, string.concat("../app/src/deployments/", id, ".json"));

        // Safe Transaction Builder batch: schedule, then (after the delay) execute acceptOwnership x2.
        address[] memory targets = new address[](2);
        targets[0] = address(factory);
        targets[1] = address(markets);
        uint256[] memory values = new uint256[](2);
        bytes[] memory payloads = new bytes[](2);
        payloads[0] = abi.encodeCall(Ownable2Step.acceptOwnership, ());
        payloads[1] = payloads[0];
        bytes32 salt = keccak256("xero.acceptOwnership.v1");
        bytes memory schedule =
            abi.encodeCall(TimelockController.scheduleBatch, (targets, values, payloads, bytes32(0), salt, delay));
        bytes memory execute = abi.encodeCall(TimelockController.executeBatch, (targets, values, payloads, bytes32(0), salt));

        string memory s1 = "s1";
        vm.serializeAddress(s1, "to", address(timelock));
        vm.serializeString(s1, "value", "0");
        string memory tx1 = vm.serializeBytes(s1, "data", schedule);
        string memory s2 = "s2";
        vm.serializeAddress(s2, "to", address(timelock));
        vm.serializeString(s2, "value", "0");
        string memory tx2 = vm.serializeBytes(s2, "data", execute);
        string memory b = "batch";
        vm.serializeString(b, "version", "1.0");
        vm.serializeString(b, "chainId", vm.toString(block.chainid));
        vm.serializeString(b, "note", "Run 'schedule' now and 'execute' after the timelock delay.");
        vm.serializeString(b, "schedule", tx1);
        string memory out = vm.serializeString(b, "execute", tx2);
        vm.writeJson(out, string.concat("../deploy/out/", id, "-safe-accept-ownership.json"));
        console2.log("address book: deploy/out/<chainId>.json; Safe batch: deploy/out/<chainId>-safe-accept-ownership.json");
    }
}
