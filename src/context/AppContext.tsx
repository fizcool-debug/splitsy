import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  authService, 
  databaseService 
} from '../services/backendSelector';
import type { 
  UserProfile, 
  Group, 
  Expense, 
  Settlement, 
  Member 
} from '../services/backendSelector';

interface AppContextType {
  user: UserProfile | null;
  authLoading: boolean;
  groups: Group[];
  groupsLoading: boolean;
  currentGroup: Group | null;
  currentGroupLoading: boolean;
  expenses: Expense[];
  settlements: Settlement[];
  refreshGroups: () => Promise<void>;
  setCurrentGroupId: (groupId: string | null) => void;
  refreshCurrentGroup: () => Promise<void>;
  createGroup: (name: string, description: string, members: Omit<Member, 'id'>[]) => Promise<string>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdById'>) => Promise<string>;
  deleteExpense: (expenseId: string) => Promise<void>;
  addSettlement: (settlement: Omit<Settlement, 'id' | 'createdById'>) => Promise<string>;
  leaveGroup: (groupId: string, memberId: string) => Promise<void>;
  signOut: () => Promise<void>;
  currency: string;
  setCurrency: (symbol: string) => void;
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [currentGroupId, setCurrentGroupIdState] = useState<string | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [currentGroupLoading, setCurrentGroupLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [currency, setCurrencyState] = useState<string>(() => {
    return localStorage.getItem('splitsy_currency') || '₹';
  });

  const setCurrency = (symbol: string) => {
    setCurrencyState(symbol);
    localStorage.setItem('splitsy_currency', symbol);
  };

  const [theme, setThemeState] = useState<'dark' | 'light' | 'system'>(() => {
    return (localStorage.getItem('splitsy_theme') as 'dark' | 'light' | 'system') || 'system';
  });

  const setTheme = (t: 'dark' | 'light' | 'system') => {
    setThemeState(t);
    localStorage.setItem('splitsy_theme', t);
  };

  // Apply theme class to document body with system preference fallback
  useEffect(() => {
    const applyTheme = () => {
      let activeTheme: 'dark' | 'light' = 'dark';
      if (theme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        activeTheme = theme;
      }
      document.body.setAttribute('data-theme', activeTheme);
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  // Watch Authentication State
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((profile) => {
      setUser(profile);
      setAuthLoading(false);
      if (!profile) {
        setGroups([]);
        setCurrentGroup(null);
        setExpenses([]);
        setSettlements([]);
        setCurrentGroupIdState(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch Groups
  const refreshGroups = useCallback(async () => {
    if (!user) return;
    setGroupsLoading(true);
    try {
      const list = await databaseService.getGroups(user.uid, user.email);
      setGroups(list);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setGroupsLoading(false);
    }
  }, [user]);

  // Load groups when user logs in
  useEffect(() => {
    if (user) {
      refreshGroups();
    }
  }, [user, refreshGroups]);

  // Fetch Current Group Details, Expenses and Settlements
  const refreshCurrentGroup = useCallback(async () => {
    if (!currentGroupId || !user) return;
    setCurrentGroupLoading(true);
    try {
      const [details, expList, setList] = await Promise.all([
        databaseService.getGroupDetails(currentGroupId),
        databaseService.getExpenses(currentGroupId),
        databaseService.getSettlements(currentGroupId)
      ]);
      setCurrentGroup(details);
      setExpenses(expList);
      setSettlements(setList);
    } catch (error) {
      console.error('Failed to fetch group details:', error);
    } finally {
      setCurrentGroupLoading(false);
    }
  }, [currentGroupId, user]);

  // Reload current group when active ID changes
  useEffect(() => {
    if (currentGroupId) {
      refreshCurrentGroup();
    } else {
      setCurrentGroup(null);
      setExpenses([]);
      setSettlements([]);
    }
  }, [currentGroupId, refreshCurrentGroup]);

  const setCurrentGroupId = (groupId: string | null) => {
    setCurrentGroupIdState(groupId);
  };

  const createGroup = async (name: string, description: string, members: Omit<Member, 'id'>[]) => {
    if (!user) throw new Error('Not authenticated');
    const groupId = await databaseService.createGroup(name, description, members, user.uid);
    await refreshGroups();
    return groupId;
  };

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdById'>) => {
    if (!user) throw new Error('Not authenticated');
    const expenseId = await databaseService.addExpense({
      ...expense,
      createdById: user.uid
    });
    await refreshCurrentGroup();
    return expenseId;
  };

  const deleteExpense = async (expenseId: string) => {
    if (!user || !currentGroupId) throw new Error('Not authorized');
    await databaseService.deleteExpense(currentGroupId, expenseId);
    await refreshCurrentGroup();
  };

  const addSettlement = async (settlement: Omit<Settlement, 'id' | 'createdById'>) => {
    if (!user) throw new Error('Not authenticated');
    const settlementId = await databaseService.addSettlement({
      ...settlement,
      createdById: user.uid
    });
    await refreshCurrentGroup();
    return settlementId;
  };

  const leaveGroup = async (groupId: string, memberId: string) => {
    if (!user) throw new Error('Not authenticated');
    await databaseService.leaveGroup(groupId, memberId);
    await refreshGroups();
  };

  const signOut = async () => {
    await authService.signOut();
  };

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        groups,
        groupsLoading,
        currentGroup,
        currentGroupLoading,
        expenses,
        settlements,
        refreshGroups,
        setCurrentGroupId,
        refreshCurrentGroup,
        createGroup,
        addExpense,
        deleteExpense,
        addSettlement,
        leaveGroup,
        signOut,
        currency,
        setCurrency,
        theme,
        setTheme
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
