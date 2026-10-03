// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {MockUSDG} from "../../src/mocks/MockUSDG.sol";
import {MockStockToken} from "../../src/mocks/MockStockToken.sol";
import {MockAggregator} from "../../src/mocks/MockAggregator.sol";
import {RiskGuardian} from "../../src/RiskGuardian.sol";
import {CorporateActionEngine} from "../../src/CorporateActionEngine.sol";
import {ICorporateActionEngine} from "../../src/interfaces/ICorporateActionEngine.sol";
import {IRiskGuardian} from "../../src/interfaces/IRiskGuardian.sol";
import {IXeroMath} from "../../src/interfaces/IXeroMath.sol";
import {IXeroOracle} from "../../src/interfaces/IXeroOracle.sol";
import {XeroFactory} from "../../src/XeroFactory.sol";
import {XeroVault} from "../../src/XeroVault.sol";
import {XeroComponentToken} from "../../src/tokens/XeroComponentToken.sol";
import {XeroMathSol} from "../../src/math/XeroMathSol.sol";
import {XeroOracle, IAggregatorV3} from "../../src/oracle/XeroOracle.sol";
import {YieldMarketFactory, IVaultRegistry} from "../../src/market/YieldMarketFactory.sol";
import {XeroYieldMarket} from "../../src/market/XeroYieldMarket.sol";
import {CurveLens, IXeroFactoryView, IYieldMarketFactoryView} from "../../src/market/CurveLens.sol";
import {XeroRouter, IVaultRegistryView} from "../../src/periphery/XeroRouter.sol";

abstract contract XeroFixture is Test {
    uint256 internal constant WAD = 1e18;
    uint64 internal constant T0 = 1_790_000_000; // Sep 2026
    /// @dev AAPL's live Robinhood Chain multiplier when this suite was written.
    uint256 internal constant AAPL_MULTIPLIER = 1.000566080061092436e18;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal reporter = makeAddr("reporter");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    MockUSDG internal usdg;
    MockStockToken internal aapl;
    MockAggregator internal aaplFeed;
    RiskGuardian internal guardian;
    CorporateActionEngine internal engine;
    XeroFactory internal factory;
    XeroMathSol internal math;
    YieldMarketFactory internal markets;
    XeroOracle internal oracle;
    CurveLens internal lens;
    XeroRouter internal router;

    XeroVault internal vault;
    XeroComponentToken internal pt;
    XeroComponentToken internal yt;

    uint256 internal refNonce;

    function setUp() public virtual {
        vm.warp(T0);
        usdg = new MockUSDG();
        aapl = new MockStockToken("Apple (Mock Stock Token)", "AAPL", issuer);
        vm.prank(issuer);
        aapl.updateMultiplier(AAPL_MULTIPLIER);

        guardian = new RiskGuardian(admin);
        engine = new CorporateActionEngine(admin, IRiskGuardian(address(guardian)), 1);
        factory = new XeroFactory(
            admin, usdg, ICorporateActionEngine(address(engine)), IRiskGuardian(address(guardian)), treasury
        );
        math = new XeroMathSol();
        markets = new YieldMarketFactory(
            admin, IVaultRegistry(address(factory)), IRiskGuardian(address(guardian)), IXeroMath(address(math))
        );
        oracle = new XeroOracle(admin, 4 days);
        lens = new CurveLens(
            IXeroFactoryView(address(factory)),
            IYieldMarketFactoryView(address(markets)),
            IXeroOracle(address(oracle)),
            IXeroMath(address(math))
        );
        router = new XeroRouter(IVaultRegistryView(address(factory)));
        aaplFeed = new MockAggregator(255e8 * int256(AAPL_MULTIPLIER) / 1e18);

        bytes32 engineRole = guardian.ENGINE_ROLE();
        bytes32 reporterRole = engine.REPORTER_ROLE();
        vm.startPrank(admin);
        guardian.grantRole(engineRole, address(engine));
        engine.grantRole(reporterRole, reporter);
        guardian.setAssetAllowed(address(aapl), true);
        oracle.configureAsset(address(aapl), IAggregatorV3(address(aaplFeed)), 0);
        vm.stopPrank();

        vault = _createVault(T0 + 365 days, "1Y");
        pt = vault.pt();
        yt = vault.yt();

        address[3] memory users = [alice, bob, carol];
        for (uint256 i; i < users.length; ++i) {
            _giveTokens(users[i], 10_000 ether);
            vm.startPrank(users[i]);
            aapl.approve(address(vault), type(uint256).max);
            aapl.approve(address(router), type(uint256).max);
            vm.stopPrank();
        }
    }

    // ------------------------------------------------------------ helpers

    function _createVault(uint64 maturity, string memory label) internal returns (XeroVault v) {
        vm.prank(admin);
        v = XeroVault(factory.createVault(address(aapl), maturity, label, 0));
    }

    function _giveTokens(address to, uint256 raw) internal {
        vm.prank(issuer);
        aapl.mint(to, raw);
    }

    function _strip(address who, uint256 raw) internal returns (uint256 units) {
        vm.prank(who);
        units = vault.strip(raw, who);
    }

    /// @dev Robinhood reinvests a cash dividend: the multiplier grows by cash / price.
    function _reinvest(uint256 cashPerShare, uint256 price) internal {
        vm.prank(issuer);
        aapl.reinvestDividend(cashPerShare, price);
    }

    /// @dev A split as Robinhood applies it, attested by the reporter at the same moment.
    function _split(uint128 newRate, uint128 oldRate) internal {
        vm.prank(issuer);
        aapl.split(newRate, oldRate);
        _report(ICorporateActionEngine.ActionType.FORWARD_SPLIT, uint64(block.timestamp), newRate * 1e18, oldRate * 1e18);
    }

    function _report(ICorporateActionEngine.ActionType kind, uint64 effectiveAt, uint128 value, uint128 value2)
        internal
    {
        vm.prank(reporter);
        engine.report(address(aapl), kind, effectiveAt, value, value2, keccak256(abi.encode(++refNonce)));
    }

    function _createMarket(XeroVault v, uint256 refPrice, int256 scalar, uint256 fee)
        internal
        returns (XeroYieldMarket market)
    {
        vm.prank(admin);
        market = XeroYieldMarket(markets.createPool(address(v), refPrice, scalar, fee));
    }

    /// @dev Seeds a market from `admin`'s freshly stripped YT plus Stock Tokens.
    function _seedMarket(XeroVault v, XeroYieldMarket market, uint256 ytAmount, uint256 quoteAmount, int256 rate)
        internal
    {
        uint256 raw = ytAmount * WAD / v.dividendIndex() + 1 ether;
        _giveTokens(admin, raw + quoteAmount);
        vm.startPrank(admin);
        aapl.approve(address(v), type(uint256).max);
        v.strip(raw, admin);
        v.yt().approve(address(market), type(uint256).max);
        aapl.approve(address(market), type(uint256).max);
        market.initialize(ytAmount, quoteAmount, rate, admin);
        vm.stopPrank();
    }
}
