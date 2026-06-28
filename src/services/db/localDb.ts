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

  async createGroup(name: string, description: string, members: Omit<Member, 'id'>[], creatorId: string, creatorName?: string, creatorUsername?: string): Promise<string> {
    const groupId = 'group_' + Math.random().toString(36).substr(2, 9);
    
    // Create members with unique IDs
    const groupMembers: Member[] = [
      // Creator is added first with their real name and username
      { id: creatorId, name: creatorName || 'Creator', username: creatorUsername }
    ];

    members.forEach((m) => {
      groupMembers.push({
        id: 'member_' + Math.random().toString(36).substr(2, 9),
        name: m.name,
        email: m.email,
        username: m.username
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

  async getGroups(userId: string, userEmail?: string): Promise<Group[]> {
    const groups = await this.getGroupsList();
    // Return groups where the user is the creator, in memberIds, or matches a member's email
    return groups.filter((g) => {
      const isCreator = g.createdBy === userId;
      const isMemberId = g.memberIds.includes(userId);
      const isMemberEmail = userEmail 
        ? g.members.some((m) => m.email && m.email.toLowerCase() === userEmail.toLowerCase()) 
        : false;
      return isCreator || isMemberId || isMemberEmail;
    });
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

  async updateExpense(groupId: string, expense: Expense): Promise<void> {
    const key = `expenses_${groupId}`;
    const expenses = (await localforage.getItem<Expense[]>(key)) || [];
    const index = expenses.findIndex((e) => e.id === expense.id);
    if (index !== -1) {
      expenses[index] = expense;
      await localforage.setItem(key, expenses);
    }
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

  async leaveGroup(groupId: string, memberId: string): Promise<void> {
    const groups = await this.getGroupsList();
    const groupIndex = groups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) {
      throw new Error('Group does not exist.');
    }

    const group = groups[groupIndex];
    const userMember = group.members.find((m) => m.id === memberId);
    if (!userMember) {
      throw new Error('Member not found in group.');
    }

    // Filter out the member
    const updatedMembers = group.members.filter((m) => m.id !== memberId);
    const updatedMemberIds = group.memberIds.filter((id) => id !== memberId);

    // If no members left, delete the group
    if (updatedMembers.length === 0) {
      groups.splice(groupIndex, 1);
      await this.saveGroupsList(groups);
      await localforage.removeItem(`expenses_${groupId}`);
      await localforage.removeItem(`settlements_${groupId}`);
      return;
    }

    // Reassign creator if the creator is leaving
    let newCreatedBy = group.createdBy;
    if (group.createdBy === memberId) {
      newCreatedBy = updatedMembers[0].id;
    }

    groups[groupIndex] = {
      ...group,
      members: updatedMembers,
      memberIds: updatedMemberIds,
      createdBy: newCreatedBy
    };

    await this.saveGroupsList(groups);
  }

  async addGroupMember(groupId: string, member: Omit<Member, 'id'>): Promise<Member> {
    const groups = await this.getGroupsList();
    const groupIndex = groups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) {
      throw new Error('Group does not exist.');
    }

    const group = groups[groupIndex];
    const newMemberId = 'member_' + Math.random().toString(36).substr(2, 9);
    const newMember: Member = {
      id: newMemberId,
      name: member.name,
      email: member.email,
      username: member.username
    };

    const updatedMembers = [...(group.members || []), newMember];
    const updatedMemberIds = [...(group.memberIds || []), newMemberId];

    groups[groupIndex] = {
      ...group,
      members: updatedMembers,
      memberIds: updatedMemberIds
    };

    await this.saveGroupsList(groups);
    return newMember;
  }
}
