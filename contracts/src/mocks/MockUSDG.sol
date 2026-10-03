// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test stand-in for USDG (Global Dollar). 6 decimals, open faucet. Not for production.
contract MockUSDG is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 10_000e6;

    constructor() ERC20("Global Dollar (Mock)", "USDG") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
