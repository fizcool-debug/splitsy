export interface Member {
  id: string;
  name: string;
  email?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  createdBy: string;
  members: Member[];
  memberIds: string[];
}

export interface SplitDetail {
  memberId: string;
  amount: number; // The share this person owes
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  date: number; // timestamp
  paidBy: string; // memberId
  category: string;
  splits: SplitDetail[]; // List of splits for each member
  createdById: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  amount: number;
  date: number;
  fromMemberId: string;
  toMemberId: string;
  createdById: string;
}

export interface DatabaseService {
  createGroup(name: string, description: string, members: Omit<Member, 'id'>[], creatorId: string): Promise<string>;
  getGroups(userId: string): Promise<Group[]>;
  getGroupDetails(groupId: string): Promise<Group | null>;
  addExpense(expense: Omit<Expense, 'id'>): Promise<string>;
  deleteExpense(groupId: string, expenseId: string): Promise<void>;
  getExpenses(groupId: string): Promise<Expense[]>;
  addSettlement(settlement: Omit<Settlement, 'id'>): Promise<string>;
  getSettlements(groupId: string): Promise<Settlement[]>;
}
