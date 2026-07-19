//! Orakel Prediction Market — Soroban binary prediction market with
//! bonded optimistic resolution and a multisig arbiter fallback.
//!
//! DESIGN OVERVIEW
//! ---------------
//! * Collateral: any SEP-41 token (USDC SAC on Stellar mainnet/testnet, 7 decimals).
//! * Shares: each market has YES and NO shares. 1 unit of collateral always
//!   backs exactly one complete set (1 YES + 1 NO), so the contract is
//!   solvent by construction: shares_outstanding(YES) == shares_outstanding(NO)
//!   == collateral locked for trading.
//! * AMM: Gnosis-style Fixed Product Market Maker (x * y = k on the two
//!   share reserves). Rounding always favors the pool.
//! * Resolution: bonded proposer -> dispute window -> permissionless
//!   finalize. If disputed, only the arbiter (a Stellar account configured
//!   as 2-of-3 multisig OFF-contract, via native signer weights/thresholds)
//!   can settle.
//! * Outcomes: Yes / No / Void. Void pays 0.5 collateral per share
//!   (both sides), used for cancelled/abandoned fixtures.
//!
//! SECURITY INVARIANTS (see SECURITY_REVIEW.md for the full threat model)
//! I1. token_balance(contract) >= trading_collateral + bonds_held + fees_accrued
//! I2. yes_outstanding == no_outstanding at all times (complete-set minting only)
//! I3. yes_reserve * no_reserve never decreases on a trade (rounding favors pool)
//! I4. No state transition can be skipped: Open -> (lock by time) ->
//!     Proposed -> [Disputed] -> Resolved. Claims only in Resolved.
//! I5. Trading is impossible at/after lock_time regardless of state flags.
//! I6. Pausing blocks new risk (trading/liquidity/market creation) but can
//!     never block exits (finalize, arbiter_resolve, claim, claim_lp).

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    Address, Env, String, Symbol,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BPS_DENOM: i128 = 10_000;
/// Hard cap on combined fees (5%) — admin can never set abusive fees.
const MAX_TOTAL_FEE_BPS: u32 = 500;
/// Maximum total position exposure as a multiple of posted share collateral.
/// 30_000 bps = 3x total exposure, i.e. debt may be at most 2x collateral.
const MAX_LEVERAGE_BPS: u32 = 30_000;
/// Minimum liquidity permanently locked in a pool on creation, so reserves
/// can never be fully drained and division by ~zero cannot occur.
const MIN_LOCKED_LIQUIDITY: i128 = 1_000; // 0.0001 USDC at 7 decimals
/// Minimum dispute window (seconds). Prevents creating markets whose
/// proposals finalize before anyone could realistically dispute.
const MIN_DISPUTE_WINDOW: u64 = 15 * 60; // 15 min (use >= 2h in production)
/// Storage TTL management (ledgers). ~17,280 ledgers/day at 5s.
const INSTANCE_TTL_THRESHOLD: u32 = 17_280 * 7;
const INSTANCE_TTL_EXTEND: u32 = 17_280 * 30;
const PERSISTENT_TTL_THRESHOLD: u32 = 17_280 * 14;
const PERSISTENT_TTL_EXTEND: u32 = 17_280 * 60;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    Paused = 4,
    MarketNotFound = 5,
    InvalidTimes = 6,
    InvalidAmount = 7,
    TradingLocked = 8,
    TradingNotLocked = 9,
    WrongState = 10,
    TooEarlyToPropose = 11,
    AlreadyProposed = 12,
    NothingProposed = 13,
    DisputeWindowOpen = 14,
    DisputeWindowClosed = 15,
    AlreadyDisputed = 16,
    NotDisputed = 17,
    NotResolved = 18,
    NothingToClaim = 19,
    SlippageExceeded = 20,
    PositionCapExceeded = 21,
    InsufficientShares = 22,
    InsufficientLiquidity = 23,
    BondTooSmall = 24,
    FeeTooHigh = 25,
    Overflow = 26,
    SelfDispute = 27,
    InvalidOutcome = 28,
    LoansDisabled = 29,
    LoanAlreadyExists = 30,
    LoanNotFound = 31,
    LoanTooLarge = 32,
    LoanReserveTooSmall = 33,
    LoanNotHealthy = 34,
    LoanNotSettled = 35,
    InvalidLeverage = 36,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Outcome {
    Yes = 0,
    No = 1,
    /// Match cancelled / question unresolvable. Every share pays 0.5.
    Void = 2,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum MarketState {
    /// Trading allowed until `lock_time` (enforced by time, not this flag).
    Open = 0,
    /// An outcome has been proposed and its bond escrowed.
    Proposed = 1,
    /// Proposal was disputed; only the arbiter can settle now.
    Disputed = 2,
    /// Outcome is final. Claims are enabled.
    Resolved = 3,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Market {
    pub id: u64,
    /// Human-readable question, e.g. "Will Team A beat Team B on 2026-07-10?"
    pub question: String,
    /// Category tag, e.g. "football", "cricket", "f1". Sport-agnostic.
    pub category: Symbol,
    /// Off-chain pointer (IPFS CID / URL hash) to full resolution criteria +
    /// the NAMED official data source. Judges will ask; put it on-chain.
    pub criteria_ref: String,
    /// Trading halts at this unix time (set BEFORE event start / info release).
    pub lock_time: u64,
    /// Earliest time an outcome may be proposed (event end estimate).
    pub resolve_time: u64,
    /// Seconds after a proposal during which it can be disputed.
    pub dispute_window: u64,
    /// Max cumulative collateral a single address may spend buying into this
    /// market. Part of the insider-trading mitigation. 0 = no cap.
    pub position_cap: i128,
    /// Required bond for propose() and dispute().
    pub bond: i128,
    pub state: MarketState,
    // ---- AMM ----
    pub yes_reserve: i128,
    pub no_reserve: i128,
    pub total_lp_shares: i128,
    /// Collateral owed to LPs from trading fees.
    pub lp_fees_accrued: i128,
    /// Total collateral locked backing outstanding complete sets.
    pub collateral_locked: i128,
    // ---- Resolution ----
    pub proposer: Option<Address>,
    /// Encoded Outcome (0=Yes,1=No,2=Void); None until proposed.
    /// Stored as u32 because Option<enum> lacks infallible ScVal conversion.
    pub proposed_outcome: Option<u32>,
    pub proposal_time: u64,
    pub disputer: Option<Address>,
    /// Encoded final Outcome; None until Resolved.
    pub outcome: Option<u32>,
    /// Pool payout per LP-share numerator, fixed at resolution.
    pub pool_payout_total: i128,
}

#[contracttype]
#[derive(Clone, Debug, Default)]
pub struct Position {
    pub yes: i128,
    pub no: i128,
    /// Cumulative collateral spent on buys (for position_cap enforcement).
    pub spent: i128,
}

#[contracttype]
#[derive(Clone, Debug, Default)]
pub struct Loan {
    /// Shares held by the contract as collateral while the loan is active.
    pub yes_collateral: i128,
    pub no_collateral: i128,
    /// Principal still owed to the protocol loan reserve.
    pub debt: i128,
    pub opened_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Arbiter address. MUST be a Stellar account configured as a real
    /// multisig (e.g. 2-of-3 med_threshold) — the contract only sees one
    /// Address and calls require_auth() on it; the M-of-N logic lives in
    /// Stellar's native signer weights.
    Arbiter,
    /// SEP-41 collateral token (USDC SAC).
    Token,
    Paused,
    ProtocolFeeBps,
    LpFeeBps,
    MinBond,
    MarketCount,
    ProtocolFees,
    LoansEnabled,
    MaxLeverageBps,
    LoanReserve,
    Market(u64),
    Position(u64, Address),
    Loan(u64, Address),
    LpShares(u64, Address),
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct OrakelMarket;

#[contractimpl]
impl OrakelMarket {
    // ------------------------------------------------------------------
    // Init & admin
    // ------------------------------------------------------------------

    pub fn initialize(
        env: Env,
        admin: Address,
        arbiter: Address,
        token: Address,
        protocol_fee_bps: u32,
        lp_fee_bps: u32,
        min_bond: i128,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        if protocol_fee_bps + lp_fee_bps > MAX_TOTAL_FEE_BPS {
            panic_with_error!(&env, Error::FeeTooHigh);
        }
        if min_bond <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Arbiter, &arbiter);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::Paused, &false);
        s.set(&DataKey::ProtocolFeeBps, &protocol_fee_bps);
        s.set(&DataKey::LpFeeBps, &lp_fee_bps);
        s.set(&DataKey::MinBond, &min_bond);
        s.set(&DataKey::MarketCount, &0u64);
        s.set(&DataKey::ProtocolFees, &0i128);
        // Lending is opt-in. It remains disabled until the admin funds a
        // separate reserve and explicitly enables it after risk review.
        s.set(&DataKey::LoansEnabled, &false);
        s.set(&DataKey::MaxLeverageBps, &MAX_LEVERAGE_BPS);
        s.set(&DataKey::LoanReserve, &0i128);
        extend_instance(&env);
    }

    /// Emergency stop. Blocks NEW risk only — never blocks exits (I6).
    pub fn set_paused(env: Env, paused: bool) {
        require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &paused);
        env.events().publish((symbol_short!("paused"),), paused);
    }

    /// Rotate the arbiter (e.g. new multisig account). Admin-gated.
    /// NOTE (accepted risk, see review M-2): no timelock in hackathon scope.
    pub fn set_arbiter(env: Env, new_arbiter: Address) {
        require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::Arbiter, &new_arbiter);
        env.events()
            .publish((symbol_short!("arbiter"),), new_arbiter);
    }

    pub fn set_fees(env: Env, protocol_fee_bps: u32, lp_fee_bps: u32) {
        require_admin(&env);
        if protocol_fee_bps + lp_fee_bps > MAX_TOTAL_FEE_BPS {
            panic_with_error!(&env, Error::FeeTooHigh);
        }
        let s = env.storage().instance();
        s.set(&DataKey::ProtocolFeeBps, &protocol_fee_bps);
        s.set(&DataKey::LpFeeBps, &lp_fee_bps);
    }

    pub fn withdraw_protocol_fees(env: Env, to: Address) -> i128 {
        require_admin(&env);
        let s = env.storage().instance();
        let amount: i128 = s.get(&DataKey::ProtocolFees).unwrap_or(0);
        if amount <= 0 {
            panic_with_error!(&env, Error::NothingToClaim);
        }
        s.set(&DataKey::ProtocolFees, &0i128);
        token_client(&env).transfer(&env.current_contract_address(), &to, &amount);
        env.events().publish((symbol_short!("feeswd"),), amount);
        amount
    }

    /// Configure the isolated position-loan facility. Loans are disabled by
    /// default and should only be enabled after the reserve is funded.
    pub fn set_loan_config(env: Env, enabled: bool, max_leverage_bps: u32) {
        require_admin(&env);
        if max_leverage_bps < 10_000 || max_leverage_bps > MAX_LEVERAGE_BPS {
            panic_with_error!(&env, Error::InvalidLeverage);
        }
        let s = env.storage().instance();
        s.set(&DataKey::LoansEnabled, &enabled);
        s.set(&DataKey::MaxLeverageBps, &max_leverage_bps);
        env.events()
            .publish((symbol_short!("loan_cfg"),), (enabled, max_leverage_bps));
    }

    /// Fund the loan reserve with the collateral token. Reserve funds are
    /// kept separate from market collateral and are the only source of new
    /// borrowing liquidity.
    pub fn fund_loan_reserve(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        token_client(&env).transfer(&from, &env.current_contract_address(), &amount);
        let s = env.storage().instance();
        let reserve: i128 = s.get(&DataKey::LoanReserve).unwrap_or(0);
        s.set(&DataKey::LoanReserve, &checked_add(&env, reserve, amount));
        env.events()
            .publish((symbol_short!("loan_fund"), from), amount);
    }

    /// Withdraw only free loan-reserve liquidity. Borrowed principal is never
    /// counted as free reserve, so withdrawals cannot strand active loans.
    pub fn withdraw_loan_reserve(env: Env, to: Address, amount: i128) {
        require_admin(&env);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let s = env.storage().instance();
        let reserve: i128 = s.get(&DataKey::LoanReserve).unwrap_or(0);
        if amount > reserve {
            panic_with_error!(&env, Error::LoanReserveTooSmall);
        }
        s.set(&DataKey::LoanReserve, &(reserve - amount));
        token_client(&env).transfer(&env.current_contract_address(), &to, &amount);
        env.events().publish((symbol_short!("loan_wd"), to), amount);
    }

    // ------------------------------------------------------------------
    // Market lifecycle
    // ------------------------------------------------------------------

    /// Create a market and seed its AMM. Admin-gated in hackathon scope
    /// (permissionless creation = spam + malicious-question risk; see L-1).
    /// The creator's `initial_liquidity` is split into equal YES/NO reserves
    /// (starting price 0.50) and the creator receives LP shares, minus a
    /// small permanently-locked amount (prevents full-drain / div-by-zero).
    #[allow(clippy::too_many_arguments)]
    pub fn create_market(
        env: Env,
        creator: Address,
        question: String,
        category: Symbol,
        criteria_ref: String,
        lock_time: u64,
        resolve_time: u64,
        dispute_window: u64,
        position_cap: i128,
        bond: i128,
        initial_liquidity: i128,
    ) -> u64 {
        require_admin(&env); // admin == creator in practice; both auths checked
        creator.require_auth();
        require_not_paused(&env);

        let now = env.ledger().timestamp();
        if !(now < lock_time && lock_time <= resolve_time) {
            panic_with_error!(&env, Error::InvalidTimes);
        }
        if dispute_window < MIN_DISPUTE_WINDOW {
            panic_with_error!(&env, Error::InvalidTimes);
        }
        let min_bond: i128 = env.storage().instance().get(&DataKey::MinBond).unwrap_or(0);
        if bond < min_bond {
            panic_with_error!(&env, Error::BondTooSmall);
        }
        if initial_liquidity < 2 * MIN_LOCKED_LIQUIDITY {
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }
        if position_cap < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        // Pull collateral, mint complete sets into the pool.
        token_client(&env).transfer(
            &creator,
            &env.current_contract_address(),
            &initial_liquidity,
        );

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::MarketCount)
            .unwrap_or(0);

        let market = Market {
            id,
            question,
            category,
            criteria_ref,
            lock_time,
            resolve_time,
            dispute_window,
            position_cap,
            bond,
            state: MarketState::Open,
            yes_reserve: initial_liquidity,
            no_reserve: initial_liquidity,
            total_lp_shares: initial_liquidity,
            lp_fees_accrued: 0,
            collateral_locked: initial_liquidity,
            proposer: None,
            proposed_outcome: None,
            proposal_time: 0,
            disputer: None,
            outcome: None,
            pool_payout_total: 0,
        };
        save_market(&env, &market);

        // Creator LP shares, minus permanently locked dust.
        let creator_lp = initial_liquidity - MIN_LOCKED_LIQUIDITY;
        set_lp_shares(&env, id, &creator, creator_lp);

        env.storage()
            .instance()
            .set(&DataKey::MarketCount, &(id + 1));
        env.events()
            .publish((symbol_short!("mkt_new"), id), initial_liquidity);
        extend_instance(&env);
        id
    }

    // ------------------------------------------------------------------
    // Liquidity
    // ------------------------------------------------------------------

    /// Add liquidity proportional to current reserves (Gnosis FPMM style):
    /// deposit `amount` collateral -> mint `amount` complete sets -> add the
    /// proportional amounts to reserves -> refund the surplus outcome shares
    /// to the LP as a position. LP shares minted pro-rata on the larger reserve.
    pub fn add_liquidity(env: Env, market_id: u64, from: Address, amount: i128) -> i128 {
        from.require_auth();
        require_not_paused(&env);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let mut m = load_market(&env, market_id);
        require_open_for_trading(&env, &m);

        token_client(&env).transfer(&from, &env.current_contract_address(), &amount);

        let (y, n) = (m.yes_reserve, m.no_reserve);
        let max_r = if y >= n { y } else { n };

        // Proportional adds (floor). Surplus of the cheaper side goes to the LP.
        let add_y = mul_div_floor(&env, amount, y, max_r);
        let add_n = mul_div_floor(&env, amount, n, max_r);
        let surplus_y = amount - add_y;
        let surplus_n = amount - add_n;

        let lp_minted = mul_div_floor(&env, amount, m.total_lp_shares, max_r);
        if lp_minted <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        m.yes_reserve = checked_add(&env, m.yes_reserve, add_y);
        m.no_reserve = checked_add(&env, m.no_reserve, add_n);
        m.total_lp_shares = checked_add(&env, m.total_lp_shares, lp_minted);
        m.collateral_locked = checked_add(&env, m.collateral_locked, amount);

        if surplus_y > 0 || surplus_n > 0 {
            let mut pos = get_position(&env, market_id, &from);
            pos.yes = checked_add(&env, pos.yes, surplus_y);
            pos.no = checked_add(&env, pos.no, surplus_n);
            set_position(&env, market_id, &from, &pos);
        }

        let cur = get_lp_shares(&env, market_id, &from);
        set_lp_shares(&env, market_id, &from, checked_add(&env, cur, lp_minted));
        save_market(&env, &m);

        env.events()
            .publish((symbol_short!("liq_add"), market_id, from), amount);
        lp_minted
    }

    /// Remove liquidity BEFORE resolution: burn LP shares, receive pro-rata
    /// YES/NO shares from the reserves (NOT collateral — the pool cannot know
    /// final value yet). After resolution use `claim_lp` instead.
    pub fn remove_liquidity(env: Env, market_id: u64, from: Address, lp_amount: i128) {
        from.require_auth();
        if lp_amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let mut m = load_market(&env, market_id);
        if m.state == MarketState::Resolved {
            panic_with_error!(&env, Error::WrongState); // use claim_lp
        }
        let bal = get_lp_shares(&env, market_id, &from);
        if lp_amount > bal {
            panic_with_error!(&env, Error::InsufficientShares);
        }
        // Keep the permanently locked floor in the pool.
        if m.total_lp_shares - lp_amount < MIN_LOCKED_LIQUIDITY {
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }

        let out_y = mul_div_floor(&env, m.yes_reserve, lp_amount, m.total_lp_shares);
        let out_n = mul_div_floor(&env, m.no_reserve, lp_amount, m.total_lp_shares);
        // Pro-rata share of accrued LP fees is paid out in collateral now.
        let fee_out = mul_div_floor(&env, m.lp_fees_accrued, lp_amount, m.total_lp_shares);

        m.yes_reserve -= out_y;
        m.no_reserve -= out_n;
        m.lp_fees_accrued -= fee_out;
        m.total_lp_shares -= lp_amount;

        set_lp_shares(&env, market_id, &from, bal - lp_amount);
        let mut pos = get_position(&env, market_id, &from);
        pos.yes = checked_add(&env, pos.yes, out_y);
        pos.no = checked_add(&env, pos.no, out_n);
        set_position(&env, market_id, &from, &pos);
        save_market(&env, &m);

        if fee_out > 0 {
            token_client(&env).transfer(&env.current_contract_address(), &from, &fee_out);
        }
        env.events()
            .publish((symbol_short!("liq_rem"), market_id, from), lp_amount);
    }

    // ------------------------------------------------------------------
    // Trading (FPMM)
    // ------------------------------------------------------------------

    /// Buy YES (buy_yes=true) or NO shares with `amount_in` collateral.
    /// Fees are taken from the input. Reverts if output < `min_shares_out`
    /// (caller-side slippage protection) or the position cap is exceeded.
    pub fn buy(
        env: Env,
        market_id: u64,
        from: Address,
        buy_yes: bool,
        amount_in: i128,
        min_shares_out: i128,
    ) -> i128 {
        from.require_auth();
        require_not_paused(&env);
        if amount_in <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let mut m = load_market(&env, market_id);
        require_open_for_trading(&env, &m);

        // Position cap (insider-trading mitigation; 0 = uncapped).
        let mut pos = get_position(&env, market_id, &from);
        let new_spent = checked_add(&env, pos.spent, amount_in);
        if m.position_cap > 0 && new_spent > m.position_cap {
            panic_with_error!(&env, Error::PositionCapExceeded);
        }

        token_client(&env).transfer(&from, &env.current_contract_address(), &amount_in);

        let (proto_fee, lp_fee) = split_fees(&env, amount_in);
        let invest = amount_in - proto_fee - lp_fee;
        if invest <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        accrue_fees(&env, &mut m, proto_fee, lp_fee);

        // Mint `invest` complete sets, swap the unwanted side into the pool.
        // yes_out = invest + y - ceil(y*n / (n+invest))   [buying YES]
        let (y, n) = (m.yes_reserve, m.no_reserve);
        let shares_out = if buy_yes {
            let new_y = mul_div_ceil(&env, y, n, checked_add(&env, n, invest));
            let out = checked_add(&env, invest, y) - new_y;
            m.yes_reserve = new_y;
            m.no_reserve = checked_add(&env, n, invest);
            out
        } else {
            let new_n = mul_div_ceil(&env, y, n, checked_add(&env, y, invest));
            let out = checked_add(&env, invest, n) - new_n;
            m.no_reserve = new_n;
            m.yes_reserve = checked_add(&env, y, invest);
            out
        };

        if shares_out < min_shares_out {
            panic_with_error!(&env, Error::SlippageExceeded);
        }
        if shares_out <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        m.collateral_locked = checked_add(&env, m.collateral_locked, invest);
        if buy_yes {
            pos.yes = checked_add(&env, pos.yes, shares_out);
        } else {
            pos.no = checked_add(&env, pos.no, shares_out);
        }
        pos.spent = new_spent;
        set_position(&env, market_id, &from, &pos);
        save_market(&env, &m);

        env.events().publish(
            (symbol_short!("buy"), market_id, from),
            (buy_yes, amount_in, shares_out),
        );
        shares_out
    }

    /// Sell `shares_in` YES/NO shares back to the pool for collateral.
    /// Uses the closed-form FPMM sell: solve (y + s - x)(n - x) = y*n for x
    /// (selling YES), pay x minus fees. Rounding favors the pool.
    pub fn sell(
        env: Env,
        market_id: u64,
        from: Address,
        sell_yes: bool,
        shares_in: i128,
        min_amount_out: i128,
    ) -> i128 {
        from.require_auth();
        require_not_paused(&env);
        if shares_in <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let mut m = load_market(&env, market_id);
        require_open_for_trading(&env, &m);

        let mut pos = get_position(&env, market_id, &from);
        if sell_yes {
            if pos.yes < shares_in {
                panic_with_error!(&env, Error::InsufficientShares);
            }
        } else if pos.no < shares_in {
            panic_with_error!(&env, Error::InsufficientShares);
        }

        // x = ((a + s + b) - sqrt((a + s + b)^2 - 4*s*b)) / 2
        // where a = reserve of the side being sold, b = the other reserve.
        let (a, b) = if sell_yes {
            (m.yes_reserve, m.no_reserve)
        } else {
            (m.no_reserve, m.yes_reserve)
        };
        let sum = checked_add(&env, checked_add(&env, a, shares_in), b);
        let four_sb = checked_mul(&env, 4, checked_mul(&env, shares_in, b));
        let disc = checked_mul(&env, sum, sum) - four_sb;
        if disc < 0 {
            panic_with_error!(&env, Error::Overflow);
        }
        // isqrt rounds down => x rounds down => pool keeps the dust (I3).
        let x = (sum - isqrt(disc)) / 2;
        if x <= 0 || x >= b {
            // x >= b would drain the opposite reserve entirely.
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }

        // Burn x complete sets from the pool; return collateral minus fees.
        if sell_yes {
            m.yes_reserve = checked_add(&env, a, shares_in) - x;
            m.no_reserve = b - x;
            pos.yes -= shares_in;
        } else {
            m.no_reserve = checked_add(&env, a, shares_in) - x;
            m.yes_reserve = b - x;
            pos.no -= shares_in;
        }
        if m.yes_reserve < MIN_LOCKED_LIQUIDITY || m.no_reserve < MIN_LOCKED_LIQUIDITY {
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }

        let (proto_fee, lp_fee) = split_fees(&env, x);
        let payout = x - proto_fee - lp_fee;
        if payout < min_amount_out {
            panic_with_error!(&env, Error::SlippageExceeded);
        }
        accrue_fees(&env, &mut m, proto_fee, lp_fee);
        m.collateral_locked -= x;

        set_position(&env, market_id, &from, &pos);
        save_market(&env, &m);
        token_client(&env).transfer(&env.current_contract_address(), &from, &payout);

        env.events().publish(
            (symbol_short!("sell"), market_id, from),
            (sell_yes, shares_in, payout),
        );
        payout
    }

    // ------------------------------------------------------------------
    // Isolated position loans
    // ------------------------------------------------------------------

    /// Borrow collateral against YES/NO shares already owned by `borrower`.
    /// The shares are moved out of the user's spendable Position and held in
    /// the Loan record until repayment or resolution settlement.
    ///
    /// The configured leverage is a total-exposure multiplier. At the default
    /// 3x ceiling, debt is limited to 2x the current AMM-marked collateral
    /// value. The facility is disabled by default and requires a funded,
    /// separate loan reserve.
    pub fn borrow(
        env: Env,
        market_id: u64,
        borrower: Address,
        borrow_yes: bool,
        collateral_shares: i128,
        amount: i128,
    ) -> i128 {
        borrower.require_auth();
        require_not_paused(&env);
        if collateral_shares <= 0 || amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let loans_enabled: bool = env
            .storage()
            .instance()
            .get(&DataKey::LoansEnabled)
            .unwrap_or(false);
        if !loans_enabled {
            panic_with_error!(&env, Error::LoansDisabled);
        }
        let m = load_market(&env, market_id);
        require_open_for_trading(&env, &m);
        if get_loan(&env, market_id, &borrower).debt > 0 {
            panic_with_error!(&env, Error::LoanAlreadyExists);
        }

        let mut pos = get_position(&env, market_id, &borrower);
        let available = if borrow_yes { pos.yes } else { pos.no };
        if collateral_shares > available {
            panic_with_error!(&env, Error::InsufficientShares);
        }

        let price = mul_div_floor(
            &env,
            m.no_reserve,
            BPS_DENOM,
            checked_add(&env, m.yes_reserve, m.no_reserve),
        );
        let collateral_value = if borrow_yes {
            mul_div_floor(&env, collateral_shares, price, BPS_DENOM)
        } else {
            mul_div_floor(&env, collateral_shares, BPS_DENOM - price, BPS_DENOM)
        };
        let leverage: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MaxLeverageBps)
            .unwrap_or(MAX_LEVERAGE_BPS);
        let max_debt = mul_div_floor(&env, collateral_value, (leverage - 10_000) as i128, 10_000);
        if amount > max_debt {
            panic_with_error!(&env, Error::LoanTooLarge);
        }

        let s = env.storage().instance();
        let reserve: i128 = s.get(&DataKey::LoanReserve).unwrap_or(0);
        if amount > reserve {
            panic_with_error!(&env, Error::LoanReserveTooSmall);
        }
        s.set(&DataKey::LoanReserve, &(reserve - amount));

        if borrow_yes {
            pos.yes -= collateral_shares;
        } else {
            pos.no -= collateral_shares;
        }
        set_position(&env, market_id, &borrower, &pos);
        set_loan(
            &env,
            market_id,
            &borrower,
            &Loan {
                yes_collateral: if borrow_yes { collateral_shares } else { 0 },
                no_collateral: if borrow_yes { 0 } else { collateral_shares },
                debt: amount,
                opened_at: env.ledger().timestamp(),
            },
        );
        token_client(&env).transfer(&env.current_contract_address(), &borrower, &amount);
        env.events().publish(
            (symbol_short!("borrow"), market_id, borrower),
            (collateral_shares, amount),
        );
        amount
    }

    /// Repay an active loan. Full repayment returns the pledged shares to the
    /// user's spendable Position; partial repayment keeps the collateral
    /// locked until the remaining debt is paid.
    pub fn repay(env: Env, market_id: u64, borrower: Address, amount: i128) -> i128 {
        borrower.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let mut loan = get_loan(&env, market_id, &borrower);
        if loan.debt <= 0 {
            panic_with_error!(&env, Error::LoanNotFound);
        }
        let paid = if amount > loan.debt {
            loan.debt
        } else {
            amount
        };
        token_client(&env).transfer(&borrower, &env.current_contract_address(), &paid);
        let s = env.storage().instance();
        let reserve: i128 = s.get(&DataKey::LoanReserve).unwrap_or(0);
        s.set(&DataKey::LoanReserve, &checked_add(&env, reserve, paid));
        loan.debt -= paid;
        if loan.debt == 0 {
            let mut pos = get_position(&env, market_id, &borrower);
            pos.yes = checked_add(&env, pos.yes, loan.yes_collateral);
            pos.no = checked_add(&env, pos.no, loan.no_collateral);
            set_position(&env, market_id, &borrower, &pos);
            set_loan(&env, market_id, &borrower, &Loan::default());
        } else {
            set_loan(&env, market_id, &borrower, &loan);
        }
        env.events()
            .publish((symbol_short!("repay"), market_id, borrower), paid);
        paid
    }

    /// Settle a loan after resolution. Anyone may call this to make stuck
    /// positions recoverable. Collateral first repays the reserve; any excess
    /// is sent to the borrower. Any shortfall is isolated to the loan reserve.
    pub fn settle_loan(env: Env, market_id: u64, borrower: Address) -> i128 {
        let mut m = load_market(&env, market_id);
        if m.state != MarketState::Resolved {
            panic_with_error!(&env, Error::NotResolved);
        }
        let loan = get_loan(&env, market_id, &borrower);
        if loan.debt <= 0 {
            panic_with_error!(&env, Error::LoanNotFound);
        }
        let outcome = outcome_from_u32(&env, m.outcome.unwrap());
        let collateral_payout =
            payout_for(&env, &loan.yes_collateral, &loan.no_collateral, outcome);
        let reserve_repayment = if collateral_payout >= loan.debt {
            loan.debt
        } else {
            collateral_payout
        };
        let excess = collateral_payout - reserve_repayment;
        let s = env.storage().instance();
        let reserve: i128 = s.get(&DataKey::LoanReserve).unwrap_or(0);
        s.set(
            &DataKey::LoanReserve,
            &checked_add(&env, reserve, reserve_repayment),
        );
        set_loan(&env, market_id, &borrower, &Loan::default());
        m.collateral_locked -= collateral_payout;
        save_market(&env, &m);
        if excess > 0 {
            token_client(&env).transfer(&env.current_contract_address(), &borrower, &excess);
        }
        env.events().publish(
            (symbol_short!("loan_set"), market_id, borrower),
            collateral_payout,
        );
        collateral_payout
    }

    // ------------------------------------------------------------------
    // Resolution: propose -> (dispute) -> finalize / arbiter_resolve
    // ------------------------------------------------------------------

    /// Propose an outcome after `resolve_time`, escrowing the market's bond.
    /// Anyone can propose (permissionless) — in practice Orakel's AI Result
    /// Agent proposes first, but nothing on-chain privileges it.
    pub fn propose(env: Env, market_id: u64, proposer: Address, outcome: Outcome) {
        proposer.require_auth();
        let mut m = load_market(&env, market_id);
        if m.state != MarketState::Open {
            panic_with_error!(&env, Error::AlreadyProposed);
        }
        let now = env.ledger().timestamp();
        if now < m.resolve_time {
            panic_with_error!(&env, Error::TooEarlyToPropose);
        }
        token_client(&env).transfer(&proposer, &env.current_contract_address(), &m.bond);

        m.state = MarketState::Proposed;
        m.proposer = Some(proposer.clone());
        m.proposed_outcome = Some(outcome as u32);
        m.proposal_time = now;
        save_market(&env, &m);

        env.events().publish(
            (symbol_short!("propose"), market_id, proposer),
            outcome as u32,
        );
    }

    /// Dispute an active proposal within the dispute window, escrowing an
    /// equal bond. Escalates settlement to the arbiter multisig.
    pub fn dispute(env: Env, market_id: u64, disputer: Address) {
        disputer.require_auth();
        let mut m = load_market(&env, market_id);
        if m.state != MarketState::Proposed {
            panic_with_error!(&env, Error::NothingProposed);
        }
        let now = env.ledger().timestamp();
        if now >= m.proposal_time + m.dispute_window {
            panic_with_error!(&env, Error::DisputeWindowClosed);
        }
        // Self-disputes burn your own bond for nothing but could stall the
        // market to arbitration; cheap to block, so block it.
        if m.proposer == Some(disputer.clone()) {
            panic_with_error!(&env, Error::SelfDispute);
        }
        token_client(&env).transfer(&disputer, &env.current_contract_address(), &m.bond);

        m.state = MarketState::Disputed;
        m.disputer = Some(disputer.clone());
        save_market(&env, &m);

        env.events()
            .publish((symbol_short!("dispute"), market_id), disputer);
    }

    /// Permissionless finalize after an undisputed window. Returns the
    /// proposer's bond and freezes the outcome. Callable even when paused (I6).
    pub fn finalize(env: Env, market_id: u64) {
        let mut m = load_market(&env, market_id);
        if m.state != MarketState::Proposed {
            panic_with_error!(&env, Error::NothingProposed);
        }
        let now = env.ledger().timestamp();
        if now < m.proposal_time + m.dispute_window {
            panic_with_error!(&env, Error::DisputeWindowOpen);
        }
        let outcome = outcome_from_u32(&env, m.proposed_outcome.unwrap());
        let proposer = m.proposer.clone().unwrap();
        resolve_market(&env, &mut m, outcome);
        save_market(&env, &m);

        // Effects done; now interact: return the bond.
        token_client(&env).transfer(&env.current_contract_address(), &proposer, &m.bond);
        env.events()
            .publish((symbol_short!("final"), market_id), outcome as u32);
    }

    /// Arbiter (2-of-3 multisig Stellar account) settles a disputed market.
    /// Winner of the bond game gets their bond back + half the loser's bond;
    /// the other half accrues to the protocol (anti-collusion: disputing your
    /// own proposal from a second wallet always loses you half a bond).
    /// Callable even when paused (I6).
    pub fn arbiter_resolve(env: Env, market_id: u64, outcome: Outcome) {
        let arbiter: Address = env
            .storage()
            .instance()
            .get(&DataKey::Arbiter)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        arbiter.require_auth();

        let mut m = load_market(&env, market_id);
        if m.state != MarketState::Disputed {
            panic_with_error!(&env, Error::NotDisputed);
        }
        let proposer = m.proposer.clone().unwrap();
        let disputer = m.disputer.clone().unwrap();
        let proposed = outcome_from_u32(&env, m.proposed_outcome.unwrap());
        let bond = m.bond;

        resolve_market(&env, &mut m, outcome);
        save_market(&env, &m);

        let half = bond / 2;
        let (winner_payout, winner) = if outcome == proposed {
            (checked_add(&env, bond, half), proposer)
        } else {
            (checked_add(&env, bond, half), disputer)
        };
        // Remaining half (plus rounding dust) to protocol.
        let to_protocol = checked_mul(&env, 2, bond) - winner_payout;
        let s = env.storage().instance();
        let pf: i128 = s.get(&DataKey::ProtocolFees).unwrap_or(0);
        s.set(&DataKey::ProtocolFees, &checked_add(&env, pf, to_protocol));

        token_client(&env).transfer(&env.current_contract_address(), &winner, &winner_payout);
        env.events()
            .publish((symbol_short!("arb_res"), market_id), outcome as u32);
    }

    // ------------------------------------------------------------------
    // Claims
    // ------------------------------------------------------------------

    /// Redeem a resolved position. Yes/No pay 1 per winning share; Void pays
    /// 0.5 per share on BOTH sides (floor — dust stays in the contract).
    /// Callable even when paused (I6).
    pub fn claim(env: Env, market_id: u64, user: Address) -> i128 {
        user.require_auth();
        let mut m = load_market(&env, market_id);
        if m.state != MarketState::Resolved {
            panic_with_error!(&env, Error::NotResolved);
        }
        let pos = get_position(&env, market_id, &user);
        let payout = payout_for(
            &env,
            &pos.yes,
            &pos.no,
            outcome_from_u32(&env, m.outcome.unwrap()),
        );
        if payout <= 0 {
            panic_with_error!(&env, Error::NothingToClaim);
        }
        // Effects before interaction: zero the position first.
        set_position(
            &env,
            market_id,
            &user,
            &Position {
                yes: 0,
                no: 0,
                spent: pos.spent,
            },
        );
        m.collateral_locked -= payout;
        save_market(&env, &m);
        token_client(&env).transfer(&env.current_contract_address(), &user, &payout);
        env.events()
            .publish((symbol_short!("claim"), market_id, user), payout);
        payout
    }

    /// LP redemption after resolution: pro-rata share of the pool's final
    /// value (winning reserves valued at 1, plus accrued fees).
    /// Callable even when paused (I6).
    pub fn claim_lp(env: Env, market_id: u64, user: Address) -> i128 {
        user.require_auth();
        let mut m = load_market(&env, market_id);
        if m.state != MarketState::Resolved {
            panic_with_error!(&env, Error::NotResolved);
        }
        let lp = get_lp_shares(&env, market_id, &user);
        if lp <= 0 {
            panic_with_error!(&env, Error::NothingToClaim);
        }
        let payout = mul_div_floor(&env, m.pool_payout_total, lp, m.total_lp_shares);
        set_lp_shares(&env, market_id, &user, 0);
        m.pool_payout_total -= payout;
        m.total_lp_shares -= lp;
        m.collateral_locked -= payout;
        save_market(&env, &m);
        if payout > 0 {
            token_client(&env).transfer(&env.current_contract_address(), &user, &payout);
        }
        env.events()
            .publish((symbol_short!("claim_lp"), market_id, user), payout);
        payout
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    pub fn get_market(env: Env, market_id: u64) -> Market {
        load_market(&env, market_id)
    }

    pub fn get_user_position(env: Env, market_id: u64, user: Address) -> Position {
        get_position(&env, market_id, &user)
    }

    pub fn get_user_loan(env: Env, market_id: u64, user: Address) -> Loan {
        get_loan(&env, market_id, &user)
    }

    pub fn get_user_lp(env: Env, market_id: u64, user: Address) -> i128 {
        get_lp_shares(&env, market_id, &user)
    }

    /// Current implied YES probability in bps (0..10_000).
    pub fn yes_price_bps(env: Env, market_id: u64) -> i128 {
        let m = load_market(&env, market_id);
        // P(yes) = no_reserve / (yes_reserve + no_reserve)
        mul_div_floor(
            &env,
            m.no_reserve,
            BPS_DENOM,
            checked_add(&env, m.yes_reserve, m.no_reserve),
        )
    }

    pub fn market_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::MarketCount)
            .unwrap_or(0)
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn resolve_market(env: &Env, m: &mut Market, outcome: Outcome) {
    m.state = MarketState::Resolved;
    m.outcome = Some(outcome as u32);
    // Freeze the pool's final value now so LP claims are O(1) and immune to
    // later reserve mutation: winning reserves pay 1 each, void pays 0.5 each,
    // plus all LP fees accrued.
    let pool_value = payout_for(env, &m.yes_reserve, &m.no_reserve, outcome);
    m.pool_payout_total = checked_add(env, pool_value, m.lp_fees_accrued);
    m.lp_fees_accrued = 0;
    m.yes_reserve = 0;
    m.no_reserve = 0;
}

