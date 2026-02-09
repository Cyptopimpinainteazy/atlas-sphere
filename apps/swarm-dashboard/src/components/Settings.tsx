import React, { useState } from 'react';
import { Tabs } from '@/components/Common';

// interface SettingSection {
//   id: string;
//   title: string;
//   description: string;
//   control: React.ReactNode;
// }

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    apiEndpoint: 'http://localhost:5000/api',
    wsEndpoint: 'ws://localhost:5000/ws',
    refreshInterval: 5,
    theme: 'dark',
    notifications: true,
    soundAlerts: false,
    advancedMode: false,
  });

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-4xl">
      <Tabs
        tabs={[
          { label: 'General', value: 'general' },
          { label: 'Network', value: 'network' },
          { label: 'Notifications', value: 'notifications' },
          { label: 'Advanced', value: 'advanced' },
        ]}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      >
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">Display & UI</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Theme</label>
                  <select
                    value={settings.theme}
                    onChange={(e) => handleSettingChange('theme', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-400 block mb-2">Refresh Interval (seconds)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.refreshInterval}
                    onChange={(e) => handleSettingChange('refreshInterval', parseInt(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white"
                  />
                  <p className="text-xs text-slate-500 mt-1">How often to refresh metrics</p>
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.advancedMode}
                      onChange={(e) => handleSettingChange('advancedMode', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-300">Enable Advanced Mode</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-1">Show advanced metrics and debugging controls</p>
                </div>
              </div>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition">
              Save Changes
            </button>
          </div>
        )}

        {/* Network Settings */}
        {activeTab === 'network' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">API Endpoint</label>
                  <input
                    type="text"
                    value={settings.apiEndpoint}
                    onChange={(e) => handleSettingChange('apiEndpoint', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Base URL for API requests</p>
                </div>

                <div>
                  <label className="text-sm text-slate-400 block mb-2">WebSocket Endpoint</label>
                  <input
                    type="text"
                    value={settings.wsEndpoint}
                    onChange={(e) => handleSettingChange('wsEndpoint', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">WebSocket URL for real-time updates</p>
                </div>

                <div className="mt-6 p-4 bg-green-900/20 border border-green-700 rounded">
                  <p className="text-sm text-green-400">✓ Connection status: Connected</p>
                  <p className="text-xs text-slate-400 mt-1">Last sync: 2 seconds ago</p>
                </div>
              </div>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition">
              Test Connection
            </button>
          </div>
        )}

        {/* Notification Settings */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                    className="rounded"
                  />
                  <div>
                    <span className="text-sm text-slate-300">Enable Desktop Notifications</span>
                    <p className="text-xs text-slate-500">Get alerts for system events</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.soundAlerts}
                    onChange={(e) => handleSettingChange('soundAlerts', e.target.checked)}
                    className="rounded"
                  />
                  <div>
                    <span className="text-sm text-slate-300">Sound Alerts</span>
                    <p className="text-xs text-slate-500">Play sound for critical alerts</p>
                  </div>
                </label>

                <div className="mt-6 p-4 bg-slate-700/50 rounded">
                  <h4 className="text-sm font-semibold text-white mb-3">Notification Types</h4>
                  <div className="space-y-2 text-sm">
                    {['GPU Offline', 'High Temperature', 'Task Failed', 'Slashing Event', 'Reward Available'].map(
                      (type) => (
                        <label key={type} className="flex items-center gap-2">
                          <input type="checkbox" defaultChecked className="rounded" />
                          <span className="text-slate-300">{type}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition">
              Save Preferences
            </button>
          </div>
        )}

        {/* Advanced Settings */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">System Information</h3>
              <div className="space-y-3 text-sm font-mono">
                <div className="flex justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-slate-400">Version</span>
                  <span className="text-white">1.0.0</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-slate-400">Build</span>
                  <span className="text-white">prod-2024-01-20</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-slate-400">API Version</span>
                  <span className="text-white">v1.0</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-slate-400">Uptime</span>
                  <span className="text-white">24h 15m</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">Dangerous Actions</h3>
              <div className="space-y-2">
                <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded transition">
                  Clear Cache
                </button>
                <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 rounded transition">
                  Export Logs
                </button>
                <button className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded transition">
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
};
