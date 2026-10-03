// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockStockToken} from "../src/mocks/MockStockToken.sol";
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

/// @notice Demo environment for the local devnet or Robinhood Chain testnet: mock ERC-8056 Stock Tokens
///         mirroring live Robinhood launch candidates (multipliers and prices as observed on mainnet),
///         Chainlink-style feeds, the full protocol, and seeded Yield Token markets. Robinhood publishes
///         no Stock Tokens on testnet, so the mocks (with a public faucet) stand in for them there.
///
///   Local:   anvil && forge script script/DeployDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --slow \
///              --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
///   Testnet: forge script script/DeployDemo.s.sol --rpc-url https://rpc.testnet.chain.robinhood.com/rpc \
///              --broadcast --slow --account xero-testnet
///   Testnet adds a 1-week maturity (DEMO_SHORT_TENOR=false to skip) so settlement can be exercised in real time,
///   and 1-year markets on Robinhood's own testnet Stock Tokens listed in deploy/robinhood-testnet.json, seeded from
///   the deployer's balance of them (DEMO_REAL_ASSETS=false to skip).
interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

interface IUIMultiplier {
    function uiMultiplier() external view returns (uint256);
}

contract DeployDemo is Script {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant SEED_UNITS = 20_000 ether;

    struct Asset {
        string name;
        string symbol;
        uint256 multiplier; // live Robinhood Chain value
        uint256 price; // USD per share
        uint256 dividendYield; // annual, WAD fraction
    }

    struct Tenor {
        string label;
        uint64 secs;
        uint256 termBps; // implied yield relative to the trailing yield
    }

    MockUSDG internal usdg;
    RiskGuardian internal guardian;
    CorporateActionEngine internal engine;
    XeroFactory internal factory;
    IXeroMath internal math;
    YieldMarketFactory internal markets;
    XeroOracle internal oracle;
    CurveLens internal lens;
    XeroRouter internal router;
    address internal deployer;

    function run() external {
        deployer = msg.sender;
        vm.startBroadcast();

        usdg = new MockUSDG();
        guardian = new RiskGuardian(deployer);
        engine = new CorporateActionEngine(deployer, IRiskGuardian(address(guardian)), 1);
        factory = new XeroFactory(
            deployer, usdg, ICorporateActionEngine(address(engine)), IRiskGuardian(address(guardian)), deployer
        );
        address mathAddr = vm.envOr("XERO_MATH", address(0));
        math = mathAddr == address(0) ? IXeroMath(address(new XeroMathSol())) : IXeroMath(mathAddr);
        markets = new YieldMarketFactory(deployer, IVaultRegistry(address(factory)), IRiskGuardian(address(guardian)), math);
        oracle = new XeroOracle(deployer, 4 days);
        lens = new CurveLens(
            IXeroFactoryView(address(factory)), IYieldMarketFactoryView(address(markets)), IXeroOracle(address(oracle)), math
        );
        router = new XeroRouter(IVaultRegistryView(address(factory)));

        guardian.grantRole(guardian.ENGINE_ROLE(), address(engine));
        engine.grantRole(engine.REPORTER_ROLE(), deployer);
        factory.setFees(5, 0, 300, 0); // 5 bps strip fee, 3% of yield

        Asset[4] memory assets = [
            // Prices, multipliers and trailing yields as observed on Robinhood Chain on 2 Oct 2026.
            Asset("Apple (Mock Stock Token)", "AAPL", 1.000566080061092436e18, 332.87e18, 0.0031e18),
            Asset("Schwab US Dividend Equity ETF (Mock Stock Token)", "SCHD", 1.005538606893683992e18, 32.68e18, 0.0326e18),
            Asset("Exxon Mobil (Mock Stock Token)", "XOM", 1.0010395637646619e18, 164.08e18, 0.0251e18),
            Asset("iShares 0-3 Month Treasury Bond ETF (Mock Stock Token)", "SGOV", 1.007186931447954063e18, 100.44e18, 0.0359e18)
        ];
        bool shortTenor = vm.envOr("DEMO_SHORT_TENOR", block.chainid != 31337);
        Tenor[] memory tenors = new Tenor[](shortTenor ? 5 : 4);
        uint256 o;
        if (shortTenor) tenors[o++] = Tenor("1W", 7 days, 9_500);
        tenors[o++] = Tenor("3M", 91 days, 9_700);
        tenors[o++] = Tenor("6M", 182 days, 10_000);
        tenors[o++] = Tenor("1Y", 365 days, 10_250);
        tenors[o++] = Tenor("2Y", 730 days, 10_500);

        address[] memory actors = _actors();
        string memory realJson = _realAssetsConfig();
        address[] memory real = bytes(realJson).length > 0 ? vm.parseJsonAddressArray(realJson, ".realAssets.tokens") : new address[](0);
        address[] memory tokens = new address[](4 + real.length);
        address[] memory feeds = new address[](4 + real.length);
        for (uint256 a; a < assets.length; ++a) {
            Asset memory as_ = assets[a];
            MockStockToken t = new MockStockToken(as_.name, as_.symbol, deployer);
            t.updateMultiplier(as_.multiplier);
            // Chainlink reports the token's total-return value: price x multiplier, 8 decimals.
            MockAggregator feed = new MockAggregator(int256(as_.price * as_.multiplier / WAD / 1e10));
            tokens[a] = address(t);
            feeds[a] = address(feed);
            guardian.setAssetAllowed(address(t), true);
            oracle.configureAsset(address(t), IAggregatorV3(address(feed)), 0);
            for (uint256 i; i < actors.length; ++i) t.mint(actors[i], 100_000e18 * WAD / as_.price); // ~$100k each
            t.setFaucetAmount(10_000e18 * WAD / as_.price); // ~$10k per faucet claim
            for (uint256 k; k < tenors.length; ++k) _market(t, as_, tenors[k]);
        }
        for (uint256 i; i < actors.length; ++i) usdg.mint(actors[i], 100_000e6);
        for (uint256 r; r < real.length; ++r) (tokens[4 + r], feeds[4 + r]) = _realMarket(realJson, r);

        vm.stopBroadcast();
        _writeAddressBook(tokens, feeds, actors, real);
    }

    function _market(MockStockToken t, Asset memory as_, Tenor memory tn) internal {
        XeroVault vault = XeroVault(factory.createVault(address(t), uint64(block.timestamp) + tn.secs, tn.label, 0));
        uint256 yield_ = as_.dividendYield * tn.termBps / 10_000;
        int256 rate = int256(yield_ * WAD / vault.dividendIndex()); // Stock Tokens per unit per year
        uint256 refPrice = uint256(rate) * tn.secs / 365 days;
        int256 scalar = int256(8 * 1e36 / uint256(rate));
        XeroYieldMarket market = XeroYieldMarket(markets.createPool(address(vault), refPrice, scalar, 0.003e18));

        uint256 raw = SEED_UNITS * WAD / vault.dividendIndex() * 10_000 / 9_995 + 1 ether;
        uint256 quoteSeed = SEED_UNITS * refPrice / WAD;
        t.mint(deployer, raw + quoteSeed);
        t.approve(address(vault), type(uint256).max);
        vault.strip(raw, deployer);
        vault.yt().approve(address(market), type(uint256).max);
        t.approve(address(market), type(uint256).max);
        market.initialize(SEED_UNITS, quoteSeed, rate, deployer);
        console2.log(vault.yt().symbol(), address(market));
    }

    function _realAssetsConfig() internal view returns (string memory) {
        if (block.chainid != 46630 || !vm.envOr("DEMO_REAL_ASSETS", true)) return "";
        return vm.readFile("../deploy/robinhood-testnet.json");
    }

    /// @dev A 1-year market on a Robinhood-issued Stock Token. These can't be minted, so the deployer strips
    ///      `seedBps` of its balance and seeds the pool with the YT plus the matching quote tokens.
    function _realMarket(string memory json, uint256 r) internal returns (address token, address feedAddr) {
        token = vm.parseJsonAddressArray(json, ".realAssets.tokens")[r];
        uint256 price = vm.parseJsonUintArray(json, ".realAssets.pricesWad")[r];
        feedAddr = address(new MockAggregator(int256(price * IUIMultiplier(token).uiMultiplier() / WAD / 1e10)));
        guardian.setAssetAllowed(token, true);
        oracle.configureAsset(token, IAggregatorV3(feedAddr), 0);

        _realPool(json, token);
    }

    function _realPool(string memory json, address token) internal {
        uint64 secs = uint64(vm.parseJsonUint(json, ".realAssets.tenorSecs"));
        XeroVault vault = XeroVault(
            factory.createVault(token, uint64(block.timestamp) + secs, vm.parseJsonString(json, ".realAssets.tenorLabel"), 0)
        );
        int256 rate = int256(vm.parseJsonUint(json, ".realAssets.openingYieldWad") * WAD / vault.dividendIndex());
        uint256 refPrice = uint256(rate) * secs / 365 days;
        XeroYieldMarket market =
            XeroYieldMarket(markets.createPool(address(vault), refPrice, int256(8 * 1e36 / uint256(rate)), 0.003e18));
        uint256 seed = IERC20Like(token).balanceOf(deployer) * vm.parseJsonUint(json, ".realAssets.seedBps") / 10_000;
        _seedReal(vault, market, IERC20Like(token), rate, refPrice, seed);
    }

    function _seedReal(XeroVault vault, XeroYieldMarket market, IERC20Like t, int256 rate, uint256 refPrice, uint256 seed)
        internal
    {
        require(seed > 0, "deployer holds none of a real asset");
        uint256 raw = seed * WAD / (WAD + refPrice); // leaves room for the quote side
        t.approve(address(vault), type(uint256).max);
        uint256 units = vault.strip(raw, deployer);
        vault.yt().approve(address(market), type(uint256).max);
        t.approve(address(market), type(uint256).max);
        market.initialize(units, units * refPrice / WAD, rate, deployer);
        console2.log(vault.yt().symbol(), address(market));
    }

    function _actors() internal view returns (address[] memory a) {
        string memory raw = vm.envOr("DEMO_ACTORS", string(""));
        if (bytes(raw).length > 0) return vm.envAddress("DEMO_ACTORS", ",");
        if (block.chainid != 31337) return new address[](0); // testers use the faucet
        a = new address[](3);
        a[0] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8; // anvil #1
        a[1] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC; // anvil #2
        a[2] = 0x90F79bf6EB2c4f870365E785982E1f101E93b906; // anvil #3
    }

    function _writeAddressBook(address[] memory tokens, address[] memory feeds, address[] memory actors, address[] memory real)
        internal
    {
        string memory k = "book";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "startBlock", block.number);
        vm.serializeAddress(k, "deployer", deployer);
        vm.serializeAddress(k, "usdg", address(usdg));
        vm.serializeAddress(k, "guardian", address(guardian));
        vm.serializeAddress(k, "engine", address(engine));
        vm.serializeAddress(k, "factory", address(factory));
        vm.serializeAddress(k, "math", address(math));
        vm.serializeAddress(k, "markets", address(markets));
        vm.serializeAddress(k, "oracle", address(oracle));
        vm.serializeAddress(k, "lens", address(lens));
        vm.serializeAddress(k, "router", address(router));
        vm.serializeAddress(k, "feeds", feeds);
        vm.serializeAddress(k, "actors", actors);
        vm.serializeAddress(k, "realStocks", real);
        string memory out = vm.serializeAddress(k, "stocks", tokens);
        string memory path =
            vm.envOr("DEPLOYMENTS_OUT", string.concat("../app/src/deployments/", vm.toString(block.chainid), ".json"));
        vm.writeJson(out, path);
        console2.log("address book written to", path);
    }
}
