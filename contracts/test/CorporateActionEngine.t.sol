// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {XeroFixture} from "./utils/XeroFixture.sol";
import {CorporateActionEngine} from "../src/CorporateActionEngine.sol";
import {ICorporateActionEngine} from "../src/interfaces/ICorporateActionEngine.sol";

contract CorporateActionEngineTest is XeroFixture {
    ICorporateActionEngine.ActionType internal constant CASH = ICorporateActionEngine.ActionType.CASH_DIVIDEND;
    ICorporateActionEngine.ActionType internal constant SPLIT = ICorporateActionEngine.ActionType.FORWARD_SPLIT;

    function _twoReporters() internal returns (address r2) {
        r2 = makeAddr("reporter2");
        bytes32 role = engine.REPORTER_ROLE();
        vm.startPrank(admin);
        engine.grantRole(role, r2);
        engine.setQuorum(2);
        vm.stopPrank();
    }

    function test_RequiresQuorumOfDistinctReporters() public {
        address r2 = _twoReporters();
        vm.prank(reporter);
        assertFalse(engine.report(address(aapl), SPLIT, uint64(block.timestamp), 4e18, 1e18, "q1"));
        assertEq(engine.actionCount(address(aapl)), 0);
        vm.prank(reporter);
        vm.expectRevert(CorporateActionEngine.AlreadyConfirmed.selector);
        engine.report(address(aapl), SPLIT, uint64(block.timestamp), 4e18, 1e18, "q1");
        vm.prank(r2);
        assertTrue(engine.report(address(aapl), SPLIT, uint64(block.timestamp), 4e18, 1e18, "q1"));
        assertEq(engine.actionCount(address(aapl)), 1);
    }

    function test_ConflictingPayloadsDoNotCombine() public {
        address r2 = _twoReporters();
        vm.prank(reporter);
        engine.report(address(aapl), SPLIT, uint64(block.timestamp), 4e18, 1e18, "q");
        vm.prank(r2);
        assertFalse(engine.report(address(aapl), SPLIT, uint64(block.timestamp), 5e18, 1e18, "q"));
        assertEq(engine.actionCount(address(aapl)), 0);
    }

    function test_RejectsUnauthorisedReporter() public {
        vm.prank(alice);
        vm.expectRevert();
        engine.report(address(aapl), SPLIT, uint64(block.timestamp), 4e18, 1e18, "x");
    }

    function test_RejectsStaleAndFarFutureActions() public {
        vm.startPrank(reporter);
        vm.expectRevert(CorporateActionEngine.StaleAction.selector);
        engine.report(address(aapl), CASH, uint64(block.timestamp - 2 days), 0.26e18, 0.01e18, "a");
        vm.expectRevert(CorporateActionEngine.StaleAction.selector);
        engine.report(address(aapl), SPLIT, uint64(block.timestamp - 31 days), 4e18, 1e18, "a2");
        engine.report(address(aapl), SPLIT, uint64(block.timestamp - 10 days), 4e18, 1e18, "late split ok");
        vm.expectRevert(CorporateActionEngine.ActionTooFar.selector);
        engine.report(address(aapl), SPLIT, uint64(block.timestamp + 200 days), 4e18, 1e18, "b");
        vm.stopPrank();
    }

    function test_EnforcesOrderAndUniqueRefs() public {
        vm.startPrank(reporter);
        engine.report(address(aapl), SPLIT, uint64(block.timestamp + 10 days), 4e18, 1e18, "a");
        vm.expectRevert(CorporateActionEngine.ActionOutOfOrder.selector);
        engine.report(address(aapl), SPLIT, uint64(block.timestamp + 5 days), 4e18, 1e18, "b");
        vm.expectRevert(CorporateActionEngine.DuplicateRef.selector);
        engine.report(address(aapl), SPLIT, uint64(block.timestamp + 10 days), 4e18, 1e18, "a");
        vm.stopPrank();
    }

    function test_ValidatesPayloads() public {
        vm.startPrank(reporter);
        vm.expectRevert(CorporateActionEngine.InvalidAction.selector);
        engine.report(address(aapl), CASH, uint64(block.timestamp), 0.26e18, 0, "no allowance");
        vm.expectRevert(CorporateActionEngine.InvalidAction.selector);
        engine.report(address(aapl), CASH, uint64(block.timestamp), 0.26e18, 0.6e18, "allowance too large");
        vm.expectRevert(CorporateActionEngine.InvalidAction.selector);
        engine.report(address(aapl), SPLIT, uint64(block.timestamp), 1000e18, 1e18, "ratio too large");
        vm.expectRevert(CorporateActionEngine.InvalidAction.selector);
        engine.report(address(aapl), SPLIT, uint64(block.timestamp), 2e18, 2e18, "no-op");
        vm.stopPrank();
    }

    function test_ClassifiesRobinhoodActionTypes() public view {
        assertTrue(engine.isStructural(ICorporateActionEngine.ActionType.FORWARD_SPLIT));
        assertTrue(engine.isStructural(ICorporateActionEngine.ActionType.REVERSE_SPLIT));
        assertTrue(engine.isStructural(ICorporateActionEngine.ActionType.STOCK_DIVIDEND));
        assertFalse(engine.isStructural(CASH));
        assertTrue(engine.isSupported(ICorporateActionEngine.ActionType.NAME_CHANGE));
        assertFalse(engine.isSupported(ICorporateActionEngine.ActionType.SPIN_OFF));
        assertFalse(engine.isSupported(ICorporateActionEngine.ActionType.UNIT_SPLIT));
        assertFalse(engine.isSupported(ICorporateActionEngine.ActionType.STOCK_MERGER));
    }
}
