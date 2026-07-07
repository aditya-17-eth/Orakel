#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token::StellarAssetClient, Address, Env, String, Symbol};

const UNIT: i128 = 10_000_000; // 1 USDC at 7 decimals
const BOND: i128 = 50 * UNIT;
const SEED: i128 = 1_000 * UNIT;
const DISPUTE_WINDOW: u64 = 3_600;

struct Setup {
    env: Env,
    contract: OrakelMarketClient<'static>,
    token_admin: StellarAssetClient<'static>,
    token: token::Client<'static>,
    admin: Address,
    arbiter: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = 1_000);

    let admin = Address::generate(&env);
    let arbiter = Address::generate(&env);

    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token_admin = StellarAssetClient::new(&env, &token_id.address());
    let token = token::Client::new(&env, &token_id.address());

    let contract_id = env.register_contract(None, OrakelMarket);
    let contract = OrakelMarketClient::new(&env, &contract_id);

    // 1% protocol fee, 1% LP fee.
    contract.initialize(&admin, &arbiter, &token_id.address(), &100, &100, &BOND);

    token_admin.mint(&admin, &(100_000 * UNIT));

    Setup {
        env,
        contract,
        token_admin,
        token,
        admin,
        arbiter,
    }
}

fn create_default_market(s: &Setup) -> u64 {
    s.contract.create_market(
        &s.admin,
        &String::from_str(&s.env, "Will Team A beat Team B?"),
        &Symbol::new(&s.env, "football"),
        &String::from_str(&s.env, "ipfs://criteria-cid"),
        &10_000u64,          // lock_time
        &20_000u64,          // resolve_time
        &DISPUTE_WINDOW,     // dispute_window
        &(500 * UNIT),       // position_cap
        &BOND,
        &SEED,
    )
}

fn fund(s: &Setup, who: &Address, amount: i128) {
    s.token_admin.mint(who, &amount);
}

fn warp(s: &Setup, t: u64) {
    s.env.ledger().with_mut(|l| l.timestamp = t);
}

#[test]
fn happy_path_buy_propose_finalize_claim() {
    let s = setup();
    let id = create_default_market(&s);
    let alice = Address::generate(&s.env);
    fund(&s, &alice, 1_000 * UNIT);

    // Alice buys YES with 100 USDC.
    let shares = s.contract.buy(&id, &alice, &true, &(100 * UNIT), &0);
    assert!(shares > 100 * UNIT); // YES cheaper than 1.0 pre-resolution
    let price = s.contract.yes_price_bps(&id);
    assert!(price > 5_000); // buying YES pushed the price above 50%

    // Match ends; keeper proposes YES.
    warp(&s, 20_001);
    let keeper = Address::generate(&s.env);
    fund(&s, &keeper, BOND);
    s.contract.propose(&id, &keeper, &Outcome::Yes);

    // Window passes undisputed; anyone finalizes; keeper's bond returned.
    warp(&s, 20_001 + DISPUTE_WINDOW);
    s.contract.finalize(&id);
    assert_eq!(s.token.balance(&keeper), BOND);

    // Alice claims 1 USDC per YES share.
    let payout = s.contract.claim(&id, &alice);
    assert_eq!(payout, shares);
    // She spent 100, got back more than 100.
    assert!(s.token.balance(&alice) > 1_000 * UNIT - 100 * UNIT + 100 * UNIT - UNIT);

    // Admin (sole LP) redeems the pool.
    let lp_payout = s.contract.claim_lp(&id, &s.admin);
    assert!(lp_payout > 0);

    // Solvency: contract still covers everything outstanding (dust only left).
    let m = s.contract.get_market(&id);
    assert!(s.token.balance(&s.contract.address) >= m.collateral_locked);
}

