import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { databaseService } from '../services/backendSelector';
import type { Expense } from '../services/db/types';
import { 
  TrendingUp, 
  DollarSign, 
  Layers,
  Utensils, 
  Home, 
  Zap, 
  Beer, 
  FileText,
  PieChart
} from 'lucide-react';
import './Analytics.css';

const CATEGORY_META: Record<string, { label: string; color: string; icon: any }> = {
  food: { label: 'Food & Dining', color: '#00f2fe', icon: Utensils },
  rent: { label: 'Rent', color: '#8f43ff', icon: Home },
  utilities: { label: 'Utilities & Bills', color: '#10b981', icon: Zap },
  entertainment: { label: 'Entertainment/Drinks', color: '#f59e0b', icon: Beer },
  other: { label: 'Other', color: '#a0a5b5', icon: FileText }
};

export const Analytics: React.FC = () => {
  const { groups, currency } = useApp();
  
  const [loading, setLoading] = useState(true);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [groupSpending, setGroupSpending] = useState<{ name: string; amount: number }[]>([]);

  useEffect(() => {
    const fetchAllData = async () => {
      if (groups.length === 0) {
        setAllExpenses([]);
        setGroupSpending([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const expensesAccumulator: Expense[] = [];
        const groupSpendingList: { name: string; amount: number }[] = [];

        await Promise.all(
          groups.map(async (group) => {
            const expList = await databaseService.getExpenses(group.id);
            expensesAccumulator.push(...expList);

            const totalGroupSpent = expList.reduce((sum, e) => sum + e.amount, 0);
            groupSpendingList.push({
              name: group.name,
              amount: totalGroupSpent
            });
          })
        );

        // Sort expenses by date desc
        setAllExpenses(expensesAccumulator.sort((a, b) => b.date - a.date));
        setGroupSpending(groupSpendingList.sort((a, b) => b.amount - a.amount));
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [groups]);

  // Calculations
  const totalSpent = allExpenses.reduce((sum, e) => sum + e.amount, 0);
  const avgExpense = allExpenses.length > 0 ? totalSpent / allExpenses.length : 0;
  
  // Calculate category breakdowns
  const categoryTotals: Record<string, number> = {
    food: 0,
    rent: 0,
    utilities: 0,
    entertainment: 0,
    other: 0
  };

  allExpenses.forEach((exp) => {
    const cat = categoryTotals[exp.category] !== undefined ? exp.category : 'other';
    categoryTotals[cat] += exp.amount;
  });

  const categoryBreakdown = Object.keys(categoryTotals).map((key) => {
    const total = categoryTotals[key];
    const percentage = totalSpent > 0 ? (total / totalSpent) * 100 : 0;
    return {
      category: key,
      total,
      percentage,
      ...CATEGORY_META[key]
    };
  }).sort((a, b) => b.total - a.total);

  if (loading) {
    return (
      <div className="analytics-loading animate-fade">
        <span className="spinner"></span>
        <p>Loading spending analytics...</p>
      </div>
    );
  }

  return (
    <div className="analytics-container animate-fade">
      <header className="analytics-header">
        <h1 className="welcome-text">Spending Analytics</h1>
        <p className="subtitle-text">Visualize spending distribution across groups and categories</p>
      </header>

      {allExpenses.length === 0 ? (
        <div className="empty-analytics glass-panel animate-slide-up">
          <PieChart size={48} className="empty-icon text-gradient" />
          <h3>No spending data yet</h3>
          <p>Once you add shared bills in your groups, expense distribution graphs will appear here.</p>
        </div>
      ) : (
        <>
          {/* Key Stats Cards */}
          <section className="analytics-stats-grid">
            <div className="stat-card glass-panel">
              <div className="stat-header">
                <span className="stat-label">Total Shared Vol.</span>
                <TrendingUp size={18} className="icon-success" />
              </div>
              <div className="stat-value text-gradient">{currency}{totalSpent.toFixed(2)}</div>
              <p className="stat-subtext">Sum of all bills logged</p>
            </div>

            <div className="stat-card glass-panel">
              <div className="stat-header">
                <span className="stat-label">Average Bill</span>
                <DollarSign size={18} className="icon-muted" />
              </div>
              <div className="stat-value">{currency}{avgExpense.toFixed(2)}</div>
              <p className="stat-subtext">Per transaction average</p>
            </div>

            <div className="stat-card glass-panel">
              <div className="stat-header">
                <span className="stat-label">Bill Count</span>
                <Layers size={18} className="icon-muted" />
              </div>
              <div className="stat-value">{allExpenses.length}</div>
              <p className="stat-subtext">Total transactions registered</p>
            </div>
          </section>

          {/* Main Visualizations Layout */}
          <div className="analytics-layout-grid">
            {/* Category Breakdown (CSS Progress Bars) */}
            <div className="analytics-card glass-panel">
              <h3 className="card-title">Category Distribution</h3>
              <div className="category-list">
                {categoryBreakdown.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.category} className="cat-breakdown-row">
                      <div className="cat-info">
                        <div className="cat-label-with-icon" style={{ color: item.color }}>
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </div>
                        <div className="cat-values">
                          <strong>{currency}{item.total.toFixed(2)}</strong>
                          <span className="cat-percentage">({item.percentage.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="progress-bar-track">
                        <div 
                          className="progress-bar-fill"
                          style={{ 
                            width: `${item.percentage}%`,
                            background: item.color
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Group Comparisons */}
            <div className="analytics-card glass-panel">
              <h3 className="card-title">Group-wise Spending</h3>
              <div className="groups-spending-list">
                {groupSpending.map((group, idx) => {
                  const maxAmount = Math.max(...groupSpending.map(g => g.amount));
                  const percentage = maxAmount > 0 ? (group.amount / maxAmount) * 100 : 0;
                  
                  return (
                    <div key={idx} className="group-spending-row">
                      <div className="group-spending-info">
                        <span className="group-spending-name">{group.name}</span>
                        <strong className="group-spending-amount">{currency}{group.amount.toFixed(2)}</strong>
                      </div>
                      <div className="progress-bar-track">
                        <div 
                          className="progress-bar-fill"
                          style={{ 
                            width: `${percentage}%`,
                            background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)'
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
