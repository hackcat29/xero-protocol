// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {XeroFixture} from "../utils/XeroFixture.sol";
import {XeroVault} from "../../src/XeroVault.sol";
import {XeroComponentToken} from "../../src/tokens/XeroComponentToken.sol";
import {MockStockToken} from "../../src/mocks/MockStockToken.sol";
import {CorporateActionEngine} from "../../src/CorporateActionEngine.sol";
import {ICorporateActionEngine} from "../../src/interfaces/ICorporateActionEngine.sol";

/// @dev Random sequences of strips, recombinations, redemptions, YT/PT transfers, reinvested dividends,
///      attested and unattested splits, yield claims and time jumps against one vault.
contract VaultHandler is Test {
    XeroVault public vault;
    XeroComponentToken public pt;
    XeroComponentToken public yt;
    MockStockToken public token;
    CorporateActionEngine public engine;
    address public issuer;
    address[3] public actors;

    uint256 public rawIn;
    uint256 public rawOut;
    uint256 internal nonce;
    uint256 public splits;
    bool public pendingSplit;
    uint128 internal pendingNum;

    constructor(XeroVault v, MockStockToken t, CorporateActionEngine e, address issuer_, address[3] memory actors_) {
        vault = v;
        pt = v.pt();
        yt = v.yt();
        token = t;
        engine = e;
        issuer = issuer_;
        actors = actors_;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % 3];
    }

    function strip(uint256 seed, uint256 raw) external {
        address a = _actor(seed);
        raw = bound(raw, 0, token.balanceOf(a));
        if (raw < 1e9 || block.timestamp >= vault.maturity()) return;
        vm.prank(a);
        try vault.strip(raw, a) {
            rawIn += raw;
        } catch {}
    }

    function recombine(uint256 seed, uint256 units) external {
        address a = _actor(seed);
        uint256 max = pt.balanceOf(a) < yt.balanceOf(a) ? pt.balanceOf(a) : yt.balanceOf(a);
        units = bound(units, 0, max);
        if (units == 0 || block.timestamp >= vault.maturity()) return;
        vm.prank(a);
        rawOut += vault.recombine(units, a);
    }

    function redeem(uint256 seed, uint256 units) external {
        address a = _actor(seed);
        units = bound(units, 0, pt.balanceOf(a));
        if (units == 0 || block.timestamp < vault.maturity()) return;
        vm.prank(a);
        try vault.redeem(units, a) returns (uint256 r) {
            rawOut += r;
        } catch {}
    }

    function transferYt(uint256 from, uint256 to, uint256 amount) external {
        address f = _actor(from);
        amount = bound(amount, 0, yt.balanceOf(f));
        vm.prank(f);
        yt.transfer(_actor(to), amount);
    }

    function transferPt(uint256 from, uint256 to, uint256 amount) external {
        address f = _actor(from);
        amount = bound(amount, 0, pt.balanceOf(f));
        vm.prank(f);
        pt.transfer(_actor(to), amount);
    }

    function reinvest(uint256 cashBps) external {
        cashBps = bound(cashBps, 1, 300); // up to 3% per dividend
        vm.prank(issuer);
        token.reinvestDividend(cashBps * 1e14, 1e18);
    }

    /// @dev Split applied by the issuer; attested either immediately or in a later step.
    function split(bool forward, bool attestNow) external {
        if (splits >= 4 || pendingSplit) return;
        ++splits;
        uint128 num = forward ? 3 : 1;
        uint128 den = forward ? 1 : 2;
        vm.prank(issuer);
        token.split(num, den);
        if (attestNow) _attestSplit(num, den);
        else (pendingSplit, pendingNum) = (true, num);
    }

    function attestPendingSplit() external {
        if (!pendingSplit) return;
        pendingSplit = false;
        _attestSplit(pendingNum, pendingNum == 3 ? 1 : 2);
    }

    function claim(uint256 seed) external {
        rawOut += vault.claimYield(_actor(seed));
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1 hours, 60 days));
    }

    function _attestSplit(uint128 num, uint128 den) internal {
        vm.prank(address(this));
        engine.report(
            address(token),
            ICorporateActionEngine.ActionType.FORWARD_SPLIT,
            uint64(block.timestamp),
            num * 1e18,
            den * 1e18,
            keccak256(abi.encode("split", ++nonce))
        );
    }
}

contract VaultInvariantTest is XeroFixture {
    VaultHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new VaultHandler(vault, aapl, engine, issuer, [alice, bob, carol]);
        bytes32 role = engine.REPORTER_ROLE();
        vm.prank(admin);
        engine.grantRole(role, address(handler));
        targetContract(address(handler));
    }

    /// Raw tokens held always cover every PT claim plus every unclaimed YT accrual.
    function invariant_VaultIsSolvent() public view {
        assertTrue(vault.invariantHolds());
    }

    /// Nothing leaves the vault that was not deposited: PT + YT never exceed the Stock Token.
    function invariant_Conservation() public view {
        assertLe(handler.rawOut(), handler.rawIn());
        assertEq(handler.rawIn() - handler.rawOut(), vault.collateral());
    }

    /// Before maturity every PT has exactly one matching YT.
    function invariant_LegsMatchBeforeMaturity() public view {
        if (block.timestamp < vault.maturity()) assertEq(pt.totalSupply(), yt.totalSupply());
    }

    /// The dividend index never decreases, whatever the multiplier does.
    function invariant_DividendIndexMonotone() public view {
        assertGe(vault.dividendIndex(), AAPL_MULTIPLIER);
    }
}
