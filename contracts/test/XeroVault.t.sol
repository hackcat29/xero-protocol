// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {XeroFixture} from "./utils/XeroFixture.sol";
import {XeroVault} from "../src/XeroVault.sol";
import {XeroFactory} from "../src/XeroFactory.sol";
import {RiskGuardian} from "../src/RiskGuardian.sol";
import {ICorporateActionEngine} from "../src/interfaces/ICorporateActionEngine.sol";

contract XeroVaultTest is XeroFixture {
    ICorporateActionEngine.ActionType internal constant CASH = ICorporateActionEngine.ActionType.CASH_DIVIDEND;

    // ------------------------------------------------------------ stripping & recombination

    function test_StripMintsUnitsAtDividendIndex() public {
        uint256 units = _strip(alice, 100 ether);
        assertEq(units, 100 ether * AAPL_MULTIPLIER / WAD, "1 unit = 1 underlying share at deposit");
        assertEq(pt.balanceOf(alice), units);
        assertEq(yt.balanceOf(alice), units);
        assertEq(vault.collateral(), 100 ether);
        assertEq(pt.symbol(), "xAAPL-PT-1Y");
        assertEq(yt.symbol(), "xAAPL-YT-1Y");
        assertTrue(vault.invariantHolds());
    }

    function test_RecombineReturnsDepositWithoutYield() public {
        uint256 units = _strip(alice, 100 ether);
        vm.prank(alice);
        uint256 raw = vault.recombine(units, alice);
        assertApproxEqAbs(raw, 100 ether, 1);
        assertEq(pt.totalSupply(), 0);
    }

    function test_StripFeeGoesToTreasury() public {
        vm.prank(admin);
        factory.setFees(10, 0, 0, 0);
        _strip(alice, 100 ether);
        assertEq(aapl.balanceOf(treasury), 0.1 ether);
        assertEq(vault.collateral(), 99.9 ether);
    }

    function test_FeesAreCapped() public {
        vm.startPrank(admin);
        vm.expectRevert(XeroFactory.FeeTooHigh.selector);
        factory.setFees(101, 0, 0, 0);
        vm.expectRevert(XeroFactory.FeeTooHigh.selector);
        factory.setFees(0, 0, 1_001, 0);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ reinvested dividends

    function test_ReinvestedDividendAccruesToYieldToken() public {
        uint256 units = _strip(alice, 100 ether);
        vm.prank(alice);
        yt.transfer(bob, units); // Alice sells her dividend exposure

        _reinvest(0.26e18, 255e18); // AAPL $0.26 dividend reinvested at $255
        uint256 bobYield = vault.claimYield(bob);
        // 100 tokens x 0.26/255 / (1 + 0.26/255) ~= 0.1019 tokens
        assertApproxEqRel(bobYield, 0.10186e18, 0.001e18);
        assertEq(aapl.balanceOf(bob), 10_000 ether + bobYield);
        assertEq(vault.claimYield(alice), 0, "PT earns nothing before maturity");
        assertTrue(vault.invariantHolds());
    }

    function test_PrincipalPlusYieldEqualsDeposit() public {
        uint256 units = _strip(alice, 100 ether);
        _reinvest(0.26e18, 255e18);
        _reinvest(0.26e18, 240e18);
        uint256 yieldRaw = vault.claimYield(alice);
        vm.prank(alice);
        uint256 principalRaw = vault.recombine(units, alice);
        assertApproxEqAbs(yieldRaw + principalRaw, 100 ether, 3, "PT + YT = Stock Token");
        assertGt(yieldRaw, 0);
    }

    function test_PrincipalKeepsShareCountConstant() public {
        uint256 units = _strip(alice, 100 ether);
        _reinvest(1e18, 100e18); // +1% multiplier
        vm.prank(alice);
        uint256 raw = vault.recombine(units, alice);
        // The PT leg still represents the original shares: raw * multiplier is unchanged.
        uint256 sharesBefore = 100 ether * AAPL_MULTIPLIER / WAD;
        uint256 sharesAfter = raw * aapl.uiMultiplier() / WAD;
        assertApproxEqAbs(sharesAfter, sharesBefore, 2);
    }

    function test_YieldFeeSplitsWithTreasury() public {
        vm.prank(admin);
        factory.setFees(0, 0, 500, 0); // 5% of yield
        _strip(alice, 100 ether);
        _reinvest(1e18, 100e18);
        uint256 a = vault.claimYield(alice);
        uint256 t = vault.claimYield(treasury);
        assertApproxEqRel(t * 19, a, 1e12);
        assertTrue(vault.invariantHolds());
    }

    function test_TransferSettlesAccruedYieldToSender() public {
        uint256 units = _strip(alice, 100 ether);
        _reinvest(1e18, 100e18);
        vm.prank(alice);
        yt.transfer(bob, units); // after the dividend was reinvested
        assertGt(vault.claimYield(alice), 0);
        assertEq(vault.claimYield(bob), 0);
    }

    function test_YieldStopsAtMaturityAndPrincipalKeepsLaterGrowth() public {
        uint256 units = _strip(alice, 100 ether);
        _reinvest(1e18, 100e18);
        vm.warp(vault.maturity());
        vault.sync();
        uint256 mIndex = vault.maturityIndex();
        assertGt(mIndex, 0);

        _reinvest(1e18, 100e18); // post-maturity dividend
        uint256 y = vault.claimYield(alice);
        vm.prank(alice);
        uint256 raw = vault.redeem(units, alice);
        assertApproxEqAbs(raw + y, 100 ether, 3);
        assertEq(raw, units * WAD / mIndex, "PT redeems at the maturity index");
        // ...and those raw tokens carry the post-maturity dividend via the multiplier.
        assertGt(raw * aapl.uiMultiplier() / WAD, 100 ether * AAPL_MULTIPLIER / WAD);
    }

    function test_RedeemRequiresMaturity() public {
        uint256 units = _strip(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(XeroVault.NotMatured.selector);
        vault.redeem(units, alice);
    }

    function test_StripRevertsAtMaturity() public {
        vm.warp(vault.maturity());
        vm.prank(alice);
        vm.expectRevert(XeroVault.Matured.selector);
        vault.strip(1 ether, alice);
    }

    // ------------------------------------------------------------ splits and freezes

    function test_AttestedSplitIsNotYield() public {
        uint256 units = _strip(alice, 100 ether);
        uint256 i0 = vault.dividendIndex();
        _split(4, 1); // the CRWD case: multiplier x4
        vault.sync();
        assertFalse(vault.frozen());
        assertEq(vault.structuralFactor(), 4e18);
        assertEq(vault.dividendIndex(), i0, "dividend index unchanged by a split");
        assertEq(vault.claimYield(alice), 0, "no phantom 300% yield");

        vm.prank(alice);
        assertApproxEqAbs(vault.recombine(units, alice), 100 ether, 1, "raw tokens never change");
    }

    function test_UnattestedSplitFreezesUntilAttested() public {
        uint256 units = _strip(alice, 100 ether);
        vm.prank(issuer);
        aapl.split(4, 1);
        vault.sync();
        assertTrue(vault.frozen());
        assertEq(vault.claimYield(alice), 0);

        vm.prank(bob);
        vm.expectRevert(XeroVault.VaultFrozen.selector);
        vault.strip(1 ether, bob);

        _report(ICorporateActionEngine.ActionType.FORWARD_SPLIT, uint64(block.timestamp), 4e18, 1e18);
        vault.sync();
        assertFalse(vault.frozen());
        assertEq(vault.claimYield(alice), 0);
        vm.prank(alice);
        assertApproxEqAbs(vault.recombine(units, alice), 100 ether, 1);
    }

    function test_RecombineWorksWhileFrozen() public {
        uint256 units = _strip(alice, 100 ether);
        _reinvest(1e18, 100e18);
        vm.prank(issuer);
        aapl.split(2, 1); // unattested
        uint256 y = vault.claimYield(alice);
        vm.prank(alice);
        uint256 raw = vault.recombine(units, alice);
        assertTrue(vault.frozen());
        assertApproxEqAbs(raw + y, 100 ether, 3, "pair exit is exact whatever the frozen change is");
    }

    function test_ScheduledSplitAppliesAtEffectiveTime() public {
        _strip(alice, 100 ether);
        uint64 at = uint64(block.timestamp + 3 days);
        uint256 target = aapl.uiMultiplier() * 10;
        vm.prank(issuer);
        aapl.updateMultiplier(target, at);
        _report(ICorporateActionEngine.ActionType.FORWARD_SPLIT, at, 10e18, 1e18);
        vault.sync();
        assertEq(vault.structuralFactor(), 1e18);
        vm.warp(at);
        vault.sync();
        assertEq(vault.structuralFactor(), 10e18);
        assertFalse(vault.frozen());
        assertEq(vault.claimYield(alice), 0);
    }

    function test_ReverseSplitAndStockDividendAreStructural() public {
        _strip(alice, 100 ether);
        _split(1, 4);
        uint256 target = aapl.uiMultiplier() * 105 / 100;
        vm.prank(issuer);
        aapl.updateMultiplier(target);
        _report(ICorporateActionEngine.ActionType.STOCK_DIVIDEND, uint64(block.timestamp), 1.05e18, 1e18);
        vault.sync();
        assertFalse(vault.frozen());
        assertEq(vault.claimYield(alice), 0);
    }

    function test_OraclePauseFreezesAccrual() public {
        _strip(alice, 100 ether);
        vm.prank(issuer);
        aapl.setOraclePaused(true);
        _reinvest(1e18, 100e18);
        vault.sync();
        assertTrue(vault.frozen());
        assertEq(vault.claimYield(alice), 0);
        vm.prank(issuer);
        aapl.setOraclePaused(false);
        assertGt(vault.claimYield(alice), 0);
    }

    function test_LargeSpecialDividendNeedsAttestation() public {
        _strip(alice, 100 ether);
        _reinvest(10e18, 100e18); // 10% special dividend > 5% default bound
        vault.sync();
        assertTrue(vault.frozen());
        _report(CASH, uint64(block.timestamp), 10e18, 0.12e18);
        uint256 y = vault.claimYield(alice);
        assertFalse(vault.frozen());
        assertApproxEqRel(y, uint256(100 ether) * 10 / 110, 1e12);
    }

    function test_FrozenAtMaturityBlocksRedemptionUntilResolved() public {
        uint256 units = _strip(alice, 100 ether);
        vm.warp(vault.maturity());
        vm.prank(issuer);
        aapl.split(2, 1); // unattested at maturity
        vm.prank(alice);
        vm.expectRevert(XeroVault.MaturityNotSettled.selector);
        vault.redeem(units, alice);

        _report(ICorporateActionEngine.ActionType.FORWARD_SPLIT, uint64(block.timestamp), 2e18, 1e18);
        vm.prank(alice);
        assertApproxEqAbs(vault.redeem(units, alice), 100 ether, 1);
    }

    function test_UnsupportedActionHaltsStrippingButNotExits() public {
        uint256 units = _strip(alice, 100 ether);
        _report(ICorporateActionEngine.ActionType.CASH_MERGER, uint64(block.timestamp), 0, 0);
        assertTrue(guardian.assetHalted(address(aapl)));
        vm.prank(bob);
        vm.expectRevert(RiskGuardian.AssetHaltedForAction.selector);
        vault.strip(1 ether, bob);
        vm.prank(alice);
        assertApproxEqAbs(vault.recombine(units, alice), 100 ether, 1);
    }

    function test_NewVaultStartsAtCurrentMultiplier() public {
        _split(4, 1);
        XeroVault v2 = _createVault(T0 + 180 days, "6M");
        assertEq(v2.dividendIndex(), aapl.uiMultiplier());
        assertEq(v2.structuralFactor(), WAD);
        assertEq(v2.actionCursor(), 1);
    }

    function test_LateSplitAttestationAfterVaultCreationIsNotDoubleCounted() public {
        vm.prank(issuer);
        aapl.split(4, 1); // applied on-chain, not yet attested
        vm.warp(block.timestamp + 1 hours);
        XeroVault v2 = _createVault(T0 + 180 days, "6M"); // starts at the post-split multiplier
        vm.warp(block.timestamp + 2 days);
        _report(ICorporateActionEngine.ActionType.FORWARD_SPLIT, T0, 4e18, 1e18); // attested late
        v2.sync();
        assertFalse(v2.frozen(), "pre-creation split must not be applied again");
        assertEq(v2.structuralFactor(), WAD);
        vault.sync();
        assertEq(vault.structuralFactor(), 4e18, "older vault still applies it");
        assertFalse(vault.frozen());
    }

    function test_StructuralActionsCanBeAttestedLate() public {
        vm.prank(issuer);
        aapl.split(2, 1);
        vm.warp(block.timestamp + 10 days);
        vault.sync();
        assertTrue(vault.frozen());
        _report(ICorporateActionEngine.ActionType.FORWARD_SPLIT, T0, 2e18, 1e18);
        vault.sync();
        assertFalse(vault.frozen());
    }

    // ------------------------------------------------------------ risk controls

    function test_PauseBlocksNewRiskButNeverExits() public {
        uint256 units = _strip(alice, 100 ether);
        _reinvest(1e18, 100e18);
        vm.prank(admin);
        guardian.setGlobalPause(true);
        vm.prank(bob);
        vm.expectRevert(RiskGuardian.ProtocolPaused.selector);
        vault.strip(1 ether, bob);
        assertGt(vault.claimYield(alice), 0);
        vm.prank(alice);
        vault.recombine(units, alice);
    }

    function test_YieldHookOnlyCallableByYieldToken() public {
        vm.expectRevert(XeroVault.OnlyYieldToken.selector);
        vault.onYieldTransfer(alice, bob);
    }

    function test_NonOwnerCannotLoosenGrowthBound() public {
        vm.prank(alice);
        vm.expectRevert(XeroFactory.InvalidGrowthBound.selector);
        factory.createVault(address(aapl), T0 + 30 days, "1M", 0.2e18);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_ConservationThroughDividendsAndSplits(uint256 raw, uint256 d1, uint256 d2, bool doSplit) public {
        raw = bound(raw, 1e9, 5_000 ether);
        d1 = bound(d1, 0, 4e16); // up to 4% per event
        d2 = bound(d2, 0, 4e16);
        uint256 units = _strip(alice, raw);
        if (d1 > 0) _reinvest(d1, 1e18);
        if (doSplit) _split(3, 1);
        if (d2 > 0) _reinvest(d2, 1e18);
        assertTrue(vault.invariantHolds());
        uint256 y = vault.claimYield(alice);
        vm.prank(alice);
        uint256 p = vault.recombine(units, alice);
        assertLe(p + y, raw);
        assertApproxEqAbs(p + y, raw, 4);
    }
}
