// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockB20StockToken} from "../src/mocks/MockB20StockToken.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {RiskGuardian} from "../src/RiskGuardian.sol";
import {CorporateActionEngine} from "../src/CorporateActionEngine.sol";
import {ICorporateActionEngine} from "../src/interfaces/ICorporateActionEngine.sol";
import {IRiskGuardian} from "../src/interfaces/IRiskGuardian.sol";
import {IXeroMath} from "../src/interfaces/IXeroMath.sol";
import {IXeroOracle} from "../src/interfaces/IXeroOracle.sol";
import {XeroFactory} from "../src/XeroFactory.sol";
import {XeroVault} from "../src/XeroVault.sol";
import {XeroMathSol} from "../src/math/XeroMathSol.sol";
import {XeroOracle, IAggregatorV3} from "../src/oracle/XeroOracle.sol";
import {YieldMarketFactory, IVaultRegistry} from "../src/market/YieldMarketFactory.sol";
import {XeroYieldMarket} from "../src/market/XeroYieldMarket.sol";
import {CurveLens, IXeroFactoryView, IYieldMarketFactoryView} from "../src/market/CurveLens.sol";
import {XeroRouter, IVaultRegistryView} from "../src/periphery/XeroRouter.sol";
import {BaseB20YieldLens} from "../src/lens/BaseB20YieldLens.sol";

interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

