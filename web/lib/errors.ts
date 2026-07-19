export function humanizeContractError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/lock|too late|not open|Error\(Contract, #8\)/i.test(message)) return "Trading is closed for this market.";
  if (/slippage|Error\(Contract, #20\)/i.test(message)) return "Price moved, try again.";
  if (/archiv|footprint/i.test(message)) return "Your position needs storage restoration.";
  if (/LoansDisabled|loan.*disabled|Error\(Contract, #29\)/i.test(message)) return "Loans are not enabled for this contract yet.";
  if (/LoanReserveTooSmall|reserve.*small|Error\(Contract, #33\)/i.test(message)) return "The loan pool does not have enough available funds.";
  if (/LoanTooLarge|loan.*large|Error\(Contract, #32\)/i.test(message)) return "This loan exceeds the 3x leverage limit.";
  if (/LoanAlreadyExists|already.*loan|Error\(Contract, #30\)/i.test(message)) return "Repay your current loan before opening another one.";
  if (/InsufficientShares|Error\(Contract, #22\)/i.test(message)) return "You do not have enough shares for this action.";
  if (/InvalidAmount|Error\(Contract, #7\)/i.test(message)) return "Enter valid amounts greater than zero.";
  return message || "The transaction could not be completed.";
}
