// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {XeroVault} from "../src/XeroVault.sol";
import {XeroYieldMarket} from "../src/market/XeroYieldMarket.sol";

/// @notice Opens one Yield Token market: strips Stock Tokens for the YT side and seeds both reserves at
///         the configured opening yield. Must be run by the market's creator (the deployer).
///
///   MARKET=0x... UNITS=20000e18 OPENING_YIELD=0.037e18 forge script script/SeedMarket.s.sol \
///     --rpc-url $ROBINHOOD_RPC_URL --broadcast --account deployer
contract SeedMarket is Script {
    uint256 internal constant WAD = 1e18;

    function run() external {
        XeroYieldMarket market = XeroYieldMarket(vm.envAddress("MARKET"));
        uint256 units = vm.envUint("UNITS");
        uint256 openingYield = vm.envUint("OPENING_YIELD");
        XeroVault vault = XeroVault(address(market.vault()));
        IERC20 token = IERC20(vault.underlying());

        int256 rate = int256(openingYield * WAD / vault.dividendIndex());
        uint256 quoteSeed = units * market.refPrice() / WAD; // 50/50 by value at the reference price
        uint256 raw = units * WAD / vault.dividendIndex() * 10_000 / (10_000 - 100) + 1; // headroom for fees

        vm.startBroadcast();
        require(token.balanceOf(msg.sender) >= raw + quoteSeed, "insufficient Stock Tokens");
        token.approve(address(vault), raw);
        vault.strip(raw, msg.sender);
        vault.yt().approve(address(market), units);
        token.approve(address(market), quoteSeed);
        uint256 lp = market.initialize(units, quoteSeed, rate, msg.sender);
        vm.stopBroadcast();
        console2.log("market seeded; LP tokens:", lp);
    }
}
