import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { databaseService } from '../services/backendSelector';
import { calculateBalances } from '../utils/balanceCalculator';
import { Modal } from '../components/Modal';
import { 
  Plus, 
  Trash2, 
  UserPlus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  Users, 
  ChevronRight,
  FolderPlus
} from 'lucide-react';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const { 
    user, 
    groups, 
    groupsLoading, 
    createGroup, 
    setCurrentGroupId,
    currency
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<{ name: string; email?: string }[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Per-group balances map
  const [groupBalances, setGroupBalances] = useState<Record<string, number>>({});
  const [balancesLoading, setBalancesLoading] = useState(false);

  // Load balances for each group to display on cards and dashboard summary
  useEffect(() => {
    const fetchAllGroupBalances = async () => {
      if (groups.length === 0 || !user) {
        setGroupBalances({});
        return;
      }
      setBalancesLoading(true);
      try {
        const balancesMap: Record<string, number> = {};
        
        await Promise.all(
          groups.map(async (group) => {
            const [expenses, settlements] = await Promise.all([
              databaseService.getExpenses(group.id),
              databaseService.getSettlements(group.id),
            ]);
            const calculated = calculateBalances(group, expenses, settlements);
            // Find current user's balance in this group
            // Note: in local-first, the creator has user.uid, other members have generated IDs
            // The creator is mapped to creatorId (which is user.uid)
            const userBalance = calculated.find((b) => b.memberId === user.uid);
            balancesMap[group.id] = userBalance ? userBalance.netBalance : 0;
          })
        );
        
        setGroupBalances(balancesMap);
      } catch (error) {
        console.error('Failed to calculate group balances:', error);
      } finally {
        setBalancesLoading(false);
      }
    };

    fetchAllGroupBalances();
  }, [groups, user]);

  // Overall dashboard calculation
  const totalOwed = Object.values(groupBalances)
    .filter((bal) => bal > 0)
    .reduce((sum, bal) => sum + bal, 0);

  const totalOwe = Object.values(groupBalances)
    .filter((bal) => bal < 0)
    .reduce((sum, bal) => sum + Math.abs(bal), 0);

  const netOverall = totalOwed - totalOwe;

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setMembers([...members, { name: newMemberName.trim(), email: newMemberEmail.trim() || undefined }]);
    setNewMemberName('');
    setNewMemberEmail('');
  };

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setSubmitting(true);
    
    // Auto-add the currently typed member if they forgot to click the "+" button
    const finalMembers = [...members];
    if (newMemberName.trim()) {
      finalMembers.push({
        name: newMemberName.trim(),
        email: newMemberEmail.trim() || undefined
      });
    }

    try {
      await createGroup(groupName.trim(), description.trim(), finalMembers);
      // Reset form
      setGroupName('');
      setDescription('');
      setMembers([]);
      setNewMemberName('');
      setNewMemberEmail('');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container animate-fade">
      {/* Header section */}
      <header className="dashboard-header">
        <div>
          <h1 className="welcome-text">Hey, {user?.displayName}</h1>
          <p className="subtitle-text">Here's your expense summary</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          <span>New Group</span>
        </button>
      </header>

      {/* Summary Balance Cards */}
      <section className="summary-cards-grid">
        <div className="summary-card main-balance glass-panel">
          <div className="card-header">
            <span className="card-label">Total Balance</span>
            <DollarSign size={20} className="icon-muted" />
          </div>
          <div className={`card-value ${netOverall > 0.01 ? 'text-success' : netOverall < -0.01 ? 'text-danger' : ''}`}>
            {netOverall > 0.01 ? '+' : ''}
            {currency}{netOverall.toFixed(2)}
          </div>
          <p className="card-subtext">Across all active groups</p>
        </div>

        <div className="summary-card glass-panel">
          <div className="card-header">
            <span className="card-label">You are owed</span>
            <ArrowUpRight size={20} className="icon-success" />
          </div>
          <div className="card-value text-success">
            {currency}{totalOwed.toFixed(2)}
          </div>
          <p className="card-subtext">Friends owe you money</p>
        </div>

        <div className="summary-card glass-panel">
          <div className="card-header">
            <span className="card-label">You owe</span>
            <ArrowDownLeft size={20} className="icon-danger" />
          </div>
          <div className="card-value text-danger">
            {currency}{totalOwe.toFixed(2)}
          </div>
          <p className="card-subtext">You owe money to friends</p>
        </div>
      </section>

      {/* Group List section */}
      <section className="groups-section">
        <h3 className="section-title">My Groups</h3>
        
        {groupsLoading ? (
          <div className="loading-state">
            <span className="spinner"></span>
            <p>Loading groups...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="empty-state glass-panel">
            <Users size={48} className="empty-icon text-gradient" />
            <h3>No groups yet</h3>
            <p>Create a group with your flatmates or friends to start splitting bills!</p>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <FolderPlus size={18} />
              <span>Create Your First Group</span>
            </button>
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => {
              const balance = groupBalances[group.id] || 0;
              const isOwed = balance > 0.01;
              const owes = balance < -0.01;
              
              return (
                <div 
                  key={group.id} 
                  className="group-card glass-panel"
                  onClick={() => setCurrentGroupId(group.id)}
                >
                  <div className="group-avatar-wrapper">
                    <div className="group-avatar">
                      <Users size={20} />
                    </div>
                  </div>
                  
                  <div className="group-details-box">
                    <h4 className="group-name">{group.name}</h4>
                    <p className="group-members-count">
                      {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  <div className="group-balance-box">
                    {balancesLoading ? (
                      <span className="balance-loading"></span>
                    ) : isOwed ? (
                      <div className="group-balance text-success">
                        <span className="balance-status-label">you are owed</span>
                        <span className="balance-amount">{currency}{balance.toFixed(2)}</span>
                      </div>
                    ) : owes ? (
                      <div className="group-balance text-danger">
                        <span className="balance-status-label">you owe</span>
                        <span className="balance-amount">{currency}{Math.abs(balance).toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="group-balance text-muted">
                        <span className="balance-status-label">settled up</span>
                        <span className="balance-amount">{currency}0.00</span>
                      </div>
                    )}
                    <ChevronRight size={18} className="chevron-icon" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Create Group Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setGroupName('');
          setDescription('');
          setMembers([]);
        }}
        title="Create New Group"
      >
        <form onSubmit={handleCreateGroup} className="create-group-form">
          <div className="form-group">
            <label htmlFor="group-name-input">Group Name</label>
            <input 
              id="group-name-input"
              type="text" 
              placeholder="e.g. Flat 302, Summer Trip 2026" 
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="group-desc-input">Description (Optional)</label>
            <input 
              id="group-desc-input"
              type="text" 
              placeholder="e.g. Shared grocery & rent bills" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Add member form section */}
          <div className="add-member-section">
            <h4 className="sub-section-title">Add Members (Flatmates/Friends)</h4>
            
            <div className="add-member-row">
              <input 
                type="text" 
                placeholder="Name" 
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                disabled={submitting}
              />
              <input 
                type="email" 
                placeholder="Email (Optional)" 
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                disabled={submitting}
              />
              <button 
                type="button" 
                className="btn btn-secondary btn-add-member"
                onClick={handleAddMember}
                disabled={submitting}
                aria-label="Add member"
              >
                <UserPlus size={18} />
              </button>
            </div>

            {/* Members list */}
            {members.length > 0 && (
              <ul className="added-members-list">
                {members.map((member, index) => (
                  <li key={index} className="member-item animate-slide-up">
                    <div className="member-avatar">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="member-info">
                      <span className="member-name">{member.name}</span>
                      {member.email && <span className="member-email">{member.email}</span>}
                    </div>
                    <button 
                      type="button" 
                      className="btn-remove-member"
                      onClick={() => handleRemoveMember(index)}
                      disabled={submitting}
                      aria-label="Remove member"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="modal-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting || !groupName.trim()}
            >
              {submitting ? <span className="spinner"></span> : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