/// @notice Deployment script for Base (Base Sepolia Testnet 84532, Base Mainnet 8453, or Local).
///         Deploys test versions of the ten Coinbase B20 stocks on Base (AAPLc, AMZNc, GOOGLc, METAc, MSFTc,
///         MSTRc, NVDAc, SNDKc, SPCXc, TSLAc),
///         oracles, vaults, and implied dividend yield AMMs. Writes deployments directly to core app.
contract DeployBase is Script {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant SEED_UNITS = 25_000 ether;

    struct AssetDef {
        string name;
        string symbol;
        uint256 multiplier;
        uint256 price; // USD per share
        uint256 dividendYield; // annual WAD fraction
    }

    struct Tenor {
        string label;
        uint64 secs;
        uint256 termBps;
    }

    MockUSDG internal usdc;
    RiskGuardian internal guardian;
    CorporateActionEngine internal engine;
    XeroFactory internal factory;
    IXeroMath internal math;
    YieldMarketFactory internal markets;
    XeroOracle internal oracle;
    CurveLens internal lens;
    XeroRouter internal router;
    BaseB20YieldLens internal baseLens;
    address internal deployer;

    function run() external {
        deployer = msg.sender;
        vm.startBroadcast();

        usdc = new MockUSDG();
        guardian = new RiskGuardian(deployer);
        engine = new CorporateActionEngine(deployer, IRiskGuardian(address(guardian)), 1);
        factory = new XeroFactory(
            deployer, usdc, ICorporateActionEngine(address(engine)), IRiskGuardian(address(guardian)), deployer
        );
        address mathAddr = vm.envOr("XERO_MATH", address(0));
        math = mathAddr == address(0) ? IXeroMath(address(new XeroMathSol())) : IXeroMath(mathAddr);
        markets = new YieldMarketFactory(deployer, IVaultRegistry(address(factory)), IRiskGuardian(address(guardian)), math);
        oracle = new XeroOracle(deployer, 4 days);
        lens = new CurveLens(
            IXeroFactoryView(address(factory)), IYieldMarketFactoryView(address(markets)), IXeroOracle(address(oracle)), math
        );
        router = new XeroRouter(IVaultRegistryView(address(factory)));
        baseLens = new BaseB20YieldLens(IXeroOracle(address(oracle)));

        guardian.grantRole(guardian.ENGINE_ROLE(), address(engine));
        engine.grantRole(engine.REPORTER_ROLE(), deployer);
        factory.setFees(5, 0, 300, 0); // 5 bps strip fee, 3% of yield

        // The Coinbase B20 stocks live on Base mainnet (base.org/stocks), mirrored at mainnet prices and multipliers
        // read on 2026-10-15. Opening yields are each company's regular quarterly dividend x4 / price; markets
        // open only where a dividend is paid, since a stock without one has nothing to split.
        AssetDef[10] memory assets = [
            AssetDef("Apple Inc. (test)", "AAPLc", 1.000000e18, 345.42e18, 0.0030e18),
            AssetDef("Amazon.com Inc. (test)", "AMZNc", 1.000000e18, 250.33e18, 0),
            AssetDef("Alphabet Inc. (test)", "GOOGLc", 1.000377118676784179e18, 342.50e18, 0.0025e18),
            AssetDef("Meta Platforms Inc. (test)", "METAc", 1.000313792289598084e18, 725.25e18, 0.0029e18),
            AssetDef("Microsoft Corporation (test)", "MSFTc", 1.000000e18, 530.73e18, 0.0069e18),
            AssetDef("Strategy Inc. (test)", "MSTRc", 1.000000e18, 141.03e18, 0),
            AssetDef("NVIDIA Corporation (test)", "NVDAc", 1.000537939576369481e18, 218.08e18, 0.0002e18),
            AssetDef("Sandisk Corporation (test)", "SNDKc", 1.000000e18, 1342.84e18, 0),
            AssetDef("Space Exploration Technologies Corp. (test)", "SPCXc", 1.000000e18, 148.57e18, 0),
            AssetDef("Tesla Inc. (test)", "TSLAc", 1.000000e18, 360.64e18, 0)
        ];

        Tenor[4] memory tenors = [
            Tenor("1W", 7 days, 9_500),
            Tenor("3M", 91 days, 9_800),
            Tenor("6M", 182 days, 10_000),
            Tenor("1Y", 365 days, 10_300)
        ];

        address[] memory actors = _actors();
        address[] memory tokens = new address[](assets.length);
        address[] memory feeds = new address[](assets.length);

        for (uint256 a = 0; a < assets.length; ++a) {
            AssetDef memory as_ = assets[a];
            MockB20StockToken t = new MockB20StockToken(as_.name, as_.symbol, deployer);
            t.updateMultiplier(as_.multiplier);
            t.setFaucetAmount(100e18 * WAD / as_.price); // ~$100 worth per testnet faucet claim
            for (uint256 i = 0; i < actors.length; ++i) t.mint(actors[i], 10_000e18 * WAD / as_.price);

            MockAggregator feed = new MockAggregator(int256(as_.price * as_.multiplier / WAD / 1e10));
            tokens[a] = address(t);
            feeds[a] = address(feed);

            guardian.setAssetAllowed(address(t), true);
            oracle.configureAsset(address(t), IAggregatorV3(address(feed)), 0);

            if (as_.dividendYield == 0) continue; // listed and priced, but no dividend to split
            for (uint256 k = 0; k < tenors.length; ++k) {
                _createVaultAndMarket(address(t), as_, tenors[k]);
            }
        }

        for (uint256 i = 0; i < actors.length; ++i) usdc.mint(actors[i], 100_000e6);

        vm.stopBroadcast();
        _writeAddressBook(tokens, feeds, actors);
    }

    function _createVaultAndMarket(address tokenAddr, AssetDef memory as_, Tenor memory tn) internal {
        XeroVault vault = XeroVault(factory.createVault(tokenAddr, uint64(block.timestamp) + tn.secs, tn.label, 0));
        uint256 yield_ = as_.dividendYield * tn.termBps / 10_000;
        int256 rate = int256(yield_ * WAD / vault.dividendIndex());
        uint256 refPrice = uint256(rate) * tn.secs / 365 days;
        int256 scalar = int256(uint256(8e36) / (uint256(rate) > 0 ? uint256(rate) : 0.001e18));
        XeroYieldMarket market = XeroYieldMarket(markets.createPool(address(vault), refPrice, scalar, 0.003e18));

        uint256 raw = SEED_UNITS * WAD / vault.dividendIndex() * 10_000 / 9_995 + 1 ether;
        uint256 quoteSeed = SEED_UNITS * refPrice / WAD;
        if (quoteSeed == 0) quoteSeed = 10 ether;

        MockB20StockToken(tokenAddr).mint(deployer, raw + quoteSeed);
        IERC20Like(tokenAddr).approve(address(vault), type(uint256).max);
        vault.strip(raw, deployer);
        vault.yt().approve(address(market), type(uint256).max);
        IERC20Like(tokenAddr).approve(address(market), type(uint256).max);
        market.initialize(SEED_UNITS, quoteSeed, rate, deployer);
        console2.log(string.concat(vault.yt().symbol(), " Base B20 Market seeded: "), address(market));
    }

    function _actors() internal view returns (address[] memory a) {
        string memory raw = vm.envOr("DEMO_ACTORS", string(""));
        if (bytes(raw).length > 0) return vm.envAddress("DEMO_ACTORS", ",");
        a = new address[](3);
        a[0] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // anvil #1
        a[1] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // anvil #2
        a[2] = 0x90F79bf6EB2c4f870365E785982E1f101E93b906; // anvil #3
    }

    function _writeAddressBook(address[] memory tokens, address[] memory feeds, address[] memory actors) internal {
        uint256 cid = vm.envOr("DEPLOY_CHAIN_ID", block.chainid);
        string memory k = "book";
        vm.serializeUint(k, "chainId", cid);
        vm.serializeUint(k, "startBlock", block.number);
        vm.serializeAddress(k, "deployer", deployer);
        vm.serializeAddress(k, "usdc", address(usdc));
        vm.serializeAddress(k, "guardian", address(guardian));
        vm.serializeAddress(k, "engine", address(engine));
        vm.serializeAddress(k, "factory", address(factory));
        vm.serializeAddress(k, "math", address(math));
        vm.serializeAddress(k, "markets", address(markets));
        vm.serializeAddress(k, "oracle", address(oracle));
        vm.serializeAddress(k, "lens", address(lens));
        vm.serializeAddress(k, "baseLens", address(baseLens));
        vm.serializeAddress(k, "router", address(router));
        vm.serializeAddress(k, "feeds", feeds);
        vm.serializeAddress(k, "actors", actors);
        string memory out = vm.serializeAddress(k, "stocks", tokens);

        string memory defaultPath = string.concat("../app/src/deployments/", vm.toString(cid), ".json");
        string memory path = vm.envOr("DEPLOYMENTS_OUT", defaultPath);
        vm.writeJson(out, path);
        console2.log("Base Address book written to:", path);
    }
}
