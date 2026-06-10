import { 
  collection, 
  doc, 
  addDoc, 
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

  async createGroup(name: string, description: string, members: Omit<Member, 'id'>[], creatorId: string): Promise<string> {
    const dbInstance = this.getDbInstance();
    const groupCollectionRef = collection(dbInstance, 'groups');
    
    // Create members with unique IDs (using client-side generation or database)
    const groupMembers: Member[] = [
      { id: creatorId, name: 'You (Creator)' }
    ];

    members.forEach((m) => {
      groupMembers.push({
        id: 'member_' + Math.random().toString(36).substr(2, 9),
        name: m.name,
        email: m.email
      });
    });

    const newGroupData = {
      name,
      description,
      createdAt: Date.now(),
      createdBy: creatorId,
      members: groupMembers,
      memberIds: groupMembers.map((m) => m.id)
    };

    // Add document to groups
    const docRef = await addDoc(groupCollectionRef, newGroupData);
    
    // Save the ID inside the document as well
    await setDoc(docRef, { ...newGroupData, id: docRef.id });
    
    return docRef.id;
  }

  async getGroups(userId: string): Promise<Group[]> {
    const dbInstance = this.getDbInstance();
    const q = query(
      collection(dbInstance, 'groups'),
      where('memberIds', 'array-contains', userId)
    );

    const querySnapshot = await getDocs(q);
    const groups: Group[] = [];
    querySnapshot.forEach((doc) => {
      groups.push({ ...doc.data() } as Group);
    });

    // Also fetch groups created by this user as a fallback
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
    
    const docRef = await addDoc(expenseCollectionRef, expense);
    await setDoc(docRef, { ...expense, id: docRef.id });
    
    return docRef.id;
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
    
    const docRef = await addDoc(settlementCollectionRef, settlement);
    await setDoc(docRef, { ...settlement, id: docRef.id });
    
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
}
