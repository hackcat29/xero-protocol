// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IRobinhoodStockToken} from "../interfaces/IScaledUIAmount.sol";

/// @title MockB20StockToken
/// @notice Implements Coinbase B20 Tokenized Stock standard on Base.
///         Dividends are wrapped directly into an escalating on-chain Multiplier.
///         Raw token balances stay constant while `uiMultiplier()` expands upon dividend reinvestment.
///         Underlying stock shares = rawBalance * uiMultiplier / 1e18.
contract MockB20StockToken is ERC20, IRobinhoodStockToken {
    string public constant TOKEN_STANDARD = "Coinbase-B20";
    address public immutable issuer;
    uint256 internal _multiplier = 1e18;
    uint256 public newUIMultiplier = 1e18;
    uint256 public effectiveAt;
    bool public oraclePaused;
    bool public paused;

    /// @notice Base Sepolia testnet faucet amount (raw tokens per claim).
    uint256 public faucetAmount;
    uint256 public constant FAUCET_COOLDOWN = 1 days;
    mapping(address => uint256) public lastFaucet;

    event B20MultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier, uint256 effectiveTimestamp);
    event B20DividendReinvested(uint256 cashPerShareWad, uint256 pricePerShareWad, uint256 newMultiplier);
    event B20StockSplit(uint256 numerator, uint256 denominator, uint256 newMultiplier);

    error OnlyIssuer();
    error TokenPaused();
    error FaucetCooldown();

    constructor(
        string memory name_,
        string memory symbol_,
        address issuer_
    ) ERC20(name_, symbol_) {
        issuer = issuer_;
    }

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert OnlyIssuer();
        _;
    }

    // ------------------------------------------------------------ B20 Scaled UI views

    function uiMultiplier() public view override returns (uint256) {
        return effectiveAt != 0 && block.timestamp >= effectiveAt ? newUIMultiplier : _multiplier;
    }

    function balanceOfUI(address account) external view override returns (uint256) {
        return Math.mulDiv(balanceOf(account), uiMultiplier(), 1e18);
    }

    function totalSupplyUI() external view override returns (uint256) {
        return Math.mulDiv(totalSupply(), uiMultiplier(), 1e18);
    }

    // ------------------------------------------------------------ Faucet & Issuer operations

    function mint(address to, uint256 raw) external onlyIssuer {
        _mint(to, raw);
    }

    function setFaucetAmount(uint256 raw) external onlyIssuer {
        faucetAmount = raw;
    }

    /// @notice Anyone can claim `faucetAmount` on Base Sepolia testnet.
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
        emit B20MultiplierUpdated(old, m, block.timestamp);
    }

    function updateMultiplier(uint256 m, uint256 at) external onlyIssuer {
        _multiplier = uiMultiplier();
        newUIMultiplier = m;
        effectiveAt = at;
        emit B20MultiplierUpdated(_multiplier, m, at);
    }

    /// @notice Reinvests a corporate cash dividend net of withholding tax into the B20 Multiplier.
    function reinvestDividend(uint256 cashPerShare, uint256 pricePerShare) external onlyIssuer {
        uint256 nextM = Math.mulDiv(uiMultiplier(), 1e18 + Math.mulDiv(cashPerShare, 1e18, pricePerShare), 1e18);
        updateMultiplier(nextM);
        emit B20DividendReinvested(cashPerShare, pricePerShare, nextM);
    }

    /// @notice Executes a stock split (e.g. 2:1 or 4:1) adjusting the multiplier.
    function split(uint256 numerator, uint256 denominator) external onlyIssuer {
        uint256 nextM = Math.mulDiv(uiMultiplier(), numerator, denominator);
        updateMultiplier(nextM);
        emit B20StockSplit(numerator, denominator, nextM);
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
