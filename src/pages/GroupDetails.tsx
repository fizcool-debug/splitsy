import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calculateBalances, simplifyDebts } from '../utils/balanceCalculator';
import { Modal } from '../components/Modal';
import { getMemberIdForUser } from '../utils/userResolver';
import type { Expense, Member, SplitDetail } from '../services/backendSelector';
import { 
  ArrowLeft, 
  Plus, 
  DollarSign, 
  Trash2, 
  CheckCircle,
  FileText, 
  Utensils, 
  Home, 
  Zap, 
  Beer,
  Calendar,
  Layers,
  RefreshCw,
  LogOut,
  Edit2,
  UserPlus,
  AtSign
} from 'lucide-react';
import './GroupDetails.css';

const CATEGORIES = [
  { value: 'other', label: 'Other', icon: FileText },
  { value: 'food', label: 'Food & Dining', icon: Utensils },
  { value: 'rent', label: 'Rent', icon: Home },
  { value: 'utilities', label: 'Utilities & Bills', icon: Zap },
  { value: 'entertainment', label: 'Entertainment/Drinks', icon: Beer },
];

export const GroupDetails: React.FC = () => {
  const { 
    user, 
    currentGroup, 
    currentGroupLoading, 
    expenses, 
    settlements, 
    setCurrentGroupId,
    addExpense,
    updateExpense,
    deleteExpense,
    addSettlement,
    currency,
    refreshCurrentGroup,
    leaveGroup,
    addGroupMember,
    getUserByUsername
  } = useApp();

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
  const [leaving, setLeaving] = useState(false);

  const myMemberId = React.useMemo(() => {
    return getMemberIdForUser(currentGroup, user);
  }, [currentGroup, user]);
  
  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Add Member form state
  const [addMemberInput, setAddMemberInput] = useState('');
  const [addMemberError, setAddMemberError] = useState('');
  const [submittingAddMember, setSubmittingAddMember] = useState(false);
  const [memberLookupStatus, setMemberLookupStatus] = useState<'idle' | 'searching' | 'found' | 'notfound'>('idle');
  const [memberLookupResult, setMemberLookupResult] = useState<{ name: string; email?: string; username?: string } | null>(null);
  const [lookupTimer, setLookupTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  // Add Expense form state
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('other');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({}); // memberId -> split amount
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  // Settle up form state
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [submittingSettlement, setSubmittingSettlement] = useState(false);
  const [settleError, setSettleError] = useState('');

  if (currentGroupLoading || !currentGroup) {
    return (
      <div className="group-details-loading animate-fade">
        <span className="spinner"></span>
        <p>Loading group details...</p>
      </div>
    );
  }

  // Calculate balances & simplified debts
  const memberBalances = calculateBalances(currentGroup, expenses, settlements);
  const simplifiedDebts = simplifyDebts(memberBalances, currentGroup.members);

  // Initialize custom splits if they are empty
  const openAddExpenseModal = () => {
    setEditingExpense(null);
    setExpensePaidBy(myMemberId || currentGroup.members[0]?.id || '');
    const initialSplits: Record<string, string> = {};
    currentGroup.members.forEach((m) => {
      initialSplits[m.id] = '';
    });
    setCustomSplits(initialSplits);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseCategory('other');
    setSplitType('equal');
    setExpenseError('');
    setIsExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseTitle(exp.title || '');
    setExpenseAmount(exp.amount.toString());
    setExpensePaidBy(exp.paidBy || '');
    setExpenseCategory(exp.category || 'other');
    
    // Determine split type (equal vs custom)
    const membersCount = currentGroup.members.length;
    const equalShare = parseFloat((exp.amount / membersCount).toFixed(2));
    const isActuallyEqual = exp.splits && exp.splits.length === membersCount && exp.splits.every((s: SplitDetail) => {
      return Math.abs(s.amount - equalShare) <= 0.05;
    });
    
    setSplitType(isActuallyEqual ? 'equal' : 'custom');

    const initialSplits: Record<string, string> = {};
    currentGroup.members.forEach((m) => {
      const existingSplit = exp.splits ? exp.splits.find((s: SplitDetail) => s.memberId === m.id) : null;
      initialSplits[m.id] = existingSplit ? existingSplit.amount.toString() : '';
    });
    setCustomSplits(initialSplits);
    setExpenseError('');
    setIsExpenseModalOpen(true);
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    if (!expenseTitle.trim() || isNaN(amount) || amount <= 0 || !expensePaidBy) {
      setExpenseError('Please enter a valid title and amount.');
      return;
    }

    let splitsData: { memberId: string; amount: number }[] = [];

    if (splitType === 'equal') {
      const splitAmount = parseFloat((amount / currentGroup.members.length).toFixed(2));
      let runningSum = 0;
      
      // Calculate equal splits, adjust the last person for rounding differences
      splitsData = currentGroup.members.map((m, idx) => {
        const isLast = idx === currentGroup.members.length - 1;
        const currentSplit = isLast ? parseFloat((amount - runningSum).toFixed(2)) : splitAmount;
        runningSum += currentSplit;
        return {
          memberId: m.id,
          amount: currentSplit
        };
      });
    } else {
      // Custom splits validation
      let sum = 0;
      const customSplitsMapped = currentGroup.members.map((m) => {
        const splitVal = parseFloat(customSplits[m.id]);
        const splitValNum = isNaN(splitVal) ? 0 : splitVal;
        sum += splitValNum;
        return {
          memberId: m.id,
          amount: parseFloat(splitValNum.toFixed(2))
        };
      });

      if (Math.abs(sum - amount) > 0.05) {
        setExpenseError(`Sum of splits (${currency}${sum.toFixed(2)}) must equal total amount (${currency}${amount.toFixed(2)})`);
        return;
      }
      splitsData = customSplitsMapped;
    }

    setSubmittingExpense(true);
    setExpenseError('');
    try {
      if (editingExpense) {
        await updateExpense({
          ...editingExpense,
          title: expenseTitle.trim(),
          amount,
          paidBy: expensePaidBy,
          category: expenseCategory,
          splits: splitsData
        });
      } else {
        await addExpense({
          groupId: currentGroup.id,
          title: expenseTitle.trim(),
          amount,
          date: Date.now(),
          paidBy: expensePaidBy,
          category: expenseCategory,
          splits: splitsData
        });
      }
      setIsExpenseModalOpen(false);
      setEditingExpense(null);
    } catch (err) {
      console.error(err);
      setExpenseError(editingExpense ? 'Failed to update expense.' : 'Failed to add expense.');
    } finally {
      setSubmittingExpense(false);
    }
  };

  const openSettleModal = (fromId?: string, toId?: string, amount?: number) => {
    setSettleFrom(fromId || currentGroup.members[0]?.id || '');
    setSettleTo(toId || currentGroup.members[1]?.id || '');
    setSettleAmount(amount ? amount.toString() : '');
    setSettleError('');
    setIsSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(settleAmount);
    if (!settleFrom || !settleTo || isNaN(amount) || amount <= 0) {
      setSettleError('Please enter a valid amount.');
      return;
    }

    if (settleFrom === settleTo) {
      setSettleError('Cannot settle between the same person.');
      return;
    }

    setSubmittingSettlement(true);
    setSettleError('');
    try {
      await addSettlement({
        groupId: currentGroup.id,
        amount,
        date: Date.now(),
        fromMemberId: settleFrom,
        toMemberId: settleTo
      });
      setIsSettleModalOpen(false);
    } catch (err) {
      console.error(err);
      setSettleError('Failed to log settlement.');
    } finally {
      setSubmittingSettlement(false);
    }
  };

  const handleMemberInputChange = (val: string) => {
    setAddMemberInput(val);
    setMemberLookupResult(null);
    setAddMemberError('');

    if (lookupTimer) clearTimeout(lookupTimer);

    // If input starts with '@' or looks like a username, try to look up the user
    const cleaned = val.startsWith('@') ? val.slice(1) : val;
    if (!cleaned.trim()) {
      setMemberLookupStatus('idle');
      return;
    }

    // Treat as username search if no spaces (usernames have no spaces)
    if (!cleaned.includes(' ') && cleaned.length >= 2) {
      setMemberLookupStatus('searching');
      const timer = setTimeout(async () => {
        try {
          const found = await getUserByUsername(cleaned.toLowerCase());
          if (found) {
            setMemberLookupResult({ 
              name: found.displayName, 
              email: found.email, 
              username: found.username || cleaned 
            });
            setMemberLookupStatus('found');
          } else {
            setMemberLookupStatus('notfound');
            setMemberLookupResult(null);
          }
        } catch {
          setMemberLookupStatus('notfound');
          setMemberLookupResult(null);
        }
      }, 500);
      setLookupTimer(timer);
    } else {
      // Multi-word input treated as plain name
      setMemberLookupStatus('idle');
    }
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = addMemberInput.trim();
    if (!raw) return;

    let memberToAdd: Omit<Member, 'id'>;

    if (memberLookupResult) {
      memberToAdd = { 
        name: memberLookupResult.name, 
        email: memberLookupResult.email, 
        username: memberLookupResult.username 
      };
    } else {
      // Add as plain name-only member (offline/unregistered)
      const cleaned = raw.startsWith('@') ? raw.slice(1) : raw;
      memberToAdd = { name: cleaned };
    }

    // Validation: Check for duplicates in existing members
    const isDuplicate = currentGroup.members.some((m) => {
      // Match by username if available
      if (m.username && memberToAdd.username && m.username.toLowerCase() === memberToAdd.username.toLowerCase()) {
        return true;
      }
      // Match by email if available
      if (m.email && memberToAdd.email && m.email.toLowerCase() === memberToAdd.email.toLowerCase()) {
        return true;
      }
      // Match by name (case-insensitive)
      return m.name.toLowerCase() === memberToAdd.name.toLowerCase();
    });

    if (isDuplicate) {
      setAddMemberError('This member is already in the group.');
      return;
    }

    setSubmittingAddMember(true);
    setAddMemberError('');
    try {
      await addGroupMember(currentGroup.id, memberToAdd);
      
      // Reset form
      setAddMemberInput('');
      setMemberLookupStatus('idle');
      setMemberLookupResult(null);
      setIsAddMemberModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setAddMemberError(err.message || 'Failed to add member to the group.');
    } finally {
      setSubmittingAddMember(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteExpense(id);
      } catch (err) {
        console.error('Failed to delete expense:', err);
      }
    }
  };

  const myNetBalance = React.useMemo(() => {
    const balanceObj = memberBalances.find((mb) => mb.memberId === myMemberId);
    return balanceObj ? balanceObj.netBalance : 0;
  }, [memberBalances, myMemberId]);

  const isSettled = Math.abs(myNetBalance) < 0.01;

  const handleLeaveGroup = async () => {
    if (!currentGroup || !user) return;
    if (window.confirm('Are you sure you want to leave this group? This will remove you from all calculations.')) {
      setLeaving(true);
      try {
        await leaveGroup(currentGroup.id, myMemberId);
        setCurrentGroupId(null); // Go back to dashboard
      } catch (err) {
        console.error('Failed to leave group:', err);
        alert('Failed to leave group. Please check database connectivity.');
      } finally {
        setLeaving(false);
      }
    }
  };

  const triggerLeaveGroup = () => {
    if (!isSettled) {
      alert(`You cannot leave this group because you have an outstanding balance of ${currency}${myNetBalance.toFixed(2)}. Please settle up first.`);
      return;
    }
    handleLeaveGroup();
  };

  const getCategoryIcon = (categoryValue: string) => {
    const cat = CATEGORIES.find((c) => c.value === categoryValue);
    const Icon = cat ? cat.icon : FileText;
    return <Icon size={18} />;
  };

  const getMemberName = (id: string) => {
    const member = currentGroup.members.find((m) => m.id === id);
    if (!member) return 'Unknown';
    // Always show @username if available, otherwise display name
    return member.username ? `@${member.username}` : member.name;
  };

  // Display name (real name) for showing below the username handle
  const getMemberDisplayName = (id: string) => {
    const member = currentGroup.members.find((m) => m.id === id);
    if (!member) return 'Unknown';
    return member.name;
  };

  return (
    <div className="group-details-container animate-fade">
      {/* Back navigation & Actions */}
      <nav className="details-nav-header">
        <button className="btn-back" onClick={() => setCurrentGroupId(null)}>
          <ArrowLeft size={20} />
          <span>Back to Groups</span>
        </button>
        <div className="group-action-btns" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={() => refreshCurrentGroup()}
            disabled={currentGroupLoading}
            title="Sync with database"
            aria-label="Sync with database"
            style={{ 
              padding: '0.625rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px'
            }}
          >
            <RefreshCw size={18} className={currentGroupLoading ? 'spin' : ''} />
          </button>
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={() => setIsAddMemberModalOpen(true)}
            title="Add Member"
            aria-label="Add Member"
            style={{ 
              padding: '0.625rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px'
            }}
          >
            <UserPlus size={18} />
          </button>
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={triggerLeaveGroup}
            disabled={leaving}
            title="Leave Group"
            aria-label="Leave Group"
            style={{ 
              padding: '0.625rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              color: 'var(--danger)',
              background: 'rgba(244, 63, 94, 0.05)',
              border: '1px solid rgba(244, 63, 94, 0.15)'
            }}
          >
            <LogOut size={18} />
          </button>
          <button className="btn btn-secondary" onClick={() => openSettleModal()}>
            Settle Up
          </button>
          <button className="btn btn-primary" onClick={() => openAddExpenseModal()}>
            <Plus size={18} />
            <span>Add Bill</span>
          </button>
        </div>
      </nav>

      {/* Group Info Banner */}
      <header className="group-info-banner glass-panel">
        <h2 className="group-title-text">{currentGroup.name}</h2>
        {currentGroup.description && (
          <p className="group-description-text">{currentGroup.description}</p>
        )}
        <div className="group-meta-stats">
          <span className="meta-badge">
            <Layers size={14} />
            <span>{expenses.length} Expense{expenses.length !== 1 ? 's' : ''}</span>
          </span>
          <span className="meta-badge">
            <Calendar size={14} />
            <span>Created {new Date(currentGroup.createdAt).toLocaleDateString()}</span>
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs-header glass-panel">
        <button 
          className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          Expenses Feed
        </button>
        <button 
          className={`tab-btn ${activeTab === 'balances' ? 'active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          Balances & Settlements
        </button>
      </div>

      {/* Tab Contents */}
      <main className="tab-contents">
        {activeTab === 'expenses' ? (
          <div className="expenses-feed-tab animate-fade">
            {expenses.length === 0 ? (
              <div className="empty-feed glass-panel">
                <DollarSign size={40} className="text-gradient" />
                <h4>No expenses logged yet</h4>
                <p>Add your first shared bill using the button above.</p>
              </div>
            ) : (
              <div className="expenses-list">
                {expenses.map((exp) => {
                  if (!exp) return null;
                  const userPaid = exp.paidBy === myMemberId;
                  
                  // Find what user owes or is owed safely
                  const userSplit = Array.isArray(exp.splits)
                    ? exp.splits.find((s) => s && s.memberId === myMemberId)
                    : null;
                  
                  const amountNum = Number(exp.amount) || 0;
                  const splitAmountNum = userSplit ? (Number(userSplit.amount) || 0) : 0;
                  
                  const userOwedShare = userPaid ? amountNum - splitAmountNum : 0;
                  const userOwesShare = !userPaid && userSplit ? splitAmountNum : 0;

                  return (
                    <div key={exp.id} className="expense-item glass-panel">
                      <div className="expense-left">
                        <div className="category-icon-bg">
                          {getCategoryIcon(exp.category || '')}
                        </div>
                        <div className="expense-text">
                          <h4 className="expense-title">{exp.title || 'Untitled Bill'}</h4>
                          <p className="expense-subtext">
                            Paid by <strong>{getMemberName(exp.paidBy || '')}</strong> &bull; {new Date(exp.date || Date.now()).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="expense-middle">
                        <span className="total-amount">{currency}{amountNum.toFixed(2)}</span>
                        <span className="total-label">total bill</span>
                      </div>

                      <div className="expense-right">
                        {userPaid ? (
                          <div className="user-expense-share text-success">
                            <span className="share-status-label">you lent</span>
                            <span className="share-amount">{currency}{userOwedShare.toFixed(2)}</span>
                          </div>
                        ) : userOwesShare > 0 ? (
                          <div className="user-expense-share text-danger">
                            <span className="share-status-label">you owe</span>
                            <span className="share-amount">{currency}{userOwesShare.toFixed(2)}</span>
                          </div>
                        ) : (
                          <div className="user-expense-share text-muted">
                            <span className="share-status-label">not involved</span>
                            <span className="share-amount">{currency}0.00</span>
                          </div>
                        )}
                        
                        {/* Option to edit/delete expense (Creator or Payer) */}
                        {(exp.createdById === user?.uid || exp.paidBy === myMemberId) && (
                          <div className="expense-actions">
                            <button 
                              className="btn-edit-expense"
                              onClick={() => openEditExpenseModal(exp)}
                              title="Edit expense"
                              aria-label="Edit expense"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              className="btn-delete-expense"
                              onClick={() => handleDeleteExpense(exp.id)}
                              title="Delete expense"
                              aria-label="Delete expense"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="balances-tab animate-fade">
            {/* Simplified Debts Card */}
            <div className="balances-section glass-panel">
              <h3 className="section-sub-title">Suggested Payments (Simplified)</h3>
              <p className="member-search-hint" style={{ marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
                Balances are netted out across all bills to minimize the total number of payments needed to settle up.
              </p>
              {simplifiedDebts.length === 0 ? (
                <div className="empty-debts">
                  <CheckCircle size={36} className="text-success" />
                  <p>Everyone is completely settled up!</p>
                </div>
              ) : (
                <div className="debts-list">
                  {simplifiedDebts.map((debt, index) => {
                    const isUserDebtor = debt.fromId === myMemberId;
                    const isUserCreditor = debt.toId === myMemberId;

                    return (
                      <div key={index} className="debt-item">
                        <div className="debt-info-row">
                          <span className={`member-name-tag ${isUserDebtor ? 'highlight-debtor' : ''}`}>
                            {debt.fromName}
                          </span>
                          <span className="arrow-connector">owes</span>
                          <span className={`member-name-tag ${isUserCreditor ? 'highlight-creditor' : ''}`}>
                            {debt.toName}
                          </span>
                        </div>
                        <div className="debt-settle-row">
                          <span className="debt-amount-tag">{currency}{(debt.amount || 0).toFixed(2)}</span>
                          {(isUserDebtor || isUserCreditor || user?.uid) && (
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => openSettleModal(debt.fromId, debt.toId, debt.amount)}
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Complete Balances Breakdown */}
            <div className="balances-section glass-panel">
              <div className="balances-header-row">
                <h3 className="section-sub-title" style={{ margin: 0 }}>Individual Balances Breakdown</h3>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAddMemberModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <UserPlus size={14} />
                  <span>Add Member</span>
                </button>
              </div>
              <div className="members-balances-list">
                {memberBalances.map((mb) => {
                  if (!mb) return null;
                  const isPositive = mb.netBalance > 0.01;
                  const isNegative = mb.netBalance < -0.01;
                  const isMe = mb.memberId === myMemberId;

                  return (
                    <div key={mb.memberId} className="member-balance-row">
                      <div className="member-row-left">
                        <div className="member-row-avatar">
                          {(mb.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="member-row-name-block">
                          <span className="member-row-name">
                            {getMemberName(mb.memberId)} {isMe ? '' : ''}
                          </span>
                          {!isMe && getMemberDisplayName(mb.memberId) !== getMemberName(mb.memberId) && (
                            <span className="member-row-realname">{getMemberDisplayName(mb.memberId)}</span>
                          )}
                          {isMe && <span className="member-row-you-badge">you</span>}
                        </div>
                      </div>
                      
                      <div className="member-row-right">
                        {isPositive ? (
                          <span className="breakdown-balance text-success">
                            Owed {currency}{(mb.netBalance || 0).toFixed(2)}
                          </span>
                        ) : isNegative ? (
                          <span className="breakdown-balance text-danger">
                            Owes {currency}{Math.abs(mb.netBalance || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className="breakdown-balance text-muted">
                            Settled Up
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Settlements Feed */}
            {settlements.length > 0 && (
              <div className="balances-section glass-panel">
                <h3 className="section-sub-title">Settlement Logs</h3>
                <div className="settlements-feed-list">
                  {settlements.map((set) => {
                    if (!set) return null;
                    return (
                      <div key={set.id} className="settlement-log-item">
                        <CheckCircle size={16} className="text-success" />
                        <div className="settlement-log-text">
                          <strong>{getMemberName(set.fromMemberId || '')}</strong> paid{' '}
                          <strong>{getMemberName(set.toMemberId || '')}</strong>{' '}
                          <span className="text-success font-semibold">{currency}{(set.amount || 0).toFixed(2)}</span>
                          <span className="settlement-date">
                            &bull; {new Date(set.date || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        title={editingExpense ? "Edit Shared Expense" : "Add Shared Expense"}
      >
        <form onSubmit={handleExpenseSubmit} className="add-expense-form">
          {expenseError && (
            <div className="expense-error animate-fade">
              <span className="error-message">{expenseError}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="exp-title-input">Description / Title</label>
            <input 
              id="exp-title-input"
              type="text" 
              placeholder="e.g. Weekly Groceries, Gas, Dinner" 
              value={expenseTitle}
              onChange={(e) => setExpenseTitle(e.target.value)}
              required
              disabled={submittingExpense}
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label htmlFor="exp-amount-input">Amount ({currency})</label>
              <input 
                id="exp-amount-input"
                type="number" 
                step="0.01"
                min="0.01"
                placeholder="0.00" 
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
                disabled={submittingExpense}
              />
            </div>
            
            <div className="form-group flex-1">
              <label htmlFor="exp-category-input">Category</label>
              <select
                id="exp-category-input"
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                disabled={submittingExpense}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="exp-payer-input">Paid By</label>
            <select
              id="exp-payer-input"
              value={expensePaidBy}
              onChange={(e) => setExpensePaidBy(e.target.value)}
              disabled={submittingExpense}
            >
              {currentGroup.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {getMemberName(m.id)}
                </option>
              ))}
            </select>
          </div>

          {/* Split Type Choice */}
          <div className="form-group">
            <span className="split-options-label">How to Split?</span>
            <div className="split-type-toggle">
              <button
                type="button"
                className={`toggle-option ${splitType === 'equal' ? 'active' : ''}`}
                onClick={() => setSplitType('equal')}
                disabled={submittingExpense}
              >
                Split Equally
              </button>
              <button
                type="button"
                className={`toggle-option ${splitType === 'custom' ? 'active' : ''}`}
                onClick={() => setSplitType('custom')}
                disabled={submittingExpense}
              >
                Split Custom Shares
              </button>
            </div>
          </div>

          {/* Custom Splits Fields */}
          {splitType === 'custom' && (
            <div className="custom-splits-fields animate-slide-up">
              <span className="custom-split-desc">Enter amount owed by each member:</span>
              {currentGroup.members.map((m) => (
                <div key={m.id} className="custom-split-row">
                  <span className="custom-split-name">{getMemberName(m.id)}</span>
                  <div className="custom-split-input-wrapper">
                    <span className="currency-prefix">{currency}</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={customSplits[m.id] || ''}
                      onChange={(e) => setCustomSplits({
                        ...customSplits,
                        [m.id]: e.target.value
                      })}
                      disabled={submittingExpense}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setIsExpenseModalOpen(false);
                setEditingExpense(null);
              }}
              disabled={submittingExpense}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submittingExpense || !expenseTitle.trim() || !expenseAmount}
            >
              {submittingExpense ? <span className="spinner"></span> : (editingExpense ? 'Save Changes' : 'Add Bill')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Settle Up Modal */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Settle Shared Debt"
      >
        <form onSubmit={handleSettleSubmit} className="settle-form">
          {settleError && (
            <div className="settle-error animate-fade">
              <span className="error-message">{settleError}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="settle-from-input">Who is Paying?</label>
            <select
              id="settle-from-input"
              value={settleFrom}
              onChange={(e) => setSettleFrom(e.target.value)}
              disabled={submittingSettlement}
            >
              {currentGroup.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {getMemberName(m.id)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="settle-to-input">Who is Receiving?</label>
            <select
              id="settle-to-input"
              value={settleTo}
              onChange={(e) => setSettleTo(e.target.value)}
              disabled={submittingSettlement}
            >
              {currentGroup.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {getMemberName(m.id)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="settle-amount-input">Amount ({currency})</label>
            <input 
              id="settle-amount-input"
              type="number" 
              step="0.01"
              min="0.01"
              placeholder="0.00" 
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              required
              disabled={submittingSettlement}
            />
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setIsSettleModalOpen(false)}
              disabled={submittingSettlement}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submittingSettlement || !settleAmount || settleFrom === settleTo}
            >
              {submittingSettlement ? <span className="spinner"></span> : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddMemberModalOpen}
        onClose={() => {
          setIsAddMemberModalOpen(false);
          setAddMemberInput('');
          setMemberLookupStatus('idle');
          setMemberLookupResult(null);
          setAddMemberError('');
        }}
        title="Add Group Member"
      >
        <form onSubmit={handleAddMemberSubmit} className="add-member-form">
          {addMemberError && (
            <div className="expense-error animate-fade" style={{ marginBottom: '1rem' }}>
              <span className="error-message">{addMemberError}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="add-member-input">Name or @username</label>
            <p className="member-search-hint" style={{ marginTop: '2px', marginBottom: '8px' }}>
              Type a @username to find registered users, or type a name to add manually.
            </p>
            <div className="member-input-wrapper">
              <AtSign size={16} className="member-input-icon" />
              <input 
                id="add-member-input"
                type="text" 
                placeholder="e.g. @john_doe or Jane" 
                value={addMemberInput}
                onChange={(e) => handleMemberInputChange(e.target.value)}
                required
                disabled={submittingAddMember}
                autoComplete="off"
              />
              {memberLookupStatus === 'searching' && (
                <span className="member-lookup-indicator searching">Searching...</span>
              )}
              {memberLookupStatus === 'found' && memberLookupResult && (
                <span className="member-lookup-indicator found">
                  <CheckCircle size={13} /> Found user: {memberLookupResult.name}
                </span>
              )}
              {memberLookupStatus === 'notfound' && addMemberInput.trim().length > 0 && (
                <span className="member-lookup-indicator notfound">Not a registered user — will be added as guest</span>
              )}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setIsAddMemberModalOpen(false);
                setAddMemberInput('');
                setMemberLookupStatus('idle');
                setMemberLookupResult(null);
                setAddMemberError('');
              }}
              disabled={submittingAddMember}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submittingAddMember || !addMemberInput.trim()}
            >
              {submittingAddMember ? <span className="spinner"></span> : 'Add Member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
