import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { DatabaseService, Group, Expense, Settlement, Member } from './types';

export class FirebaseDatabaseService implements DatabaseService {
  private getDbInstance() {
    if (!db) {
      throw new Error('Firestore is not initialized. Please verify your .env configurations.');
    }
    return db;
  }

  async createGroup(name: string, description: string, members: Omit<Member, 'id'>[], creatorId: string, creatorName?: string, creatorUsername?: string): Promise<string> {
    const dbInstance = this.getDbInstance();
    const groupCollectionRef = collection(dbInstance, 'groups');
    const docRef = doc(groupCollectionRef); // Pre-generate ID
    
    // Create members with unique IDs (using client-side generation or database)
    const groupMembers: Member[] = [
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

    const memberEmails = groupMembers
      .map((m) => m.email?.toLowerCase())
      .filter(Boolean) as string[];

    const newGroupData = {
      id: docRef.id,
      name,
      description,
      createdAt: Date.now(),
      createdBy: creatorId,
      members: groupMembers,
      memberIds: groupMembers.map((m) => m.id),
      memberEmails
    };

    // Set document inside Firestore in a single write operation
    await setDoc(docRef, newGroupData);
    
    return docRef.id;
  }

  async getGroups(userId: string, userEmail?: string): Promise<Group[]> {
    const dbInstance = this.getDbInstance();
    const groups: Group[] = [];
    
    // 1. Fetch groups where memberIds contains userId
    const q = query(
      collection(dbInstance, 'groups'),
      where('memberIds', 'array-contains', userId)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      groups.push({ ...doc.data() } as Group);
    });

    // 2. Fetch groups where memberEmails contains userEmail
    if (userEmail) {
      const qEmail = query(
        collection(dbInstance, 'groups'),
        where('memberEmails', 'array-contains', userEmail.toLowerCase())
      );
      const emailSnapshot = await getDocs(qEmail);
      emailSnapshot.forEach((doc) => {
        const g = doc.data() as Group;
        if (!groups.some((existing) => existing.id === g.id)) {
          groups.push(g);
        }
      });
    }

    // 3. Fetch groups created by this user as a fallback
    const qCreated = query(
      collection(dbInstance, 'groups'),
      where('createdBy', '==', userId)
    );
    const createdSnapshot = await getDocs(qCreated);
    createdSnapshot.forEach((doc) => {
      const g = doc.data() as Group;
      if (!groups.some((existing) => existing.id === g.id)) {
        groups.push(g);
      }
    });

    return groups.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getGroupDetails(groupId: string): Promise<Group | null> {
    const dbInstance = this.getDbInstance();
    const docRef = doc(dbInstance, 'groups', groupId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as Group;
    }
    return null;
  }

  async addExpense(expense: Omit<Expense, 'id'>): Promise<string> {
    const dbInstance = this.getDbInstance();
    const expenseCollectionRef = collection(dbInstance, 'groups', expense.groupId, 'expenses');
    const docRef = doc(expenseCollectionRef); // Pre-generate ID
    
    const newExpense = { ...expense, id: docRef.id };
    await setDoc(docRef, newExpense);
    
    return docRef.id;
  }

  async updateExpense(groupId: string, expense: Expense): Promise<void> {
    const dbInstance = this.getDbInstance();
    const docRef = doc(dbInstance, 'groups', groupId, 'expenses', expense.id);
    await setDoc(docRef, expense);
  }

  async deleteExpense(groupId: string, expenseId: string): Promise<void> {
    const dbInstance = this.getDbInstance();
    const docRef = doc(dbInstance, 'groups', groupId, 'expenses', expenseId);
    await deleteDoc(docRef);
  }

  async getExpenses(groupId: string): Promise<Expense[]> {
    const dbInstance = this.getDbInstance();
    const q = query(
      collection(dbInstance, 'groups', groupId, 'expenses'),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const expenses: Expense[] = [];
    querySnapshot.forEach((doc) => {
      expenses.push({ ...doc.data() } as Expense);
    });

    return expenses;
  }

  async addSettlement(settlement: Omit<Settlement, 'id'>): Promise<string> {
    const dbInstance = this.getDbInstance();
    const settlementCollectionRef = collection(dbInstance, 'groups', settlement.groupId, 'settlements');
    const docRef = doc(settlementCollectionRef); // Pre-generate ID
    
    const newSettlement = { ...settlement, id: docRef.id };
    await setDoc(docRef, newSettlement);
    
    return docRef.id;
  }

  async getSettlements(groupId: string): Promise<Settlement[]> {
    const dbInstance = this.getDbInstance();
    const q = query(
      collection(dbInstance, 'groups', groupId, 'settlements'),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const settlements: Settlement[] = [];
    querySnapshot.forEach((doc) => {
      settlements.push({ ...doc.data() } as Settlement);
    });

    return settlements;
  }

  async leaveGroup(groupId: string, memberId: string): Promise<void> {
    const dbInstance = this.getDbInstance();
    const docRef = doc(dbInstance, 'groups', groupId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Group does not exist.');
    }

    const group = docSnap.data() as Group;
    const userMember = group.members.find((m) => m.id === memberId);
    if (!userMember) {
      throw new Error('Member not found in group.');
    }

    // Filter out the member
    const updatedMembers = group.members.filter((m) => m.id !== memberId);
    const updatedMemberIds = group.memberIds.filter((id) => id !== memberId);
    
    // Update memberEmails by filtering out this member's email
    const updatedMemberEmails = updatedMembers
      .map((m) => m.email?.toLowerCase())
      .filter(Boolean) as string[];

    // If no members left, delete the group document
    if (updatedMembers.length === 0) {
      await deleteDoc(docRef);
      return;
    }

    // Reassign creator if the creator is leaving
    let newCreatedBy = group.createdBy;
    if (group.createdBy === memberId) {
      newCreatedBy = updatedMembers[0].id;
    }

    await setDoc(docRef, {
      ...group,
      members: updatedMembers,
      memberIds: updatedMemberIds,
      memberEmails: updatedMemberEmails,
      createdBy: newCreatedBy
    });
  }

  async addGroupMember(groupId: string, member: Omit<Member, 'id'>): Promise<Member> {
    const dbInstance = this.getDbInstance();
    const docRef = doc(dbInstance, 'groups', groupId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Group not found');
    }
    const groupData = docSnap.data() as Group;
    const newMemberId = 'member_' + Math.random().toString(36).substr(2, 9);
    const newMember: Member = {
      id: newMemberId,
      name: member.name,
      email: member.email,
      username: member.username
    };

    const updatedMembers = [...(groupData.members || []), newMember];
    const updatedMemberIds = [...(groupData.memberIds || []), newMemberId];
    
    // Update emails list
    let updatedMemberEmails = groupData.memberEmails || [];
    if (member.email) {
      const emailLower = member.email.toLowerCase();
      if (!updatedMemberEmails.includes(emailLower)) {
        updatedMemberEmails = [...updatedMemberEmails, emailLower];
      }
    }

    await setDoc(docRef, {
      ...groupData,
      members: updatedMembers,
      memberIds: updatedMemberIds,
      memberEmails: updatedMemberEmails
    });

    return newMember;
  }
}
