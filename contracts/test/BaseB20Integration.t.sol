// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockB20StockToken} from "../src/mocks/MockB20StockToken.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {RiskGuardian} from "../src/RiskGuardian.sol";
import {CorporateActionEngine} from "../src/CorporateActionEngine.sol";
import {ICorporateActionEngine} from "../src/interfaces/ICorporateActionEngine.sol";
import {IRiskGuardian} from "../src/interfaces/IRiskGuardian.sol";
import {IXeroMath} from "../src/interfaces/IXeroMath.sol";
import {XeroFactory} from "../src/XeroFactory.sol";
import {XeroVault} from "../src/XeroVault.sol";
import {XeroMathSol} from "../src/math/XeroMathSol.sol";
import {XeroOracle, IAggregatorV3} from "../src/oracle/XeroOracle.sol";
import {YieldMarketFactory, IVaultRegistry} from "../src/market/YieldMarketFactory.sol";
import {XeroYieldMarket} from "../src/market/XeroYieldMarket.sol";
import {BaseB20YieldLens} from "../src/lens/BaseB20YieldLens.sol";
import {IXeroOracle} from "../src/interfaces/IXeroOracle.sol";

contract BaseB20IntegrationTest is Test {
    uint256 internal constant WAD = 1e18;

    address internal deployer = address(0xD);
    address internal alice = address(0xA); // Fixed yield sourcer & depositor
    address internal bob = address(0xB);   // Dividend speculator
    address internal charlie = address(0xC); // Discounted stock buyer

    MockUSDG internal usdc;
    RiskGuardian internal guardian;
    CorporateActionEngine internal engine;
    XeroFactory internal factory;
    IXeroMath internal math;
    YieldMarketFactory internal markets;
    XeroOracle internal oracle;
    BaseB20YieldLens internal lens;

    MockB20StockToken internal nvdac; // Coinbase B20 Nvidia
    MockB20StockToken internal coinc; // Coinbase B20 Coinbase Global
    MockB20StockToken internal schdc; // Coinbase B20 Schwab US Dividend ETF

    XeroVault internal nvdaVault;
    XeroYieldMarket internal nvdaMarket;

    uint64 internal constant TENOR_90D = 90 days;

    function setUp() public {
        vm.startPrank(deployer);

        usdc = new MockUSDG();
        guardian = new RiskGuardian(deployer);
        engine = new CorporateActionEngine(deployer, IRiskGuardian(address(guardian)), 1);
        factory = new XeroFactory(
            deployer, usdc, ICorporateActionEngine(address(engine)), IRiskGuardian(address(guardian)), deployer
        );
        math = IXeroMath(address(new XeroMathSol()));
        markets = new YieldMarketFactory(deployer, IVaultRegistry(address(factory)), IRiskGuardian(address(guardian)), math);
        oracle = new XeroOracle(deployer, 4 days);
        lens = new BaseB20YieldLens(IXeroOracle(address(oracle)));

        guardian.grantRole(guardian.ENGINE_ROLE(), address(engine));
        engine.grantRole(engine.REPORTER_ROLE(), deployer);
        factory.setFees(0, 0, 0, 0); // 0 fees for clean math verification

        // Deploy Coinbase B20 Mock Tokens
        nvdac = new MockB20StockToken("Coinbase B20 Nvidia", "NVDAc", deployer);
        nvdac.updateMultiplier(1.0000e18); // Base multiplier 1.0

        coinc = new MockB20StockToken("Coinbase B20 Coinbase", "COINc", deployer);
        coinc.updateMultiplier(1.0050e18);

        schdc = new MockB20StockToken("Coinbase B20 Schwab Dividend ETF", "SCHDc", deployer);
        schdc.updateMultiplier(1.0250e18);

        guardian.setAssetAllowed(address(nvdac), true);
        guardian.setAssetAllowed(address(coinc), true);
        guardian.setAssetAllowed(address(schdc), true);

        // Chainlink Oracles: NVDA = $130, COIN = $220, SCHD = $28
        MockAggregator nvdaFeed = new MockAggregator(int256(130e18 / 1e10));
        MockAggregator coinFeed = new MockAggregator(int256(220e18 / 1e10));
        MockAggregator schdFeed = new MockAggregator(int256(28e18 / 1e10));
        oracle.configureAsset(address(nvdac), IAggregatorV3(address(nvdaFeed)), 0);
        oracle.configureAsset(address(coinc), IAggregatorV3(address(coinFeed)), 0);
        oracle.configureAsset(address(schdc), IAggregatorV3(address(schdFeed)), 0);

        // Create 90-day Vault for NVDAc
        uint64 maturity = uint64(block.timestamp + TENOR_90D);
        nvdaVault = XeroVault(factory.createVault(address(nvdac), maturity, "90D", 0));

        // Create Yield Market AMM for NVDAc
        uint256 refPrice = 0.0037e18;
        int256 rate = int256(0.015e18);
        int256 scalar = int256(uint256(8e36) / 15e15);
        nvdaMarket = XeroYieldMarket(markets.createPool(address(nvdaVault), refPrice, scalar, 0.003e18));

        // Seed liquidity in market
        nvdac.mint(deployer, 10_000 ether);
        nvdac.approve(address(nvdaVault), type(uint256).max);
        uint256 seedUnits = nvdaVault.strip(500 ether, deployer);
        nvdaVault.yt().approve(address(nvdaMarket), type(uint256).max);
        nvdac.approve(address(nvdaMarket), type(uint256).max);
        nvdaMarket.initialize(seedUnits, 5 ether, rate, deployer);

        // Mint test tokens to actors
        nvdac.mint(alice, 100 ether);
        nvdac.mint(bob, 100 ether);
        nvdac.mint(charlie, 100 ether);

        vm.stopPrank();
    }

    /// @notice 1. Test Deposit & Minting PT and YT deconstructing the B20 Multiplier
    function test_DepositMintingPTandYT() public {
        uint256 depositRaw = 10 ether; // 10 NVDAc shares
        uint256 initialMultiplier = nvdac.uiMultiplier();
        assertEq(initialMultiplier, 1.0000e18);

        vm.startPrank(alice);
        nvdac.approve(address(nvdaVault), depositRaw);
        uint256 units = nvdaVault.strip(depositRaw, alice);
        vm.stopPrank();

        // Check minting
        assertEq(units, depositRaw); // At multiplier 1.0, 10 raw tokens = 10 PT + 10 YT
        assertEq(nvdaVault.pt().balanceOf(alice), 10 ether);
        assertEq(nvdaVault.yt().balanceOf(alice), 10 ether);

        // Check vault solvency invariant
        assertTrue(nvdaVault.invariantHolds());

        // Check lens overview
        BaseB20YieldLens.B20VaultOverview memory ov = lens.getVaultOverview(address(nvdaVault), alice);
        assertEq(ov.userPtBalance, 10 ether);
        assertEq(ov.userYtBalance, 10 ether);
        assertEq(ov.userClaimableYieldRaw, 0);
        assertFalse(ov.isMatured);
    }

    /// @notice 2. Streaming Yield to YT Holders as Multiplier Escalates from Reinvested Dividends
    function test_StreamingYieldDeltaOnMultiplierUpdate() public {
        uint256 depositRaw = 10 ether;
        vm.startPrank(alice);
        nvdac.approve(address(nvdaVault), depositRaw);
        nvdaVault.strip(depositRaw, alice);
        vm.stopPrank();

        uint256 lastClaimM = nvdac.uiMultiplier();

        // Simulate Nvidia quarterly cash dividend: $0.10 per share on $130 price
        vm.prank(deployer);
        nvdac.reinvestDividend(0.10e18, 130e18);

        uint256 currentM = nvdac.uiMultiplier();
        assertTrue(currentM > lastClaimM);

        // Sync vault to capture the updated multiplier into the dividend index
        nvdaVault.sync();

        // Yield calculation via lens
        uint256 expectedYield = lens.calculateAccumulatedYield(10 ether, currentM, lastClaimM);
        uint256 claimableInVault = nvdaVault.claimable(alice);

        assertApproxEqAbs(claimableInVault, expectedYield, 1e12);
        assertTrue(claimableInVault > 0);

        // Alice claims the accumulated dividend yield
        uint256 balBefore = nvdac.balanceOf(alice);
        vm.prank(alice);
        nvdaVault.claimYield(alice);
        uint256 balAfter = nvdac.balanceOf(alice);

        assertEq(balAfter - balBefore, claimableInVault);
        assertTrue(nvdaVault.invariantHolds());
    }

    /// @notice 3. Redemption at Maturity: PT redeems baseline capital value, YT expires
    function test_RedemptionAtMaturity() public {
        uint256 depositRaw = 10 ether;
        vm.startPrank(alice);
        nvdac.approve(address(nvdaVault), depositRaw);
        nvdaVault.strip(depositRaw, alice);
        vm.stopPrank();

        // Reinvest a dividend before maturity
        vm.prank(deployer);
        nvdac.reinvestDividend(0.50e18, 130e18);
        nvdaVault.sync();

        // Claim yield before maturity
        vm.prank(alice);
        nvdaVault.claimYield(alice);

        // Fast-forward to maturity date (T)
        vm.warp(nvdaVault.maturity() + 1);

        // Settle maturity
        nvdaVault.sync();
        assertTrue(nvdaVault.maturityIndex() > 0);

        // Alice redeems her PT
        uint256 ptBal = nvdaVault.pt().balanceOf(alice);
        assertEq(ptBal, 10 ether);

        uint256 aliceBalBefore = nvdac.balanceOf(alice);
        vm.startPrank(alice);
        nvdaVault.pt().approve(address(nvdaVault), ptBal);
        uint256 rawRedeemed = nvdaVault.redeem(ptBal, alice);
        vm.stopPrank();

        uint256 aliceBalAfter = nvdac.balanceOf(alice);
        assertEq(aliceBalAfter - aliceBalBefore, rawRedeemed);

        uint256 expectedBaseline = (ptBal * WAD) / nvdaVault.maturityIndex();
        assertEq(rawRedeemed, expectedBaseline);

        // Solvency check
        assertTrue(nvdaVault.invariantHolds());
    }

    /// @notice 4. Use Case: Fixed Yield Sourcing (Sell YT upfront on AMM)
    function test_UseCase_FixedYieldSourcing() public {
        vm.startPrank(alice);
        nvdac.approve(address(nvdaVault), 10 ether);
        nvdaVault.strip(10 ether, alice);

        // Alice sells her 10 YT on the Yield Market AMM for upfront NVDAc
        uint256 ytToSell = 10 ether;
        nvdaVault.yt().approve(address(nvdaMarket), ytToSell);

        uint256 baseBefore = nvdac.balanceOf(alice);
        uint256 quoteOut = nvdaMarket.swapExactYtForQuote(ytToSell, 0, alice);
        uint256 baseAfter = nvdac.balanceOf(alice);

        assertTrue(quoteOut > 0);
        assertEq(baseAfter - baseBefore, quoteOut);
        vm.stopPrank();
    }

    /// @notice 5. Use Case: Dividend Speculation (Buy YT for capital-efficient dividend exposure)
    function test_UseCase_DividendSpeculation() public {
        vm.startPrank(bob);
        nvdac.approve(address(nvdaMarket), 0.1 ether);
        uint256 ytBought = nvdaMarket.swapExactQuoteForYt(0.1 ether, 0, bob);
        assertTrue(ytBought > 1 ether);
        vm.stopPrank();

        // Company declares a large dividend hike
        vm.prank(deployer);
        nvdac.reinvestDividend(2.00e18, 130e18);
        nvdaVault.sync();

        uint256 claimable = nvdaVault.claimable(bob);
        assertTrue(claimable > 0);

        uint256 balBefore = nvdac.balanceOf(bob);
        vm.prank(bob);
        nvdaVault.claimYield(bob);
        uint256 balAfter = nvdac.balanceOf(bob);
        assertEq(balAfter - balBefore, claimable);
    }

    /// @notice 6. Use Case: Discounted Stock Buying (Buy PT at markdown, hold to maturity)
    function test_UseCase_DiscountedStockBuying() public view {
        uint256 spotPrice = 130e18;
        uint256 ptPrice = 125e18; // $5 discount
        BaseB20YieldLens.DiscountedStockQuote memory q = lens.getDiscountedStockQuote(
            address(nvdac),
            ptPrice,
            TENOR_90D
        );
        assertEq(q.spotPriceUsd, spotPrice);
        assertEq(q.ptPriceUsd, ptPrice);
        assertEq(q.discountUsd, 5e18);
        assertTrue(q.fixedApyBps > 0);
    }

    /// @notice 7. Stock Split Immunity: Attested split increases multiplier without phantom dividend yield
    function test_StockSplitImmunity() public {
        vm.startPrank(alice);
        nvdac.approve(address(nvdaVault), 10 ether);
        nvdaVault.strip(10 ether, alice);
        vm.stopPrank();

        // Attest a 2:1 stock split on CorporateActionEngine
        vm.startPrank(deployer);
        uint64 effectiveTime = uint64(block.timestamp);
        engine.report(
            address(nvdac),
            ICorporateActionEngine.ActionType.FORWARD_SPLIT,
            effectiveTime,
            2e18,
            1e18,
            keccak256("split-nvda-1")
        );

        // B20 token executes the 2:1 split
        nvdac.split(2, 1);
        vm.stopPrank();

        // Sync vault: the structural factor absorbs the split ratio, keeping dividendIndex constant
        uint256 idxBefore = nvdaVault.dividendIndex();
        nvdaVault.sync();
        uint256 idxAfter = nvdaVault.dividendIndex();

        assertEq(idxAfter, idxBefore);
        assertEq(nvdaVault.claimable(alice), 0);
    }
}
