// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {MockUSDG} from "../../src/mocks/MockUSDG.sol";
import {RiskGuardian} from "../../src/RiskGuardian.sol";
import {CorporateActionEngine} from "../../src/CorporateActionEngine.sol";
import {ICorporateActionEngine} from "../../src/interfaces/ICorporateActionEngine.sol";
import {IRiskGuardian} from "../../src/interfaces/IRiskGuardian.sol";
import {IStockToken} from "../../src/interfaces/IScaledUIAmount.sol";
import {XeroFactory} from "../../src/XeroFactory.sol";
import {XeroVault} from "../../src/XeroVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Runs Xero against the real Robinhood Stock Token contracts on a fork of Robinhood Chain.
///         Skipped unless ROBINHOOD_RPC_URL is set, e.g.
///         ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com forge test --match-path test/fork/*
contract RobinhoodForkTest is Test {
    address internal constant AAPL = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address internal constant SCHD = 0xd63ABB2C13d7a8421a8017a712802053568e3C1D;
    address internal constant CRWD = 0xea72Ecca2d0f6bFA1394DBBCff85b52CD4233931;
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    XeroFactory internal factory;
    RiskGuardian internal guardian;
    CorporateActionEngine internal engine;
    bool internal enabled;

    function setUp() public {
        string memory rpc = vm.envOr("ROBINHOOD_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        enabled = true;

        guardian = new RiskGuardian(admin);
        engine = new CorporateActionEngine(admin, IRiskGuardian(address(guardian)), 1);
        factory = new XeroFactory(
            admin, IERC20(USDG), ICorporateActionEngine(address(engine)), IRiskGuardian(address(guardian)), admin
        );
        bytes32 engineRole = guardian.ENGINE_ROLE();
        vm.startPrank(admin);
        guardian.grantRole(engineRole, address(engine));
        guardian.setAssetAllowed(AAPL, true);
        guardian.setAssetAllowed(SCHD, true);
        guardian.setAssetAllowed(CRWD, true);
        vm.stopPrank();
    }

    function test_Fork_RealTokensExposeErc8056() public view {
        if (!enabled) return;
        address[3] memory tokens = [AAPL, SCHD, CRWD];
        for (uint256 i; i < 3; ++i) {
            IStockToken t = IStockToken(tokens[i]);
            assertGe(t.uiMultiplier(), 1e17);
            assertEq(t.balanceOfUI(address(0xdead)), t.balanceOf(address(0xdead)) * t.uiMultiplier() / 1e18);
            t.oraclePaused();
        }
        assertEq(IStockToken(CRWD).uiMultiplier(), 4e18, "CRWD 4:1 split lives in the multiplier");
    }

    function test_Fork_StripAndRecombineRealAapl() public {
        if (!enabled) return;
        vm.prank(admin);
        XeroVault vault = XeroVault(factory.createVault(AAPL, uint64(block.timestamp + 180 days), "6M", 0));
        assertEq(vault.dividendIndex(), IStockToken(AAPL).uiMultiplier());

        deal(AAPL, alice, 10 ether);
        vm.startPrank(alice);
        IERC20(AAPL).approve(address(vault), type(uint256).max);
        uint256 units = vault.strip(10 ether, alice);
        assertEq(IERC20(AAPL).balanceOf(address(vault)), 10 ether);
        assertTrue(vault.invariantHolds());
        uint256 back = vault.recombine(units, alice);
        vm.stopPrank();
        assertApproxEqAbs(back, 10 ether, 1);
    }

    function test_Fork_DividendGrowthAccruesToYield() public {
        if (!enabled) return;
        vm.prank(admin);
        XeroVault vault = XeroVault(factory.createVault(SCHD, uint64(block.timestamp + 365 days), "1Y", 0));
        deal(SCHD, alice, 100 ether);
        vm.startPrank(alice);
        IERC20(SCHD).approve(address(vault), type(uint256).max);
        uint256 units = vault.strip(100 ether, alice);
        vm.stopPrank();

        // Simulate the next quarterly reinvestment (~0.9%) on the real contract's multiplier.
        uint256 m = IStockToken(SCHD).uiMultiplier();
        vm.mockCall(SCHD, abi.encodeWithSignature("uiMultiplier()"), abi.encode(m * 1009 / 1000));
        uint256 y = vault.claimYield(alice);
        vm.prank(alice);
        uint256 p = vault.recombine(units, alice);
        assertApproxEqRel(y, uint256(100 ether) * 9 / 1009, 1e12);
        assertApproxEqAbs(p + y, 100 ether, 3);
    }

    function test_Fork_RealSplitMultiplierIsNotYieldOnceAttested() public {
        if (!enabled) return;
        vm.prank(admin);
        XeroVault vault = XeroVault(factory.createVault(CRWD, uint64(block.timestamp + 90 days), "3M", 0));
        deal(CRWD, alice, 1 ether);
        vm.startPrank(alice);
        IERC20(CRWD).approve(address(vault), type(uint256).max);
        vault.strip(1 ether, alice);
        vm.stopPrank();

        uint256 m = IStockToken(CRWD).uiMultiplier();
        vm.mockCall(CRWD, abi.encodeWithSignature("uiMultiplier()"), abi.encode(m * 2));
        vault.sync();
        assertTrue(vault.frozen(), "unattested 2:1 split freezes the vault");

        bytes32 role = engine.REPORTER_ROLE();
        vm.prank(admin);
        engine.grantRole(role, admin);
        vm.prank(admin);
        engine.report(CRWD, ICorporateActionEngine.ActionType.FORWARD_SPLIT, uint64(block.timestamp), 2e18, 1e18, "x");
        assertEq(vault.claimYield(alice), 0);
        assertFalse(vault.frozen());
    }
}
