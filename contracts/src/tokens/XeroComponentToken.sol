// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IXeroVault} from "../interfaces/IXeroVault.sol";

/// @title XeroComponentToken
/// @notice ERC-20 for one side of a stripped position: the Principal Token (PT) or Yield Token (YT).
/// @dev Only the vault mints and burns. PT is a plain ERC-20. YT transfers first notify the vault so
///      accrued yield is settled to the sender before the balance moves.
contract XeroComponentToken is ERC20, ERC20Permit {
    enum Kind {
        PRINCIPAL,
        YIELD
    }

    address public immutable vault;
    Kind public immutable kind;

    error OnlyVault();

    constructor(string memory name_, string memory symbol_, address vault_, Kind kind_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        vault = vault_;
        kind = kind_;
    }

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (kind == Kind.YIELD && from != address(0) && to != address(0)) {
            IXeroVault(vault).onYieldTransfer(from, to);
        }
        super._update(from, to, value);
    }
}

/// @notice Deploys component tokens on behalf of the factory (keeps factory bytecode under the size limit).
contract ComponentTokenDeployer {
    function deploy(string calldata name, string calldata symbol, address vault, XeroComponentToken.Kind kind)
        external
        returns (address)
    {
        return address(new XeroComponentToken(name, symbol, vault, kind));
    }
}
