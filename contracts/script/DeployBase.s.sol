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
///         Deploys Coinbase B20 tokenized stocks (NVDAc, AAPLc, COINc, TSLAc, SPYc, SCHDc),
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

        AssetDef[6] memory assets = [
            AssetDef("Coinbase B20 Nvidia Tokenized Stock", "NVDAc", 1.002418e18, 128.50e18, 0.0012e18),
            AssetDef("Coinbase B20 Apple Tokenized Stock", "AAPLc", 1.006520e18, 232.80e18, 0.0052e18),
            AssetDef("Coinbase B20 Coinbase Global Stock", "COINc", 1.000000e18, 218.40e18, 0.0000e18),
            AssetDef("Coinbase B20 Tesla Tokenized Stock", "TSLAc", 1.000000e18, 254.20e18, 0.0000e18),
            AssetDef("Coinbase B20 S&P 500 ETF Token", "SPYc", 1.012500e18, 575.60e18, 0.0125e18),
            AssetDef("Coinbase B20 Schwab US Dividend ETF", "SCHDc", 1.034510e18, 28.40e18, 0.0345e18)
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
        uint256 yield_ = as_.dividendYield > 0 ? as_.dividendYield * tn.termBps / 10_000 : 0.0050e18; // default 0.5% opening for zero-yield stocks
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