fn outcome_from_u32(env: &Env, v: u32) -> Outcome {
    match v {
        0 => Outcome::Yes,
        1 => Outcome::No,
        2 => Outcome::Void,
        _ => panic_with_error!(env, Error::InvalidOutcome),
    }
}

fn payout_for(env: &Env, yes: &i128, no: &i128, outcome: Outcome) -> i128 {
    match outcome {
        Outcome::Yes => *yes,
        Outcome::No => *no,
        Outcome::Void => checked_add(env, *yes, *no) / 2,
    }
}

fn require_admin(env: &Env) {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
    admin.require_auth();
    extend_instance(env);
}

fn require_not_paused(env: &Env) {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false);
    if paused {
        panic_with_error!(env, Error::Paused);
    }
}

/// Trading requires: state Open AND now < lock_time. Time is the source of
/// truth (I5) — even if a state flag were somehow wrong, late trades revert.
fn require_open_for_trading(env: &Env, m: &Market) {
    if m.state != MarketState::Open {
        panic_with_error!(env, Error::TradingLocked);
    }
    if env.ledger().timestamp() >= m.lock_time {
        panic_with_error!(env, Error::TradingLocked);
    }
}

fn token_client(env: &Env) -> token::Client {
    let addr: Address = env
        .storage()
        .instance()
        .get(&DataKey::Token)
        .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
    token::Client::new(env, &addr)
}

