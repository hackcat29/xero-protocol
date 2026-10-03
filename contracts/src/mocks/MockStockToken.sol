// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IRobinhoodStockToken} from "../interfaces/IScaledUIAmount.sol";

/// @notice Local/testnet stand-in for a Robinhood Stock Token (ERC-8056 Scaled UI Amount).
///         Raw balances never change; corporate actions move `uiMultiplier`, immediately or on a schedule,
///         mirroring the mainnet contract's observable interface. Not for production.
contract MockStockToken is ERC20, IRobinhoodStockToken {
    address public immutable issuer;
    uint256 internal _multiplier = 1e18;
    uint256 public newUIMultiplier = 1e18;
    uint256 public effectiveAt;
    bool public oraclePaused;
    bool public paused;

    /// @notice Testnet faucet: raw tokens per claim and per-address cooldown.
    uint256 public faucetAmount;
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    mapping(address => uint256) public lastFaucet;

    event UIMultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier, uint256 effectiveAtTimestamp);

    error OnlyIssuer();
    error TokenPaused();
    error FaucetCooldown();

    constructor(string memory name_, string memory symbol_, address issuer_) ERC20(name_, symbol_) {
        issuer = issuer_;
    }

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert OnlyIssuer();
        _;
    }

    // ------------------------------------------------------------ ERC-8056 views

    function uiMultiplier() public view returns (uint256) {
        return effectiveAt != 0 && block.timestamp >= effectiveAt ? newUIMultiplier : _multiplier;
    }

    function balanceOfUI(address account) external view returns (uint256) {
        return Math.mulDiv(balanceOf(account), uiMultiplier(), 1e18);
    }

    function totalSupplyUI() external view returns (uint256) {
        return Math.mulDiv(totalSupply(), uiMultiplier(), 1e18);
    }

    // ------------------------------------------------------------ issuer operations

    function mint(address to, uint256 raw) external onlyIssuer {
        _mint(to, raw);
    }

    function setFaucetAmount(uint256 raw) external onlyIssuer {
        faucetAmount = raw;
    }

    /// @notice Anyone can claim `faucetAmount` once per day (testnets only; this is a mock).
    function faucet() external {
        if (block.timestamp < lastFaucet[msg.sender] + FAUCET_COOLDOWN) revert FaucetCooldown();
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);
    }

    function updateMultiplier(uint256 m) public onlyIssuer {
        uint256 old = uiMultiplier();
        _multiplier = m;
        newUIMultiplier = m;
        effectiveAt = 0;
        emit UIMultiplierUpdated(old, m, block.timestamp);
    }

    function updateMultiplier(uint256 m, uint256 at) external onlyIssuer {
        _multiplier = uiMultiplier();
        newUIMultiplier = m;
        effectiveAt = at;
        emit UIMultiplierUpdated(_multiplier, m, at);
    }

    /// @notice Reinvest a cash dividend of `cashPerShare` at `pricePerShare` (both WAD USD).
    function reinvestDividend(uint256 cashPerShare, uint256 pricePerShare) external onlyIssuer {
        updateMultiplier(Math.mulDiv(uiMultiplier(), 1e18 + Math.mulDiv(cashPerShare, 1e18, pricePerShare), 1e18));
    }

    /// @notice Apply a `numerator`:`denominator` split to the multiplier.
    function split(uint256 numerator, uint256 denominator) external onlyIssuer {
        updateMultiplier(Math.mulDiv(uiMultiplier(), numerator, denominator));
    }

    function setOraclePaused(bool p) external onlyIssuer {
        oraclePaused = p;
    }

    function setPaused(bool p) external onlyIssuer {
        paused = p;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (paused) revert TokenPaused();
        super._update(from, to, value);
    }
}
