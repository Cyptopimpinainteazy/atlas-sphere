'use client'

import React, { useState } from 'react'
import { LeftSocialSidebar, SocialProvider } from './social/left-social-sidebar'
import { RightBotSidebar, TradingBotProvider } from './social/right-bot-sidebar'
import { PriceTicker } from './ui/price-ticker'

const ScrollArea = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={`overflow-y-auto ${className || ''}`}>
    {children}
  </div>
)

export function SocialTradingLayout({ children }: { children: React.ReactNode }) {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)  // Start with left sidebar closed
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)  // Start with right sidebar closed

  return (
    <TradingBotProvider>
      <SocialProvider>
        <div className="full-screen-app flex h-screen w-full overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900/80 to-indigo-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" style={{
          overscrollBehavior: 'none',
          height: '100vh',
          width: '100vw'
        }}>

        {/* Left Social Sidebar - Hidden on mobile by default, toggleable */}
        <LeftSocialSidebar
          isOpen={leftSidebarOpen}
          toggleSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
        />

        {/* Main Content Area - Takes full width minus sidebars when they are open */}
        <div className={`
          flex-1 flex flex-col relative overflow-y-auto transition-all duration-300
          ${leftSidebarOpen ? 'ml-80' : 'ml-0'}
          ${rightSidebarOpen ? 'mr-80' : 'mr-0'}
        `}>
          {/* Header with sidebar toggles */}
          <header className="w-full bg-black/20 backdrop-blur-md border-b border-white/10 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Left sidebar toggle button - Always visible */}
              <button
                onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 hover:border-blue-400/50 transition-all duration-200"
                title="Toggle Social Sidebar"
                aria-label="Toggle Social Sidebar"
                aria-expanded={leftSidebarOpen}
              >
                <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg">Solana Social DEX</h1>
                  <p className="text-gray-400 text-sm">Trade • Connect • Earn</p>
                </div>
              </div>
            </div>

            {/* Live indicators and status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-300">Live</span>
              </div>

              {/* Right sidebar toggle button */}
              <button
                onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 hover:border-purple-400/50 transition-all duration-200"
                title="Toggle Trading Bots"
                aria-label="Toggle Trading Bots Sidebar"
                aria-expanded={rightSidebarOpen}
              >
                <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </button>
            </div>
          </header>

          {/* Price Ticker - Scrolling below header */}
          <PriceTicker />

          {/* Main content */}
          <main className="flex-1 p-4 overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Right Bot Sidebar */}
        <RightBotSidebar
          isOpen={rightSidebarOpen}
          toggleSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
        />
      </div>
    </SocialProvider>
    </TradingBotProvider>
  )
}
