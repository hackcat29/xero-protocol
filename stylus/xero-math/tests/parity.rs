//! Generates `vectors/math_vectors.json`: deterministic pseudo-random inputs and the Stylus engine's
//! outputs. `contracts/test/MathParity.t.sol` replays every case against the Solidity engine and
//! requires identical results (or the same error code).

use alloy_primitives::{I256, U256};
use serde_json::{json, Value};
use xero_math::math;

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        // xorshift64*
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }
    /// Uniform-ish WAD value in [lo, hi] (inputs given in 1e-6 units to stay in integer math).
    fn wad(&mut self, lo_micro: u64, hi_micro: u64) -> U256 {
        let v = lo_micro + self.next() % (hi_micro - lo_micro + 1);
        U256::from(v) * U256::from(1_000_000_000_000u64) + U256::from(self.next() % 1_000_000_000_000)
    }
}

fn s(v: U256) -> Value {
    Value::String(v.to_string())
}
fn si(v: I256) -> Value {
    Value::String(v.to_string())
}

struct Swap {
    x: Vec<Value>,
    y: Vec<Value>,
    r#ref: Vec<Value>,
    rate: Vec<Value>,
    scalar: Vec<Value>,
    tau: Vec<Value>,
    fee: Vec<Value>,
    amt: Vec<Value>,
    out: Vec<Value>,
    new_rate: Vec<Value>,
    err: Vec<Value>,
}

impl Swap {
    fn new() -> Self {
        Swap { x: vec![], y: vec![], r#ref: vec![], rate: vec![], scalar: vec![], tau: vec![], fee: vec![], amt: vec![], out: vec![], new_rate: vec![], err: vec![] }
    }
    fn json(self) -> Value {
        json!({"x": self.x, "y": self.y, "ref": self.r#ref, "rate": self.rate, "scalar": self.scalar, "tau": self.tau,
               "fee": self.fee, "amt": self.amt, "out": self.out, "newRate": self.new_rate, "err": self.err})
    }
}

#[test]
fn generate_parity_vectors() {
    let mut rng = Rng(0x5EED_0F_0DD5);
    let wad = U256::from(1_000_000_000_000_000_000u64);

    // ---- ln
    let (mut ln_x, mut ln_out, mut ln_err) = (vec![], vec![], vec![]);
    for i in 0..200 {
        let x = match i % 4 {
            0 => rng.wad(1, 1_000_000),                       // (0, 1]
            1 => rng.wad(1_000_000, 50_000_000),              // [1, 50]
            2 => U256::from(rng.next() % 1_000_000_000) + U256::from(1u8), // tiny wei values
            _ => rng.wad(1_000_000, u64::MAX / 2) * U256::from(rng.next() % 1_000_000 + 1), // huge
        };
        ln_x.push(s(x));
        match math::ln_wad(I256::from_raw(x)) {
            Ok(v) => { ln_out.push(si(v)); ln_err.push(json!("0")); }
            Err(e) => { ln_out.push(json!("0")); ln_err.push(json!(e.to_string())); }
        }
    }

    // ---- swaps
    let mut sell = Swap::new();
    let mut buy = Swap::new();
    for i in 0..300 {
        let x = rng.wad(10_000_000, 2_000_000_000_000);          // 10 .. 2,000,000 DT
        let refp = rng.wad(50_000, 5_000_000);                   // 0.05 .. 5 USDG
        let p_target = rng.wad(80_000, 920_000);                 // 0.08 .. 0.92
        let xv = x * refp / wad;
        let y = xv * (wad - p_target) / p_target + U256::from(1u8);
        let rate = I256::from_raw(rng.wad(100_000, 8_000_000));  // 0.1 .. 8 USDG / yr
        let scalar = I256::from_raw(rng.wad(500_000, 40_000_000));
        let tau = if i % 50 == 0 { U256::ZERO } else { rng.wad(2_000, 3_000_000) }; // ~1 day .. 3 yrs
        let fee = rng.wad(0, 10_000);
        let frac = rng.wad(1, if i % 10 == 0 { 2_000_000 } else { 300_000 }); // occasional oversize trade

        let yt_in = x * frac / wad;
        let quote_in = y * frac / wad;
        for (book, amt, res) in [
            (&mut sell, yt_in, math::swap_exact_yt_in(x, y, refp, rate, scalar, tau, fee, yt_in)),
            (&mut buy, quote_in, math::swap_exact_quote_in(x, y, refp, rate, scalar, tau, fee, quote_in)),
        ] {
            book.x.push(s(x)); book.y.push(s(y)); book.r#ref.push(s(refp)); book.rate.push(si(rate));
            book.scalar.push(si(scalar)); book.tau.push(s(tau)); book.fee.push(s(fee)); book.amt.push(s(amt));
            match res {
                Ok((o, r)) => { book.out.push(s(o)); book.new_rate.push(si(r)); book.err.push(json!("0")); }
                Err(e) => { book.out.push(json!("0")); book.new_rate.push(json!("0")); book.err.push(json!(e.to_string())); }
            }
        }
    }

    // ---- forward curves (4 points each, flattened)
    let (mut f_taus, mut f_vals, mut f_out, mut f_err) = (vec![], vec![], vec![], vec![]);
    for _ in 0..50 {
        let mut taus = vec![];
        let mut vals = vec![];
        let mut t = U256::ZERO;
        let mut v = U256::ZERO;
        for _ in 0..4 {
            t += rng.wad(10_000, 1_000_000);
            v += rng.wad(0, 2_000_000);
            if rng.next() % 7 == 0 { v -= v / U256::from(3u8); } // occasional inverted segment
            taus.push(t);
            vals.push(v);
        }
        let res = math::forward_rates(&taus, &vals);
        for k in 0..4 {
            f_taus.push(s(taus[k]));
            f_vals.push(s(vals[k]));
            match &res {
                Ok(f) => f_out.push(si(f[k])),
                Err(_) => f_out.push(json!("0")),
            }
        }
        f_err.push(json!(res.err().unwrap_or(0).to_string()));
    }

    let ok = |v: &Vec<Value>| v.iter().filter(|e| e.as_str() == Some("0")).count();
    println!("ln ok {}/{} | sell ok {}/{} | buy ok {}/{}", ok(&ln_err), ln_err.len(), ok(&sell.err), sell.err.len(), ok(&buy.err), buy.err.len());

    let doc = json!({
        "ln": {"x": ln_x, "out": ln_out, "err": ln_err},
        "sell": sell.json(),
        "buy": buy.json(),
        "fwd": {"taus": f_taus, "values": f_vals, "out": f_out, "err": f_err},
    });
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/vectors/math_vectors.json");
    std::fs::write(path, serde_json::to_string_pretty(&doc).unwrap()).unwrap();
}
