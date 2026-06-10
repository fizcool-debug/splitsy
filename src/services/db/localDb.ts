import localforage from 'localforage';
import type { DatabaseService, Group, Expense, Settlement, Member } from './types';

const GROUPS_KEY = 'splitsy_groups';

// Configure localforage
localforage.config({
  name: 'splitsy_db',
  storeName: 'splitsy_store'
});

export class LocalDatabaseService implements DatabaseService {
  private async getGroupsList(): Promise<Group[]> {
    const list = await localforage.getItem<Group[]>(GROUPS_KEY);
    return list || [];
  }

  private async saveGroupsList(groups: Group[]): Promise<void> {
    await localforage.setItem(GROUPS_KEY, groups);
  }

  async createGroup(name: string, description: string, members: Omit<Member, 'id'>[], creatorId: string): Promise<string> {
    const groupId = 'group_' + Math.random().toString(36).substr(2, 9);
    
    // Create members with unique IDs
    const groupMembers: Member[] = [
      // Creator is added first
      { id: creatorId, name: 'You (Creator)' }
    ];

    members.forEach((m) => {
      groupMembers.push({
        id: 'member_' + Math.random().toString(36).substr(2, 9),
        name: m.name,
        email: m.email
      });
    });

    const newGroup: Group = {
      id: groupId,
      name,
      description,
      createdAt: Date.now(),
      createdBy: creatorId,
      members: groupMembers,
      memberIds: groupMembers.map((m) => m.id)
    };

    const groups = await this.getGroupsList();
    groups.push(newGroup);
    await this.saveGroupsList(groups);

    // Initialize empty expense and settlement lists for this group
    await localforage.setItem(`expenses_${groupId}`, []);
    await localforage.setItem(`settlements_${groupId}`, []);

    return groupId;
  }

  async getGroups(userId: string): Promise<Group[]> {
    const groups = await this.getGroupsList();
    // In local-first, the current user might have different uids, but we'll return
    // groups where the user is in memberIds or created the group.
    return groups.filter((g) => g.createdBy === userId || g.memberIds.includes(userId));
  }

  async getGroupDetails(groupId: string): Promise<Group | null> {
    const groups = await this.getGroupsList();
    return groups.find((g) => g.id === groupId) || null;
  }

  async addExpense(expense: Omit<Expense, 'id'>): Promise<string> {
    const expenseId = 'expense_' + Math.random().toString(36).substr(2, 9);
    const newExpense: Expense = {
      ...expense,
      id: expenseId
    };

    const key = `expenses_${expense.groupId}`;
    const expenses = (await localforage.getItem<Expense[]>(key)) || [];
    expenses.push(newExpense);
    await localforage.setItem(key, expenses);

    return expenseId;
  }

  async deleteExpense(groupId: string, expenseId: string): Promise<void> {
    const key = `expenses_${groupId}`;
    const expenses = (await localforage.getItem<Expense[]>(key)) || [];
    const filtered = expenses.filter((e) => e.id !== expenseId);
    await localforage.setItem(key, filtered);
  }

  async getExpenses(groupId: string): Promise<Expense[]> {
    const key = `expenses_${groupId}`;
    const expenses = await localforage.getItem<Expense[]>(key);
    return expenses || [];
  }

  async addSettlement(settlement: Omit<Settlement, 'id'>): Promise<string> {
    const settlementId = 'settlement_' + Math.random().toString(36).substr(2, 9);
    const newSettlement: Settlement = {
      ...settlement,
      id: settlementId
    };

    const key = `settlements_${settlement.groupId}`;
    const settlements = (await localforage.getItem<Settlement[]>(key)) || [];
    settlements.push(newSettlement);
    await localforage.setItem(key, settlements);

    return settlementId;
  }

  async getSettlements(groupId: string): Promise<Settlement[]> {
    const key = `settlements_${groupId}`;
    const settlements = await localforage.getItem<Settlement[]>(key);
    return settlements || [];
  }
}