fn split_fees(env: &Env, amount: i128) -> (i128, i128) {
    let s = env.storage().instance();
    let p: u32 = s.get(&DataKey::ProtocolFeeBps).unwrap_or(0);
    let l: u32 = s.get(&DataKey::LpFeeBps).unwrap_or(0);
    (
        mul_div_floor(env, amount, p as i128, BPS_DENOM),
        mul_div_floor(env, amount, l as i128, BPS_DENOM),
    )
}

fn accrue_fees(env: &Env, m: &mut Market, proto_fee: i128, lp_fee: i128) {
    if proto_fee > 0 {
        let s = env.storage().instance();
        let pf: i128 = s.get(&DataKey::ProtocolFees).unwrap_or(0);
        s.set(&DataKey::ProtocolFees, &checked_add(env, pf, proto_fee));
    }
    if lp_fee > 0 {
        m.lp_fees_accrued = checked_add(env, m.lp_fees_accrued, lp_fee);
    }
}

// ---- storage ----

fn load_market(env: &Env, id: u64) -> Market {
    let key = DataKey::Market(id);
    let m: Market = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(env, Error::MarketNotFound));
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND);
    m
}

fn save_market(env: &Env, m: &Market) {
    let key = DataKey::Market(m.id);
    env.storage().persistent().set(&key, m);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND);
}

