// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {XeroFixture} from "./utils/XeroFixture.sol";
import {XeroVault} from "../src/XeroVault.sol";
import {XeroYieldMarket} from "../src/market/XeroYieldMarket.sol";
import {CurveLens} from "../src/market/CurveLens.sol";
import {XeroRouter} from "../src/periphery/XeroRouter.sol";
import {XeroOracle, IAggregatorV3} from "../src/oracle/XeroOracle.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {IXeroMath} from "../src/interfaces/IXeroMath.sol";

contract XeroYieldMarketTest is XeroFixture {
    XeroYieldMarket internal market;

    /// @dev AAPL-like: 0.4% a year, in Stock Tokens per YT unit.
    int256 internal constant RATE = 0.004e18;
    uint256 internal constant FEE = 0.003e18;

    function _scalar(int256 rate) internal pure returns (int256) {
        return int256(8 * 1e36 / uint256(rate));
    }

    function setUp() public override {
        super.setUp();
        market = _createMarket(vault, uint256(RATE), _scalar(RATE), FEE);
        _seedMarket(vault, market, 10_000 ether, 40 ether, RATE);

        _strip(alice, 1_000 ether);
        address[2] memory traders = [alice, bob];
        for (uint256 i; i < 2; ++i) {
            vm.startPrank(traders[i]);
            yt.approve(address(market), type(uint256).max);
            aapl.approve(address(market), type(uint256).max);
            vm.stopPrank();
        }
    }

    function test_OpeningState() public view {
        XeroYieldMarket.PoolState memory s = market.getState();
        assertTrue(s.initialized);
        assertEq(s.impliedRate, RATE);
        assertApproxEqRel(s.ytPrice, 0.004e18, 1e12);
        assertEq(market.symbol(), "XLP-xAAPL-YT-1Y");
        assertEq(address(market.quote()), address(aapl));
    }

    function test_SellingYieldLowersImpliedRate() public {
        (uint256 quoted,) = market.quoteYtForQuote(100 ether);
        uint256 before = aapl.balanceOf(alice);
        vm.prank(alice);
        uint256 out = market.swapExactYtForQuote(100 ether, quoted, alice);
        assertEq(out, quoted);
        assertEq(aapl.balanceOf(alice) - before, out);
        assertLt(market.lastRate(), RATE);
        assertApproxEqRel(out, 0.4 ether, 0.01e18);
    }

    function test_BuyingYieldRaisesImpliedRate() public {
        (uint256 quoted,) = market.quoteQuoteForYt(0.4 ether);
        vm.prank(bob);
        uint256 got = market.swapExactQuoteForYt(0.4 ether, quoted, bob);
        assertEq(got, quoted);
        assertEq(yt.balanceOf(bob), got);
        assertGt(market.lastRate(), RATE);
        assertApproxEqRel(got, 100 ether, 0.01e18);
    }

    function test_SlippageProtection() public {
        (uint256 quoted,) = market.quoteYtForQuote(100 ether);
        vm.prank(alice);
        vm.expectRevert(XeroYieldMarket.Slippage.selector);
        market.swapExactYtForQuote(100 ether, quoted + 1, alice);
    }

    function test_OversizedTradeRejected() public {
        _strip(alice, 9_000 ether);
        // 10,000 more YT into a 10,000 YT pool would push the YT proportion past the 98% cap.
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IXeroMath.MathError.selector, uint8(4)));
        market.swapExactYtForQuote(10_000 ether, 0, alice);
    }

    function test_PriceDecaysWithTimeAtConstantRate() public {
        uint256 p0 = market.ytPrice();
        vm.warp(block.timestamp + 182.5 days);
        assertApproxEqRel(market.ytPrice(), p0 / 2, 1e12);
        assertEq(market.lastRate(), RATE);
    }

    function test_SwapsStopAtMaturityButLPsCanExit() public {
        vm.warp(vault.maturity());
        vm.prank(alice);
        vm.expectRevert(XeroYieldMarket.Expired.selector);
        market.swapExactYtForQuote(1 ether, 0, alice);
        uint256 lp = market.balanceOf(admin);
        vm.prank(admin);
        (uint256 ytOut, uint256 quoteOut) = market.removeLiquidity(lp, 0, 0, admin);
        assertGt(ytOut, 0);
        assertGt(quoteOut, 0);
    }

    function test_PoolYieldAccruesToLiquidityProviders() public {
        uint256 before = market.reserveQuote();
        _reinvest(1e18, 100e18); // +1%
        market.harvest();
        // 10,000 YT units accrue ~ 10,000 / I * (1 - 1/1.01) Stock Tokens
        assertApproxEqRel(market.reserveQuote() - before, 98.96 ether, 0.01e18);
    }

    function test_AddAndRemoveLiquidityIsProportional() public {
        uint256 supply = market.totalSupply();
        vm.startPrank(alice);
        (uint256 lp, uint256 ytUsed, uint256 quoteUsed) = market.addLiquidity(100 ether, 1_000 ether, 0, alice);
        assertEq(ytUsed, 100 ether);
        assertEq(quoteUsed, 0.4 ether);
        assertApproxEqRel(lp, supply / 100, 1e12);
        (uint256 ytOut, uint256 quoteOut) = market.removeLiquidity(lp, 0, 0, alice);
        vm.stopPrank();
        assertApproxEqAbs(ytOut, 100 ether, 1e6);
        assertApproxEqAbs(quoteOut, 0.4 ether, 1e6);
    }

    function test_OnlyCreatorInitializes() public {
        XeroVault v2 = _createVault(T0 + 90 days, "3M");
        XeroYieldMarket m2 = _createMarket(v2, 0.001e18, _scalar(RATE), FEE);
        vm.prank(alice);
        vm.expectRevert(XeroYieldMarket.OnlyCreator.selector);
        m2.initialize(1, 1, 1, alice);
    }

    function testFuzz_RoundTripNeverProfits(uint256 quoteIn) public {
        quoteIn = bound(quoteIn, 1e12, 10 ether);
        vm.startPrank(bob);
        uint256 got = market.swapExactQuoteForYt(quoteIn, 0, bob);
        uint256 back = market.swapExactYtForQuote(got, 0, bob);
        vm.stopPrank();
        assertLt(back, quoteIn);
    }

    // ------------------------------------------------------------ router

    function test_RouterStripAndSellYield() public {
        uint256 before = aapl.balanceOf(carol);
        vm.prank(carol);
        (uint256 units, uint256 quoteOut) = router.stripAndSellYield(vault, market, 100 ether, 0, carol);
        assertEq(pt.balanceOf(carol), units);
        assertEq(yt.balanceOf(carol), 0);
        assertApproxEqRel(quoteOut, 0.4 ether, 0.02e18);
        assertEq(aapl.balanceOf(carol), before - 100 ether + quoteOut);
        assertEq(aapl.balanceOf(address(router)), 0);
        assertEq(pt.balanceOf(address(router)), 0);
    }

    function test_RouterBuyPrincipalReinvestsYieldProceeds() public {
        uint256 before = aapl.balanceOf(carol);
        uint256 oneRound = vault.previewStrip(100 ether);
        vm.prank(carol);
        (uint256 units, uint256 refund) = router.buyPrincipal(vault, market, 100 ether, 0, carol);
        assertEq(pt.balanceOf(carol), units);
        assertEq(yt.balanceOf(carol), 0);
        assertGt(units, oneRound); // reinvesting the YT proceeds buys more PT than a single strip
        assertLt(refund, 0.01 ether); // under 1 bp of the input is left over
        assertEq(aapl.balanceOf(carol), before - 100 ether + refund);
        assertEq(aapl.balanceOf(address(router)), 0);
        assertEq(pt.balanceOf(address(router)), 0);
        assertEq(yt.balanceOf(address(router)), 0);
    }

    function test_RouterBuyPrincipalEnforcesMinimum() public {
        vm.prank(carol);
        vm.expectRevert(XeroRouter.InsufficientOutput.selector);
        router.buyPrincipal(vault, market, 100 ether, 1_000 ether, carol);
    }

    function testFuzz_RouterBuyPrincipalLeavesNothingBehind(uint256 raw) public {
        raw = bound(raw, 1e12, 500 ether);
        vm.prank(carol);
        (uint256 units,) = router.buyPrincipal(vault, market, raw, 0, carol);
        assertGe(units, vault.previewStrip(raw));
        assertEq(aapl.balanceOf(address(router)), 0);
        assertEq(pt.balanceOf(address(router)), 0);
        assertEq(yt.balanceOf(address(router)), 0);
    }

    function test_RouterExitRecombinesAndClaims() public {
        vm.prank(carol);
        uint256 units = router.strip(vault, 100 ether, carol);
        _reinvest(1e18, 100e18);
        vm.startPrank(carol);
        pt.approve(address(router), units);
        yt.approve(address(router), units);
        (uint256 raw, uint256 y) = router.exit(vault, units, carol);
        vm.stopPrank();
        assertApproxEqAbs(raw + y, 100 ether, 3);
        assertEq(aapl.balanceOf(carol), 10_000 ether - 100 ether + raw + y);
    }

    function test_RouterRejectsMismatchedMarket() public {
        XeroVault v2 = _createVault(T0 + 90 days, "3M");
        vm.prank(carol);
        vm.expectRevert(XeroRouter.MarketMismatch.selector);
        router.stripAndSellYield(v2, market, 1 ether, 0, carol);
    }

    // ------------------------------------------------------------ lens & oracle

    function test_CurveLensBuildsCurveWithYieldsAndForwards() public {
        XeroVault v3m = _createVault(T0 + 91 days, "3M");
        XeroVault v2y = _createVault(T0 + 730 days, "2Y");
        XeroYieldMarket m3m = _createMarket(v3m, 0.00095e18, _scalar(0.0038e18), FEE);
        XeroYieldMarket m2y = _createMarket(v2y, 0.0088e18, _scalar(0.0044e18), FEE);
        _seedMarket(v3m, m3m, 10_000 ether, 9.5 ether, 0.0038e18);
        _seedMarket(v2y, m2y, 10_000 ether, 88 ether, 0.0044e18);

        CurveLens.Curve memory c = lens.getCurve(address(aapl));
        assertEq(c.symbol, "AAPL");
        assertTrue(c.priceFresh);
        assertApproxEqRel(c.priceUsd, 255e18 * AAPL_MULTIPLIER / 1e18, 1e10);
        assertEq(c.points.length, 3);
        assertEq(c.points[0].vault, address(v3m));
        assertEq(c.points[2].vault, address(v2y));
        // implied yield = rate x dividend index
        assertApproxEqRel(uint256(c.points[1].impliedYield), 0.004e18 * AAPL_MULTIPLIER / 1e18, 1e12);
        // PT + YT = one unit's worth of Stock Tokens today
        assertApproxEqAbs(c.points[1].ptPrice + c.points[1].ytPrice, 1e36 / AAPL_MULTIPLIER, 1);
        assertGt(c.points[1].ytPriceUsd, 0);
        assertEq(c.forwards.length, 3);
        assertGt(c.forwards[2], c.forwards[1]);
    }

    function test_OracleNormalisesFeedAndRejectsStale() public {
        (uint256 p,) = oracle.getPrice(address(aapl));
        assertApproxEqRel(p, 255e18 * AAPL_MULTIPLIER / 1e18, 1e10);
        vm.warp(block.timestamp + 4 days + 1);
        vm.expectRevert();
        oracle.getPrice(address(aapl));
        CurveLens.Curve memory c = lens.getCurve(address(aapl));
        assertFalse(c.priceFresh);
        assertEq(c.points[0].ytPriceUsd, 0);
    }

    function test_OracleHonoursSequencerFeed() public {
        MockAggregator seq = new MockAggregator(1); // 1 = sequencer down
        vm.prank(admin);
        oracle.setSequencerUptimeFeed(IAggregatorV3(address(seq)), 1 hours);
        vm.expectRevert(XeroOracle.SequencerDown.selector);
        oracle.getPrice(address(aapl));
    }
}
