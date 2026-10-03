// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IXeroOracle} from "../interfaces/IXeroOracle.sol";

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title XeroOracle
/// @notice USD prices for Stock Tokens with stale-data rejection.
///
/// On Robinhood Chain each asset reads its Chainlink tokenized-equity feed, which reports the token's
/// total-return value (equity price x uiMultiplier, 8 decimals). Equity feeds run 24/5 and hold their
/// last value over weekends and during corporate actions, so staleness is configured per asset.
/// An optional L2 sequencer-uptime feed is honoured where Chainlink provides one (Robinhood Chain has
/// none today). Assets without a feed (testnets) can use reporter-pushed prices.
///
/// Prices are informational for Xero: they drive the curve lens and frontend valuations. No vault or
/// market settlement depends on them.
contract XeroOracle is IXeroOracle, AccessControl {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");

    struct AssetConfig {
        IAggregatorV3 feed;
        uint32 maxAge;
    }

    struct Observation {
        uint192 price;
        uint64 updatedAt;
    }

    uint32 public defaultMaxAge;
    IAggregatorV3 public sequencerUptimeFeed;
    uint32 public sequencerGracePeriod = 1 hours;

    mapping(address asset => AssetConfig) public configs;
    mapping(address asset => Observation) public observations;

    event AssetConfigured(address indexed asset, address feed, uint32 maxAge);
    event PricePushed(address indexed asset, uint256 price, uint256 updatedAt);
    event DefaultMaxAgeSet(uint32 maxAge);
    event SequencerFeedSet(address feed, uint32 gracePeriod);

    error StalePrice(address asset, uint256 updatedAt);
    error NoPrice(address asset);
    error InvalidPrice();
    error SequencerDown();

    constructor(address admin, uint32 defaultMaxAge_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        defaultMaxAge = defaultMaxAge_;
    }

    function configureAsset(address asset, IAggregatorV3 feed, uint32 maxAge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        configs[asset] = AssetConfig(feed, maxAge);
        emit AssetConfigured(asset, address(feed), maxAge);
    }

    function setDefaultMaxAge(uint32 maxAge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultMaxAge = maxAge;
        emit DefaultMaxAgeSet(maxAge);
    }

    function setSequencerUptimeFeed(IAggregatorV3 feed, uint32 gracePeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sequencerUptimeFeed = feed;
        sequencerGracePeriod = gracePeriod;
        emit SequencerFeedSet(address(feed), gracePeriod);
    }

    /// @notice Testnet / fallback path for assets without a Chainlink feed.
    function pushPrice(address asset, uint256 price) external onlyRole(REPORTER_ROLE) {
        if (price == 0 || price > type(uint192).max) revert InvalidPrice();
        observations[asset] = Observation(uint192(price), uint64(block.timestamp));
        emit PricePushed(asset, price, block.timestamp);
    }

    /// @return price USD per raw Stock Token (WAD), multiplier included @return updatedAt observation time
    function getPrice(address asset) external view returns (uint256 price, uint256 updatedAt) {
        _checkSequencer();
        AssetConfig memory cfg = configs[asset];
        if (address(cfg.feed) != address(0)) {
            (uint80 roundId, int256 answer,, uint256 ts, uint80 answeredInRound) = cfg.feed.latestRoundData();
            if (answer <= 0 || ts == 0 || answeredInRound < roundId) revert InvalidPrice();
            price = uint256(answer) * 1e18 / (10 ** cfg.feed.decimals());
            updatedAt = ts;
        } else {
            Observation memory o = observations[asset];
            if (o.updatedAt == 0) revert NoPrice(asset);
            (price, updatedAt) = (o.price, o.updatedAt);
        }
        uint256 maxAge = cfg.maxAge == 0 ? defaultMaxAge : cfg.maxAge;
        if (block.timestamp - updatedAt > maxAge) revert StalePrice(asset, updatedAt);
    }

    function _checkSequencer() internal view {
        IAggregatorV3 f = sequencerUptimeFeed;
        if (address(f) == address(0)) return;
        (, int256 answer, uint256 startedAt,,) = f.latestRoundData();
        if (answer != 0 || block.timestamp - startedAt <= sequencerGracePeriod) revert SequencerDown();
    }
}