fn get_position(env: &Env, id: u64, user: &Address) -> Position {
    env.storage()
        .persistent()
        .get(&DataKey::Position(id, user.clone()))
        .unwrap_or(Position {
            yes: 0,
            no: 0,
            spent: 0,
        })
}

fn set_position(env: &Env, id: u64, user: &Address, pos: &Position) {
    let key = DataKey::Position(id, user.clone());
    env.storage().persistent().set(&key, pos);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND);
}

fn get_lp_shares(env: &Env, id: u64, user: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::LpShares(id, user.clone()))
        .unwrap_or(0)
}

fn get_loan(env: &Env, id: u64, user: &Address) -> Loan {
    env.storage()
        .persistent()
        .get(&DataKey::Loan(id, user.clone()))
        .unwrap_or_default()
}

fn set_loan(env: &Env, id: u64, user: &Address, loan: &Loan) {
    let key = DataKey::Loan(id, user.clone());
    if loan.debt == 0 {
        env.storage().persistent().remove(&key);
        return;
    }
    env.storage().persistent().set(&key, loan);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND);
}

fn set_lp_shares(env: &Env, id: u64, user: &Address, amount: i128) {
    let key = DataKey::LpShares(id, user.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND);
}

fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND);
}

// ---- math (all overflow-checked; rounding always favors the pool) ----

fn checked_add(env: &Env, a: i128, b: i128) -> i128 {
    a.checked_add(b)
        .unwrap_or_else(|| panic_with_error!(env, Error::Overflow))
}

fn checked_mul(env: &Env, a: i128, b: i128) -> i128 {
    a.checked_mul(b)
        .unwrap_or_else(|| panic_with_error!(env, Error::Overflow))
}

fn mul_div_floor(env: &Env, a: i128, b: i128, d: i128) -> i128 {
    if d == 0 {
        panic_with_error!(env, Error::Overflow);
    }
    checked_mul(env, a, b) / d
}

fn mul_div_ceil(env: &Env, a: i128, b: i128, d: i128) -> i128 {
    if d == 0 {
        panic_with_error!(env, Error::Overflow);
    }
    let p = checked_mul(env, a, b);
    let q = p / d;
    if p % d != 0 {
        q + 1
    } else {
        q
    }
}

/// Integer square root (floor) via Newton's method. Input must be >= 0.
fn isqrt(v: i128) -> i128 {
    if v < 2 {
        return v;
    }
    let mut x = v;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + v / x) / 2;
    }
    x
}

#[cfg(test)]
mod test;
