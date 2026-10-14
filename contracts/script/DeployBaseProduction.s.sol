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
import {IScaledUIAmount} from "../src/interfaces/IScaledUIAmount.sol";
import {IXeroMath} from "../src/interfaces/IXeroMath.sol";
import {IXeroOracle} from "../src/interfaces/IXeroOracle.sol";
import {XeroFactory} from "../src/XeroFactory.sol";
import {XeroVault} from "../src/XeroVault.sol";
import {XeroMathSol} from "../src/math/XeroMathSol.sol";
import {XeroOracle, IAggregatorV3} from "../src/oracle/XeroOracle.sol";
import {YieldMarketFactory, IVaultRegistry} from "../src/market/YieldMarketFactory.sol";
import {CurveLens, IXeroFactoryView, IYieldMarketFactoryView} from "../src/market/CurveLens.sol";
import {XeroRouter, IVaultRegistryView} from "../src/periphery/XeroRouter.sol";
import {BaseB20YieldLens} from "../src/lens/BaseB20YieldLens.sol";

/// @notice Production deployment script for Xero Protocol on Base (Mainnet 8453 or Base fork).
///
/// Workflow:
/// 1. Preflight verifies all live B20 stock contracts, Chainlink price feeds, and governance multi-sigs.
/// 2. Deploys core contracts + BaseB20YieldLens.
/// 3. Creates time-bound vaults and AMM market pools.
/// 4. Hands off all governance to TimelockController (governed by Gnosis Safe).
/// 5. Generates Safe Transaction Builder JSON for 2-step acceptOwnership.
contract DeployBaseProduction is Script {
    uint256 internal constant WAD = 1e18;

    string internal json;
    bool internal rehearsal;
    address internal deployer;

    address internal usdc;
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
    uint256[] internal durationSecs;

    TimelockController internal timelock;
    RiskGuardian internal guardian;
    CorporateActionEngine internal engine;
    XeroFactory internal factory;
    IXeroMath internal math;
    YieldMarketFactory internal markets;
    XeroOracle internal oracle;
    CurveLens internal lens;
    XeroRouter internal router;
    BaseB20YieldLens internal baseLens;

    address[] internal vaults;
    address[] internal pools;

    function run() external {
        json = vm.readFile(vm.envOr("XERO_CONFIG", string("../deploy/base-mainnet.json")));
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

    function _loadConfig() internal {
        require(block.chainid == vm.parseJsonUint(json, ".chainId"), "config chainId != connected chain");
        usdc = vm.parseJsonAddress(json, ".usdc");
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
        durationSecs = vm.parseJsonUintArray(json, ".maturities.durationsSeconds");

        if (rehearsal) {
            if (safe == address(0)) safe = address(0x1111111111111111111111111111111111111111);
            if (guardianSafe == address(0)) guardianSafe = address(0x2222222222222222222222222222222222222222);
            if (treasury == address(0)) treasury = address(0x3333333333333333333333333333333333333333);
            if (reporters.length == 0) {
                reporters = new address[](2);
                reporters[0] = address(0x4444444444444444444444444444444444444444);
                reporters[1] = address(0x5555555555555555555555555555555555555555);
            }
        }
    }

    function _preflight() internal view {
        require(safe != address(0) && guardianSafe != address(0) && treasury != address(0), "governance address zero");
        require(reporters.length >= quorum && quorum > 0, "reporter quorum invalid");
        require(tokens.length == feeds.length && tokens.length == yields.length, "asset configs length mismatch");
        require(labels.length == durationSecs.length, "maturities length mismatch");

        // Verify USDC
        require(IERC20(usdc).totalSupply() > 0, "USDC token uninitialized");

        // Verify tokens on live chain
        for (uint256 i = 0; i < tokens.length; ++i) {
            require(tokens[i] != address(0), "token address zero");
            require(IERC20(tokens[i]).totalSupply() > 0, "token total supply zero");
            if (feeds[i] != address(0)) {
                (, int256 price,,,) = IAggregatorV3(feeds[i]).latestRoundData();
                require(price > 0, "feed price non-positive");
            }
        }
        console2.log("Preflight passed for Base Chain:", block.chainid);
    }

    function _deployCore() internal {
        address[] memory proposers = new address[](1);
        proposers[0] = safe;
        address[] memory executors = new address[](1);
        executors[0] = safe;

        timelock = new TimelockController(delay, proposers, executors, address(0));
        guardian = new RiskGuardian(deployer);
        engine = new CorporateActionEngine(deployer, IRiskGuardian(address(guardian)), quorum);
        factory = new XeroFactory(
            deployer,
            IERC20(usdc),
            ICorporateActionEngine(address(engine)),
            IRiskGuardian(address(guardian)),
            treasury
        );

        address mathAddr = vm.envOr("XERO_MATH", address(0));
        math = mathAddr == address(0) ? IXeroMath(address(new XeroMathSol())) : IXeroMath(mathAddr);

        markets = new YieldMarketFactory(
            deployer,
            IVaultRegistry(address(factory)),
            IRiskGuardian(address(guardian)),
            math
        );

        uint32 maxAge = uint32(vm.parseJsonUint(json, ".oracle.defaultMaxAge"));
        oracle = new XeroOracle(deployer, maxAge);
        lens = new CurveLens(
            IXeroFactoryView(address(factory)),
            IYieldMarketFactoryView(address(markets)),
            IXeroOracle(address(oracle)),
            math
        );
        router = new XeroRouter(IVaultRegistryView(address(factory)));
        baseLens = new BaseB20YieldLens(IXeroOracle(address(oracle)));
    }

    function _configure() internal {
        guardian.grantRole(guardian.ENGINE_ROLE(), address(engine));
        for (uint256 i = 0; i < reporters.length; ++i) {
            engine.grantRole(engine.REPORTER_ROLE(), reporters[i]);
        }

        uint16 stripBps = uint16(vm.parseJsonUint(json, ".fees.stripBps"));
        uint16 redeemBps = uint16(vm.parseJsonUint(json, ".fees.redeemBps"));
        uint16 yieldBps = uint16(vm.parseJsonUint(json, ".fees.yieldBps"));
        uint256 creationFee = vm.parseJsonUint(json, ".fees.marketCreationFee");
        factory.setFees(stripBps, redeemBps, yieldBps, creationFee);

        // Configure feeds in Oracle & allow assets in Guardian
        for (uint256 i = 0; i < tokens.length; ++i) {
            guardian.setAssetAllowed(tokens[i], true);
            if (feeds[i] != address(0)) {
                oracle.configureAsset(tokens[i], IAggregatorV3(feeds[i]), 0);
            }
        }
    }

    function _createMarkets() internal {
        uint256 fee = vm.parseJsonUint(json, ".market.fee");
        uint256 numerator = vm.parseJsonUint(json, ".market.scalarNumerator");
        uint256 nowTs = block.timestamp;

        for (uint256 i = 0; i < tokens.length; ++i) {
            _createTenorsForAsset(tokens[i], yields[i], nowTs, numerator, fee);
        }
    }

    function _createTenorsForAsset(
        address token,
        uint256 openingYield,
        uint256 nowTs,
        uint256 numerator,
        uint256 fee
    ) internal {
        for (uint256 j = 0; j < labels.length; ++j) {
            uint64 maturity = uint64(nowTs + durationSecs[j]);
            XeroVault v = XeroVault(factory.createVault(token, maturity, labels[j], 0));
            vaults.push(address(v));

            uint256 y = openingYield > 0 ? openingYield : 0.03e18;
            uint256 rate = (y * WAD) / v.dividendIndex();
            uint256 refPrice = (rate * (maturity - nowTs)) / 365 days;
            int256 scalar = int256(numerator / (rate > 0 ? rate : 1e16));

            pools.push(markets.createPool(address(v), refPrice, scalar, fee));
        }
    }

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
        require(!guardian.hasRole(guardian.GUARDIAN_ROLE(), deployer), "deployer is guardian");
        require(engine.hasRole(admin, address(timelock)) && !engine.hasRole(admin, deployer), "engine admin");
        require(oracle.hasRole(admin, address(timelock)) && !oracle.hasRole(admin, deployer), "oracle admin");
        require(factory.pendingOwner() == address(timelock), "factory pending owner");
        require(markets.pendingOwner() == address(timelock), "markets pending owner");
        require(timelock.getMinDelay() == delay, "timelock delay");

        for (uint256 i = 0; i < vaults.length; ++i) {
            require(XeroVault(vaults[i]).invariantHolds(), "vault invariant fail");
        }
        console2.log("Post-conditions verified for all", vaults.length, "Base vaults & markets");
    }

    function _writeOutputs() internal {
        string memory k = "book";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "startBlock", block.number);
        vm.serializeAddress(k, "deployer", deployer);
        vm.serializeAddress(k, "usdc", usdc);
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
        vm.serializeAddress(k, "baseLens", address(baseLens));
        vm.serializeAddress(k, "router", address(router));
        vm.serializeAddress(k, "vaults", vaults);
        vm.serializeAddress(k, "pools", pools);
        vm.serializeAddress(k, "feeds", feeds);
        string memory book = vm.serializeAddress(k, "stocks", tokens);

        string memory id = rehearsal ? string.concat("rehearsal-base-", vm.toString(block.chainid)) : vm.toString(block.chainid);
        vm.writeJson(book, string.concat("../deploy/out/", id, ".json"));
        if (!rehearsal) {
            vm.writeJson(book, string.concat("../app/src/deployments/", id, ".json"));
        }

        // Safe Transaction Builder Batch
        address[] memory targets = new address[](2);
        targets[0] = address(factory);
        targets[1] = address(markets);
        uint256[] memory values = new uint256[](2);
        bytes[] memory payloads = new bytes[](2);
        payloads[0] = abi.encodeCall(Ownable2Step.acceptOwnership, ());
        payloads[1] = payloads[0];
        bytes32 salt = keccak256("xero.base.acceptOwnership.v1");
        bytes memory schedule = abi.encodeCall(TimelockController.scheduleBatch, (targets, values, payloads, bytes32(0), salt, delay));
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
        vm.serializeString(b, "note", "Schedule now in Safe{Wallet}, then execute after timelock delay.");
        vm.serializeString(b, "schedule", tx1);
        string memory out = vm.serializeString(b, "execute", tx2);
        vm.writeJson(out, string.concat("../deploy/out/", id, "-safe-accept-ownership.json"));

        console2.log("Deployment book written to deploy/out/", id, ".json");
        console2.log("Safe batch written to deploy/out/", id, "-safe-accept-ownership.json");
    }
}
