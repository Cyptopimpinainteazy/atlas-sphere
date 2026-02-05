'use client'

import { Moon, Palette, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function EnhancedThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = (localStorage.getItem('theme') as 'light' | 'dark' | 'auto') || 'dark'
    setTheme(saved)
    applyTheme(saved)
  }, [])

  const applyTheme = (newTheme: 'light' | 'dark' | 'auto') => {
    const root = document.documentElement

    if (newTheme === 'auto') {
      const systemPref = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.toggle('dark', systemPref === 'dark')
    } else {
      root.classList.toggle('dark', newTheme === 'dark')
    }
  }

  const cycleTheme = () => {
    const themes: ('light' | 'dark' | 'auto')[] = ['light', 'dark', 'auto']
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]

    setTheme(nextTheme)
    applyTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return <Sun className="h-5 w-5 text-orange-400 transition-all duration-300" />
      case 'dark': return <Moon className="h-5 w-5 text-blue-400 transition-all duration-300" />
      case 'auto': return <Palette className="h-5 w-5 text-purple-400 transition-all duration-300" />
    }
  }

  const getThemeLabel = () => {
    switch (theme) {
      case 'light': return 'Light Theme'
      case 'dark': return 'Dark Theme'
      case 'auto': return 'System Theme (Auto)'
    }
  }

  if (!mounted) {
    // Prevent hydration mismatch
    return (
      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-gray-500/20 to-gray-600/20 animate-pulse" />
    )
  }

  return (
    <div className="relative">
      <button
        onClick={cycleTheme}
        className="group relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/20 transition-all duration-200 hover:scale-105 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/25"
        title={`${getThemeLabel()} - Click to cycle themes`}
        aria-label={`Current theme: ${theme}. Click to change theme.`}
      >
        {getThemeIcon()}

        {/* Ripple effect */}
        <div className="absolute inset-0 rounded-lg opacity-0 group-active:opacity-20 group-active:scale-110 bg-white transition-all duration-150" />
      </button>

      {/* Enhanced tooltip */}
      <div className="absolute bottom-full mb-3 hidden group-hover:block z-50">
        <div className="rounded-lg bg-gray-800/95 backdrop-blur-sm px-3 py-2 text-sm text-white shadow-xl border border-white/10 max-w-xs">
          <div className="font-semibold text-base mb-1">{getThemeLabel()}</div>
          <div className="text-xs text-gray-300 leading-relaxed">
            {theme === 'light' && 'Clean white theme with light backgrounds and dark text.'}
            {theme === 'dark' && 'Modern dark theme optimized for night-time trading.'}
            {theme === 'auto' && 'Automatically matches your system light/dark preference.'}
          </div>
          <div className="text-xs text-blue-400 mt-2 font-medium">
            Click to cycle themes →
          </div>
        </div>

        {/* Arrow pointer */}
        <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800/95"></div>
      </div>
    </div>
  )
}

// Compact version for mobile
export function CompactThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
    setTheme(saved)
    document.documentElement.classList.toggle('dark', saved === 'dark')
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
    localStorage.setItem('theme', newTheme)
  }

  if (!mounted) return null

  return (
    <button
      onClick={toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gray-600/20 to-gray-700/20 hover:from-blue-500/20 hover:to-purple-500/20 transition-all duration-200 touch-target"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 text-blue-400" />
      )}
    </button>
  )
}
