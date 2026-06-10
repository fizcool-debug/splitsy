import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calculateBalances, simplifyDebts } from '../utils/balanceCalculator';
import { Modal } from '../components/Modal';
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
  Layers
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
    deleteExpense,
    addSettlement,
    currency
  } = useApp();

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances'>('expenses');
  
  // Modals state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  
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
    setExpensePaidBy(user?.uid || currentGroup.members[0]?.id || '');
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
      await addExpense({
        groupId: currentGroup.id,
        title: expenseTitle.trim(),
        amount,
        date: Date.now(),
        paidBy: expensePaidBy,
        category: expenseCategory,
        splits: splitsData
      });
      setIsExpenseModalOpen(false);
    } catch (err) {
      console.error(err);
      setExpenseError('Failed to add expense.');
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

  const handleDeleteExpense = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteExpense(id);
      } catch (err) {
        console.error('Failed to delete expense:', err);
      }
    }
  };

  const getCategoryIcon = (categoryValue: string) => {
    const cat = CATEGORIES.find((c) => c.value === categoryValue);
    const Icon = cat ? cat.icon : FileText;
    return <Icon size={18} />;
  };

  const getMemberName = (id: string) => {
    if (id === user?.uid) return 'You';
    return currentGroup.members.find((m) => m.id === id)?.name || 'Unknown';
  };

  return (
    <div className="group-details-container animate-fade">
      {/* Back navigation & Actions */}
      <nav className="details-nav-header">
        <button className="btn-back" onClick={() => setCurrentGroupId(null)}>
          <ArrowLeft size={20} />
          <span>Back to Groups</span>
        </button>
        <div className="group-action-btns">
          <button className="btn btn-secondary" onClick={() => openSettleModal()}>
            <CheckCircle size={18} />
            <span>Settle Up</span>
          </button>
          <button className="btn btn-primary" onClick={openAddExpenseModal}>
            <Plus size={18} />
            <span>Add Expense</span>
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
                  const userPaid = exp.paidBy === user?.uid;
                  // Find what user owes or is owed
                  const userSplit = exp.splits.find((s) => s.memberId === user?.uid);
                  const userOwedShare = userPaid ? exp.amount - (userSplit ? userSplit.amount : 0) : 0;
                  const userOwesShare = !userPaid && userSplit ? userSplit.amount : 0;

                  return (
                    <div key={exp.id} className="expense-item glass-panel">
                      <div className="expense-left">
                        <div className="category-icon-bg">
                          {getCategoryIcon(exp.category)}
                        </div>
                        <div className="expense-text">
                          <h4 className="expense-title">{exp.title}</h4>
                          <p className="expense-subtext">
                            Paid by <strong>{getMemberName(exp.paidBy)}</strong> &bull; {new Date(exp.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="expense-middle">
                        <span className="total-amount">{currency}{exp.amount.toFixed(2)}</span>
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
                        
                        {/* Option to delete expense (Creator or Payer) */}
                        {(exp.createdById === user?.uid || exp.paidBy === user?.uid) && (
                          <button 
                            className="btn-delete-expense"
                            onClick={() => handleDeleteExpense(exp.id)}
                            title="Delete expense"
                            aria-label="Delete expense"
                          >
                            <Trash2 size={16} />
                          </button>
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
              {simplifiedDebts.length === 0 ? (
                <div className="empty-debts">
                  <CheckCircle size={36} className="text-success" />
                  <p>Everyone is completely settled up!</p>
                </div>
              ) : (
                <div className="debts-list">
                  {simplifiedDebts.map((debt, index) => {
                    const isUserDebtor = debt.fromId === user?.uid;
                    const isUserCreditor = debt.toId === user?.uid;

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
                          <span className="debt-amount-tag">{currency}{debt.amount.toFixed(2)}</span>
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
              <h3 className="section-sub-title">Individual Balances Breakdown</h3>
              <div className="members-balances-list">
                {memberBalances.map((mb) => {
                  const isPositive = mb.netBalance > 0.01;
                  const isNegative = mb.netBalance < -0.01;
                  const isMe = mb.memberId === user?.uid;

                  return (
                    <div key={mb.memberId} className="member-balance-row">
                      <div className="member-row-left">
                        <div className="member-row-avatar">
                          {mb.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="member-row-name">
                          {mb.name} {isMe ? '(You)' : ''}
                        </span>
                      </div>
                      
                      <div className="member-row-right">
                        {isPositive ? (
                          <span className="breakdown-balance text-success">
                            Owed {currency}{mb.netBalance.toFixed(2)}
                          </span>
                        ) : isNegative ? (
                          <span className="breakdown-balance text-danger">
                            Owes {currency}{Math.abs(mb.netBalance).toFixed(2)}
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
                  {settlements.map((set) => (
                    <div key={set.id} className="settlement-log-item">
                      <CheckCircle size={16} className="text-success" />
                      <div className="settlement-log-text">
                        <strong>{getMemberName(set.fromMemberId)}</strong> paid{' '}
                        <strong>{getMemberName(set.toMemberId)}</strong>{' '}
                        <span className="text-success font-semibold">{currency}{set.amount.toFixed(2)}</span>
                        <span className="settlement-date">
                          &bull; {new Date(set.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Add Shared Expense"
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
              onClick={() => setIsExpenseModalOpen(false)}
              disabled={submittingExpense}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submittingExpense || !expenseTitle.trim() || !expenseAmount}
            >
              {submittingExpense ? <span className="spinner"></span> : 'Add Bill'}
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
    </div>
  );
};
