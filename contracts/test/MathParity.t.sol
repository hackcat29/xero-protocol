// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {XeroMathSol} from "../src/math/XeroMathSol.sol";
import {IXeroMath} from "../src/interfaces/IXeroMath.sol";

/// @notice Replays vectors produced by the Stylus engine (`cargo test --test parity`) against the
///         Solidity engine. Results must be bit-identical; failing cases must fail with the same
///         MathError code (code 255 = arithmetic overflow, which Solidity reports as a Panic).
contract MathParityTest is Test {
    /// @dev Defaults to a fresh Solidity engine; set XERO_MATH (with --fork-url) to verify a deployed
    ///      engine, such as the Stylus build, against the same vectors.
    IXeroMath internal m;
    string internal json;

    function setUp() public {
        address deployed = vm.envOr("XERO_MATH", address(0));
        m = deployed == address(0) ? IXeroMath(address(new XeroMathSol())) : IXeroMath(deployed);
        json = vm.readFile("../stylus/xero-math/vectors/math_vectors.json");
    }

    function test_LnParity() public view {
        uint256[] memory x = vm.parseJsonUintArray(json, ".ln.x");
        int256[] memory out = vm.parseJsonIntArray(json, ".ln.out");
        uint256[] memory err = vm.parseJsonUintArray(json, ".ln.err");
        assertGt(x.length, 0);
        for (uint256 i; i < x.length; ++i) {
            try m.lnWad(int256(x[i])) returns (int256 r) {
                assertEq(err[i], 0, "solidity succeeded where stylus failed");
                assertEq(r, out[i], string.concat("ln mismatch #", vm.toString(i)));
            } catch (bytes memory reason) {
                _assertSameError(reason, err[i], i);
            }
        }
    }

    function test_SellParity() public view {
        _swapParity(".sell", true);
    }

    function test_BuyParity() public view {
        _swapParity(".buy", false);
    }

    function test_ForwardParity() public view {
        uint256[] memory taus = vm.parseJsonUintArray(json, ".fwd.taus");
        uint256[] memory values = vm.parseJsonUintArray(json, ".fwd.values");
        int256[] memory out = vm.parseJsonIntArray(json, ".fwd.out");
        uint256[] memory err = vm.parseJsonUintArray(json, ".fwd.err");
        for (uint256 c; c < err.length; ++c) {
            uint256[] memory t = new uint256[](4);
            uint256[] memory v = new uint256[](4);
            for (uint256 k; k < 4; ++k) {
                t[k] = taus[c * 4 + k];
                v[k] = values[c * 4 + k];
            }
            try m.forwardRates(t, v) returns (int256[] memory f) {
                assertEq(err[c], 0);
                for (uint256 k; k < 4; ++k) {
                    assertEq(f[k], out[c * 4 + k], "forward mismatch");
                }
            } catch (bytes memory reason) {
                _assertSameError(reason, err[c], c);
            }
        }
    }

    function _swapParity(string memory key, bool sell) internal view {
        uint256[] memory x = vm.parseJsonUintArray(json, string.concat(key, ".x"));
        uint256[] memory y = vm.parseJsonUintArray(json, string.concat(key, ".y"));
        uint256[] memory refp = vm.parseJsonUintArray(json, string.concat(key, ".ref"));
        int256[] memory rate = vm.parseJsonIntArray(json, string.concat(key, ".rate"));
        int256[] memory scalar = vm.parseJsonIntArray(json, string.concat(key, ".scalar"));
        uint256[] memory tau = vm.parseJsonUintArray(json, string.concat(key, ".tau"));
        uint256[] memory fee = vm.parseJsonUintArray(json, string.concat(key, ".fee"));
        uint256[] memory amt = vm.parseJsonUintArray(json, string.concat(key, ".amt"));
        uint256[] memory out = vm.parseJsonUintArray(json, string.concat(key, ".out"));
        int256[] memory newRate = vm.parseJsonIntArray(json, string.concat(key, ".newRate"));
        uint256[] memory err = vm.parseJsonUintArray(json, string.concat(key, ".err"));

        uint256 ok;
        for (uint256 i; i < x.length; ++i) {
            bytes memory call = abi.encodeWithSelector(
                sell ? IXeroMath.swapExactYtIn.selector : IXeroMath.swapExactQuoteIn.selector,
                x[i], y[i], refp[i], rate[i], scalar[i], tau[i], fee[i], amt[i]
            );
            (bool success, bytes memory ret) = address(m).staticcall(call);
            if (success) {
                (uint256 o, int256 r) = abi.decode(ret, (uint256, int256));
                assertEq(err[i], 0, string.concat("only stylus failed #", vm.toString(i)));
                assertEq(o, out[i], string.concat("amount mismatch #", vm.toString(i)));
                assertEq(r, newRate[i], string.concat("rate mismatch #", vm.toString(i)));
                ++ok;
            } else {
                _assertSameError(ret, err[i], i);
            }
        }
        assertGt(ok, x.length / 2, "too few successful cases exercised");
    }

    function _assertSameError(bytes memory reason, uint256 code, uint256 i) internal pure {
        assertGt(code, 0, string.concat("only solidity failed #", vm.toString(i)));
        if (code == 255) {
            assertEq(bytes4(reason), bytes4(0x4e487b71), "expected arithmetic panic"); // Panic(uint256)
        } else {
            assertEq(reason, abi.encodeWithSelector(IXeroMath.MathError.selector, uint8(code)));
        }
    }
}