#[test]
fn dispute_overturns_bad_proposal() {
    let s = setup();
    let id = create_default_market(&s);
    let alice = Address::generate(&s.env);
    fund(&s, &alice, 1_000 * UNIT);
    s.contract.buy(&id, &alice, &false, &(50 * UNIT), &0); // Alice holds NO

    warp(&s, 20_001);
    let liar = Address::generate(&s.env);
    fund(&s, &liar, BOND);
    s.contract.propose(&id, &liar, &Outcome::Yes); // wrong outcome

    let watcher = Address::generate(&s.env);
    fund(&s, &watcher, BOND);
    s.contract.dispute(&id, &watcher);

    // Arbiter (multisig account) overturns to NO.
    s.contract.arbiter_resolve(&id, &Outcome::No);

    // Watcher got bond back + half the liar's bond.
    assert_eq!(s.token.balance(&watcher), BOND + BOND / 2);
    // Liar lost the whole bond.
    assert_eq!(s.token.balance(&liar), 0);

    // Alice's NO shares pay out.
    let payout = s.contract.claim(&id, &alice);
    assert!(payout > 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // TradingLocked
fn cannot_trade_after_lock_time() {
    let s = setup();
    let id = create_default_market(&s);
    let alice = Address::generate(&s.env);
    fund(&s, &alice, 1_000 * UNIT);
    warp(&s, 10_000); // exactly lock_time
    s.contract.buy(&id, &alice, &true, &(10 * UNIT), &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #21)")] // PositionCapExceeded
fn position_cap_enforced() {
    let s = setup();
    let id = create_default_market(&s);
    let whale = Address::generate(&s.env);
    fund(&s, &whale, 10_000 * UNIT);
    s.contract.buy(&id, &whale, &true, &(400 * UNIT), &0);
    s.contract.buy(&id, &whale, &true, &(101 * UNIT), &0); // 501 > 500 cap
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")] // TooEarlyToPropose
fn cannot_propose_before_resolve_time() {
    let s = setup();
    let id = create_default_market(&s);
    let keeper = Address::generate(&s.env);
    fund(&s, &keeper, BOND);
    warp(&s, 15_000); // after lock, before resolve_time
    s.contract.propose(&id, &keeper, &Outcome::Yes);
}

#[test]
#[should_panic(expected = "Error(Contract, #14)")] // DisputeWindowOpen
fn cannot_finalize_during_window() {
    let s = setup();
    let id = create_default_market(&s);
    warp(&s, 20_001);
    let keeper = Address::generate(&s.env);
    fund(&s, &keeper, BOND);
    s.contract.propose(&id, &keeper, &Outcome::Yes);
    warp(&s, 20_001 + DISPUTE_WINDOW - 1);
    s.contract.finalize(&id);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")] // DisputeWindowClosed
fn cannot_dispute_after_window() {
    let s = setup();
    let id = create_default_market(&s);
    warp(&s, 20_001);
    let keeper = Address::generate(&s.env);
    fund(&s, &keeper, BOND);
    s.contract.propose(&id, &keeper, &Outcome::Yes);
    warp(&s, 20_001 + DISPUTE_WINDOW);
    let d = Address::generate(&s.env);
    fund(&s, &d, BOND);
    s.contract.dispute(&id, &d);
}

#[test]
fn void_pays_half_to_both_sides() {
    let s = setup();
    let id = create_default_market(&s);
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);
    fund(&s, &alice, 1_000 * UNIT);
    fund(&s, &bob, 1_000 * UNIT);
    let ya = s.contract.buy(&id, &alice, &true, &(100 * UNIT), &0);
    let nb = s.contract.buy(&id, &bob, &false, &(100 * UNIT), &0);

    warp(&s, 20_001);
    let keeper = Address::generate(&s.env);
    fund(&s, &keeper, BOND);
    s.contract.propose(&id, &keeper, &Outcome::Void); // match cancelled
    warp(&s, 20_001 + DISPUTE_WINDOW);
    s.contract.finalize(&id);

    assert_eq!(s.contract.claim(&id, &alice), ya / 2);
    assert_eq!(s.contract.claim(&id, &bob), nb / 2);
}

#[test]
fn sell_roundtrip_never_profits_trader() {
    let s = setup();
    let id = create_default_market(&s);
    let alice = Address::generate(&s.env);
    fund(&s, &alice, 1_000 * UNIT);
    let start = s.token.balance(&alice);

    let shares = s.contract.buy(&id, &alice, &true, &(100 * UNIT), &0);
    let out = s.contract.sell(&id, &alice, &true, &shares, &0);
    // Fees + rounding guarantee a loss on an immediate round trip.
    assert!(out < 100 * UNIT);
    assert!(s.token.balance(&alice) < start);

    // AMM invariant never decreased.
    let m = s.contract.get_market(&id);
    assert!(m.yes_reserve * m.no_reserve >= SEED * SEED);
}

#[test]
fn pause_blocks_trading_but_not_exits() {
    let s = setup();
    let id = create_default_market(&s);
    let alice = Address::generate(&s.env);
    fund(&s, &alice, 1_000 * UNIT);
    let shares = s.contract.buy(&id, &alice, &true, &(100 * UNIT), &0);

    warp(&s, 20_001);
    let keeper = Address::generate(&s.env);
    fund(&s, &keeper, BOND);
    s.contract.propose(&id, &keeper, &Outcome::Yes);

    s.contract.set_paused(&true);

    // Exits still work while paused.
    warp(&s, 20_001 + DISPUTE_WINDOW);
    s.contract.finalize(&id);
    assert_eq!(s.contract.claim(&id, &alice), shares);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // Paused
fn pause_blocks_buys() {
    let s = setup();
    let id = create_default_market(&s);
    s.contract.set_paused(&true);
    let alice = Address::generate(&s.env);
    fund(&s, &alice, 1_000 * UNIT);
    s.contract.buy(&id, &alice, &true, &(10 * UNIT), &0);
}

#[test]
fn lp_add_remove_roundtrip() {
    let s = setup();
    let id = create_default_market(&s);
    let lp = Address::generate(&s.env);
    fund(&s, &lp, 1_000 * UNIT);

    let minted = s.contract.add_liquidity(&id, &lp, &(200 * UNIT));
    assert!(minted > 0);
    s.contract.remove_liquidity(&id, &lp, &minted);

    // Got back ~equal YES and NO shares (reserves were balanced).
    let pos = s.contract.get_user_position(&id, &lp);
    assert!(pos.yes > 0 && pos.no > 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #27)")] // SelfDispute
fn proposer_cannot_dispute_self() {
    let s = setup();
    let id = create_default_market(&s);
    warp(&s, 20_001);
    let keeper = Address::generate(&s.env);
    fund(&s, &keeper, 2 * BOND);
    s.contract.propose(&id, &keeper, &Outcome::Yes);
    s.contract.dispute(&id, &keeper);
}

#[test]
fn slippage_protection_reverts() {
    let s = setup();
    let id = create_default_market(&s);
    let alice = Address::generate(&s.env);
    fund(&s, &alice, 1_000 * UNIT);
    let res = s
        .contract
        .try_buy(&id, &alice, &true, &(100 * UNIT), &(1_000 * UNIT));
    assert!(res.is_err()); // demanded impossible output
}
