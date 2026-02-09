import React, { useState } from 'react';
import { StatCard, Tabs } from '@/components/Common';

interface GovernanceActionItem {
  id: string;
  type: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  votesFor: number;
  votesAgainst: number;
  endsAt: string;
}

const mockActions: GovernanceActionItem[] = [
  {
    id: 'gov-1',
    type: 'parameter_change',
    title: 'Increase GPU Task Reward',
    description: 'Increase base reward for GPU tasks from 0.1 to 0.15 SWM',
    status: 'active',
    votesFor: 1200,
    votesAgainst: 150,
    endsAt: '2024-02-01',
  },
  {
    id: 'gov-2',
    type: 'protocol_upgrade',
    title: 'Enable x3-lang Runtime',
    description: 'Activate support for x3-lang smart contracts in the runtime',
    status: 'active',
    votesFor: 2500,
    votesAgainst: 300,
    endsAt: '2024-02-05',
  },
  {
    id: 'gov-3',
    type: 'fund_allocation',
    title: 'Community Development Fund',
    description: 'Allocate 10,000 SWM to community development initiatives',
    status: 'passed',
    votesFor: 3000,
    votesAgainst: 200,
    endsAt: '2024-01-28',
  },
];

export const Governance: React.FC = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const filteredActions = mockActions.filter((action) => {
    if (activeTab === 'active') return action.status === 'active' || action.status === 'pending';
    if (activeTab === 'passed') return action.status === 'passed';
    if (activeTab === 'rejected') return action.status === 'rejected';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-blue-400 bg-blue-900/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'passed':
        return 'text-green-400 bg-green-900/20';
      case 'rejected':
        return 'text-red-400 bg-red-900/20';
      default:
        return 'text-slate-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'parameter_change':
        return '⚙️';
      case 'protocol_upgrade':
        return '🚀';
      case 'fund_allocation':
        return '💰';
      default:
        return '📋';
    }
  };

  return (
    <div className="space-y-6">
      {/* Governance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Active Proposals" value={2} variant="blue" />
        <StatCard title="Passed Proposals" value={24} variant="green" />
        <StatCard title="Total Voters" value={5234} variant="purple" />
        <StatCard title="Participation" value="68" unit="%" variant="orange" />
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { label: 'Active & Pending', value: 'active' },
          { label: 'Passed', value: 'passed' },
          { label: 'Rejected', value: 'rejected' },
          { label: 'All', value: 'all' },
        ]}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      >
        <div className="space-y-4">
          {filteredActions.map((action) => {
            const totalVotes = action.votesFor + action.votesAgainst;
            const percentFor = (action.votesFor / totalVotes) * 100;
            const isExpanded = selectedAction === action.id;

            return (
              <div
                key={action.id}
                onClick={() => setSelectedAction(isExpanded ? null : action.id)}
                className="bg-slate-800 border border-slate-700 rounded-lg p-6 cursor-pointer hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getTypeIcon(action.type)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{action.title}</h3>
                        <p className="text-sm text-slate-400">{action.description}</p>
                      </div>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded text-sm font-semibold uppercase ${getStatusColor(action.status)}`}>
                    {action.status}
                  </span>
                </div>

                {/* Voting Stats */}
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Voting Progress</p>
                      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-red-500"
                          style={{ width: `${percentFor}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {percentFor.toFixed(1)}% For
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-2">For</p>
                      <p className="text-lg font-bold text-green-400">{action.votesFor.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Against</p>
                      <p className="text-lg font-bold text-red-400">{action.votesAgainst.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
                    <div>
                      <p className="text-sm text-slate-400">Voting Ends</p>
                      <p className="text-sm text-white">{action.endsAt}</p>
                    </div>

                    {action.status === 'active' && (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-400 mb-2">Cast Your Vote</p>
                        <div className="flex gap-2">
                          <button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded transition">
                            Vote For
                          </button>
                          <button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded transition">
                            Vote Against
                          </button>
                          <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded transition">
                            Abstain
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
};
