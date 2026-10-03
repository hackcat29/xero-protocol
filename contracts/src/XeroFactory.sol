// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {XeroVault, IXeroFactoryConfig} from "./XeroVault.sol";
import {XeroComponentToken, ComponentTokenDeployer} from "./tokens/XeroComponentToken.sol";
import {IRobinhoodStockToken} from "./interfaces/IScaledUIAmount.sol";
import {ICorporateActionEngine} from "./interfaces/ICorporateActionEngine.sol";
import {IRiskGuardian} from "./interfaces/IRiskGuardian.sol";

/// @title XeroFactory
/// @notice Creates and registers stripping markets (one XeroVault per Stock Token and maturity) and
///         holds protocol fee configuration. Ownership sits behind a TimelockController in production.
contract XeroFactory is IXeroFactoryConfig, Ownable2Step {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS = 100;
    uint16 public constant MAX_YIELD_FEE_BPS = 1_000;
    uint64 public constant MIN_TENOR = 1 days;
    uint256 public constant MAX_GROWTH_PER_SYNC = 0.25e18;

    /// @notice Settlement asset for market-creation fees (USDG).
    IERC20 public immutable usdg;
    ICorporateActionEngine public immutable engine;
    IRiskGuardian public immutable guardian;
    ComponentTokenDeployer public immutable tokenDeployer;

    address public treasury;
    uint16 public stripFeeBps;
    uint16 public redeemFeeBps;
    /// @notice Share of YT yield retained by the protocol.
    uint16 public yieldFeeBps;
    /// @notice Default bound on unexplained dividend-index growth per sync for new vaults.
    uint256 public defaultMaxGrowthPerSync = 0.05e18;
    /// @notice USDG charged to non-owner callers for creating a market.
    uint256 public marketCreationFee;

    address[] public allVaults;
    mapping(address underlying => address[]) internal _vaultsOf;
    mapping(address underlying => mapping(uint64 maturity => address)) public vaultFor;
    mapping(address => bool) public isVault;

    event VaultCreated(
        address indexed underlying, uint64 indexed maturity, address vault, address principalToken, address yieldToken
    );
    event FeesSet(uint16 stripFeeBps, uint16 redeemFeeBps, uint16 yieldFeeBps, uint256 marketCreationFee);
    event DefaultMaxGrowthSet(uint256 maxGrowthPerSync);
    event TreasurySet(address treasury);

    error AssetNotSupported();
    error InvalidMaturity();
    error MarketExists();
    error FeeTooHigh();
    error ZeroAddress();
    error InvalidGrowthBound();

    constructor(
        address owner_,
        IERC20 usdg_,
        ICorporateActionEngine engine_,
        IRiskGuardian guardian_,
        address treasury_
    ) Ownable(owner_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        usdg = usdg_;
        engine = engine_;
        guardian = guardian_;
        treasury = treasury_;
        tokenDeployer = new ComponentTokenDeployer();
    }

    /// @notice Create the vault for `underlying` maturing at `maturity`.
    /// @param label Maturity tag used in token symbols, e.g. "DEC27" -> xAAPL-PT-DEC27 / xAAPL-YT-DEC27.
    /// @param maxGrowthPerSync Unexplained index growth bound (WAD fraction); 0 uses the default.
    function createVault(address underlying, uint64 maturity, string calldata label, uint256 maxGrowthPerSync)
        external
        returns (address vault)
    {
        if (maxGrowthPerSync == 0) maxGrowthPerSync = defaultMaxGrowthPerSync;
        if (msg.sender != owner() && maxGrowthPerSync != defaultMaxGrowthPerSync) revert InvalidGrowthBound();
        if (maxGrowthPerSync > MAX_GROWTH_PER_SYNC) revert InvalidGrowthBound();
        if (!guardian.isAssetAllowed(underlying)) revert AssetNotSupported();
        if (maturity < block.timestamp + MIN_TENOR) revert InvalidMaturity();
        if (vaultFor[underlying][maturity] != address(0)) revert MarketExists();

        uint256 fee = marketCreationFee;
        if (msg.sender != owner() && fee > 0) usdg.safeTransferFrom(msg.sender, treasury, fee);

        XeroVault v = new XeroVault(
            IRobinhoodStockToken(underlying), engine, guardian, maturity, maxGrowthPerSync, this
        );
        vault = address(v);

        string memory sym = IERC20Metadata(underlying).symbol();
        address pt = tokenDeployer.deploy(
            string.concat("Xero ", sym, " Principal ", label),
            string.concat("x", sym, "-PT-", label),
            vault,
            XeroComponentToken.Kind.PRINCIPAL
        );
        address yt = tokenDeployer.deploy(
            string.concat("Xero ", sym, " Yield ", label),
            string.concat("x", sym, "-YT-", label),
            vault,
            XeroComponentToken.Kind.YIELD
        );
        v.initialize(XeroComponentToken(pt), XeroComponentToken(yt));

        allVaults.push(vault);
        _vaultsOf[underlying].push(vault);
        vaultFor[underlying][maturity] = vault;
        isVault[vault] = true;
        emit VaultCreated(underlying, maturity, vault, pt, yt);
    }

    function setFees(uint16 stripFeeBps_, uint16 redeemFeeBps_, uint16 yieldFeeBps_, uint256 marketCreationFee_)
        external
        onlyOwner
    {
        if (stripFeeBps_ > MAX_FEE_BPS || redeemFeeBps_ > MAX_FEE_BPS || yieldFeeBps_ > MAX_YIELD_FEE_BPS) {
            revert FeeTooHigh();
        }
        stripFeeBps = stripFeeBps_;
        redeemFeeBps = redeemFeeBps_;
        yieldFeeBps = yieldFeeBps_;
        marketCreationFee = marketCreationFee_;
        emit FeesSet(stripFeeBps_, redeemFeeBps_, yieldFeeBps_, marketCreationFee_);
    }

    function setDefaultMaxGrowthPerSync(uint256 maxGrowthPerSync) external onlyOwner {
        if (maxGrowthPerSync == 0 || maxGrowthPerSync > MAX_GROWTH_PER_SYNC) revert InvalidGrowthBound();
        defaultMaxGrowthPerSync = maxGrowthPerSync;
        emit DefaultMaxGrowthSet(maxGrowthPerSync);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function vaultsOf(address underlying) external view returns (address[] memory) {
        return _vaultsOf[underlying];
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }
}
