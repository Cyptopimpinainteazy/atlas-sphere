import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/' },
  { name: 'GPU Monitoring', href: '/gpu' },
  { name: 'Tasks', href: '/tasks' },
  { name: 'Network', href: '/network' },
  { name: 'Economics', href: '/economics' },
  { name: 'Governance', href: '/governance' },
  { name: 'Settings', href: '/settings' },
];

export const Header: React.FC<{ title: string }> = ({ title }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-700 sticky top-0 z-40">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">GS</span>
          </div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <button className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition">
            Settings
          </button>
        </div>
      </div>
    </header>
  );
};

export const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-700 h-screen sticky top-0 flex flex-col">
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={clsx(
                'block px-4 py-3 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-900/30 text-blue-400 border-l-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-500 space-y-2">
          <p>📊 Version 1.0.0</p>
          <p>🔗 Network: testnet</p>
          <p>⏱️ {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </aside>
  );
};

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 border-t border-slate-700 px-6 py-4 text-xs text-slate-500 mt-auto">
      <div className="flex items-center justify-between">
        <p>© 2024 Atlas Sphere - GPU Swarm Control Plane</p>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-slate-400 transition">
            Status
          </a>
          <a href="#" className="hover:text-slate-400 transition">
            Docs
          </a>
          <a href="#" className="hover:text-slate-400 transition">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
};
