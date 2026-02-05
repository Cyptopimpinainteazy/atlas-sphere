'use client';

import { useState } from 'react';
import { useWalletStore } from '@/stores/walletStore';
import { 
  User,
  Shield,
  Bell,
  Globe,
  Moon,
  Key,
  Download,
  Trash2,
  ChevronRight,
  Check,
  ExternalLink,
  LucideIcon
} from 'lucide-react';

interface SettingsItem {
  icon: LucideIcon;
  label: string;
  value: string;
  action?: () => void;
  warning?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: () => void;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

export function SettingsView() {
  const { accounts, disconnect } = useWalletStore();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [currency, setCurrency] = useState('USD');

  const settingsSections: SettingsSection[] = [
    {
      title: 'Account',
      items: [
        { 
          icon: User, 
          label: 'Connected Accounts', 
          value: `${accounts.length} account${accounts.length !== 1 ? 's' : ''}`,
          action: () => {} 
        },
        { 
          icon: Key, 
          label: 'Export Private Key', 
          value: '',
          action: () => {},
          warning: true
        },
        { 
          icon: Download, 
          label: 'Backup Wallet', 
          value: '',
          action: () => {} 
        },
      ]
    },
    {
      title: 'Security',
      items: [
        { 
          icon: Shield, 
          label: 'Security Settings', 
          value: 'Enabled',
          action: () => {} 
        },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { 
          icon: Bell, 
          label: 'Notifications', 
          value: '',
          toggle: true,
          toggleValue: notifications,
          onToggle: () => setNotifications(!notifications)
        },
        { 
          icon: Moon, 
          label: 'Dark Mode', 
          value: '',
          toggle: true,
          toggleValue: darkMode,
          onToggle: () => setDarkMode(!darkMode)
        },
        { 
          icon: Globe, 
          label: 'Currency', 
          value: currency,
          action: () => {} 
        },
      ]
    },
  ];

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-gray-500">Manage your wallet preferences</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {settingsSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="glass-card p-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <button
                    key={itemIndex}
                    onClick={item.toggle ? item.onToggle : item.action}
                    className={`w-full flex items-center justify-between p-4 rounded-xl hover:bg-[#111111] transition-all ${
                      item.warning ? 'hover:bg-red-500/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${item.warning ? 'text-red-400' : 'text-gray-400'}`} />
                      <span className={`font-medium ${item.warning ? 'text-red-400' : 'text-white'}`}>
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.value && (
                        <span className="text-sm text-gray-500">{item.value}</span>
                      )}
                      {item.toggle ? (
                        <div 
                          className={`w-12 h-6 rounded-full transition-colors ${
                            item.toggleValue ? 'bg-orange-500' : 'bg-[#1a1a1a]'
                          }`}
                        >
                          <div 
                            className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                              item.toggleValue ? 'translate-x-6' : 'translate-x-0.5'
                            } mt-0.5`}
                          />
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Network Info */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            Network
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white">X3 STAR Mainnet</span>
              </div>
              <span className="badge badge-success">Connected</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Block Height', value: '1,234,567' },
                { label: 'Gas Price', value: '0.001 STAR' },
                { label: 'TPS', value: '~10,000' },
              ].map((stat, index) => (
                <div key={index} className="p-3 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-center">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="font-medium text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            Resources
          </h3>
          <div className="space-y-1">
            {[
              { label: 'Documentation', href: '/docs' },
              { label: 'Support', href: '/support' },
              { label: 'Terms of Service', href: '/terms' },
              { label: 'Privacy Policy', href: '/privacy' },
            ].map((link, index) => (
              <a
                key={index}
                href={link.href}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-[#111111] transition-all"
              >
                <span className="text-white">{link.label}</span>
                <ExternalLink className="w-4 h-4 text-gray-600" />
              </a>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass-card p-6 border-red-500/20">
          <h3 className="text-sm font-medium text-red-400 uppercase tracking-wider mb-4">
            Danger Zone
          </h3>
          <button
            onClick={disconnect}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
          >
            <Trash2 className="w-5 h-5" />
            <span>Disconnect Wallet</span>
          </button>
        </div>

        {/* Version */}
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">X3 STAR Wallet v0.1.0</p>
        </div>
      </div>
    </div>
  );
}
