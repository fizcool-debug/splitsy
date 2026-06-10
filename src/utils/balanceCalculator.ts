import type { Group, Expense, Settlement, Member } from '../services/backendSelector';

export interface MemberBalance {
  memberId: string;
  name: string;
  netBalance: number;
}

export interface SimplifiedDebt {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

/**
 * Calculates net balances for all members in a group.
 * Positive balance = they are owed money.
 * Negative balance = they owe money.
 */
export function calculateBalances(
  group: Group,
  expenses: Expense[],
  settlements: Settlement[]
): MemberBalance[] {
  const balances: Record<string, number> = {};

  // Initialize balances to 0 for all members
  group.members.forEach((m) => {
    balances[m.id] = 0;
  });

  // Process expenses
  expenses.forEach((exp) => {
    // Add the full paid amount to the payer's balance
    if (balances[exp.paidBy] !== undefined) {
      balances[exp.paidBy] += exp.amount;
    }

    // Deduct each split amount from the respective member's balance
    exp.splits.forEach((split) => {
      if (balances[split.memberId] !== undefined) {
        balances[split.memberId] -= split.amount;
      }
    });
  });

  // Process settlements
  settlements.forEach((set) => {
    // Payer's balance increases (they paid their debt)
    if (balances[set.fromMemberId] !== undefined) {
      balances[set.fromMemberId] += set.amount;
    }
    // Payee's balance decreases (they received their money)
    if (balances[set.toMemberId] !== undefined) {
      balances[set.toMemberId] -= set.amount;
    }
  });

  return group.members.map((m) => ({
    memberId: m.id,
    name: m.name,
    netBalance: parseFloat(balances[m.id].toFixed(2)),
  }));
}

/**
 * Greedy algorithm to minimize transactions (Simplify Debts)
 */
export function simplifyDebts(
  balances: MemberBalance[],
  members: Member[]
): SimplifiedDebt[] {
  // Separate into debtors (owe money) and creditors (are owed money)
  const debtors = balances
    .filter((b) => b.netBalance < -0.01)
    .map((b) => ({ ...b, netBalance: Math.abs(b.netBalance) }))
    .sort((a, b) => b.netBalance - a.netBalance); // Sort descending

  const creditors = balances
    .filter((b) => b.netBalance > 0.01)
    .sort((a, b) => b.netBalance - a.netBalance); // Sort descending

  const debts: SimplifiedDebt[] = [];

  let dIdx = 0;
  let cIdx = 0;

  const getMemberName = (id: string) => {
    return members.find((m) => m.id === id)?.name || 'Unknown User';
  };

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.netBalance, creditor.netBalance);

    if (settleAmount > 0.01) {
      debts.push({
        fromId: debtor.memberId,
        fromName: getMemberName(debtor.memberId),
        toId: creditor.memberId,
        toName: getMemberName(creditor.memberId),
        amount: parseFloat(settleAmount.toFixed(2)),
      });
    }

    debtor.netBalance -= settleAmount;
    creditor.netBalance -= settleAmount;

    if (debtor.netBalance < 0.01) {
      dIdx++;
    }
    if (creditor.netBalance < 0.01) {
      cIdx++;
    }
  }

  return debts;
}
