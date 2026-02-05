import React from "react"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className || ""}`}
      {...props}
    />
  )
}

export { Skeleton }

// Glassmorphism Skeleton for DEX
export function DexSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Hero Skeleton */}
      <div className="relative overflow-hidden rounded-2xl glass-dark p-8">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="h-16 bg-gradient-to-r from-white/10 to-white/5 rounded-2xl w-3/4"></div>
            <div className="h-6 bg-white/5 rounded-lg w-1/2"></div>
            <div className="flex gap-4">
              <div className="h-10 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full w-32"></div>
              <div className="h-10 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full w-32"></div>
              <div className="h-10 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full w-32"></div>
            </div>
          </div>
          <div className="h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full w-48 opacity-70"></div>
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-dark p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-white/10 rounded w-24"></div>
                <div className="h-8 bg-white/10 rounded w-16"></div>
                <div className="h-4 bg-green-500/20 rounded w-12"></div>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl w-12 h-12"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Interface Skeleton */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Trading Form Skeleton */}
        <div className="glass-dark p-6 rounded-xl">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="h-6 bg-white/10 rounded w-32"></div>
              <div className="w-8 h-8 bg-white/10 rounded-lg"></div>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 bg-gradient-to-r from-gray-600/20 to-gray-700/20 rounded-lg"></div>
              ))}
            </div>

            {/* Token Inputs Skeleton */}
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between p-4 border border-white/10 rounded-xl bg-gradient-to-r from-white/5 to-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg"></div>
                      <div className="space-y-1">
                        <div className="h-4 bg-white/10 rounded w-12"></div>
                        <div className="h-3 bg-gray-400/20 rounded w-16"></div>
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="h-6 bg-white/5 rounded w-16"></div>
                      <div className="h-3 bg-gray-400/20 rounded w-12"></div>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 px-1">
                    <div className="h-3 bg-gray-400/20 rounded w-20"></div>
                    <div className="h-3 bg-green-400/20 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Swap Button Skeleton */}
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full"></div>
            </div>

            {/* Action Button Skeleton */}
            <div className="h-14 bg-gradient-to-r from-green-600/30 via-blue-600/30 to-purple-600/30 rounded-xl"></div>

            {/* Quick Actions Skeleton */}
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-white/10 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart and Orderbook Skeleton */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart Skeleton */}
          <div className="glass-dark p-6 rounded-xl">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-6 bg-white/10 rounded w-24"></div>
                <div className="flex gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-8 bg-white/10 rounded w-12"></div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-400/20 rounded w-16"></div>
                    <div className="h-4 bg-white/10 rounded w-12"></div>
                  </div>
                ))}
              </div>
              <div className="h-64 bg-gradient-to-r from-white/5 to-white/10 rounded-lg"></div>
            </div>
          </div>

          {/* Orderbook and Recent Trades Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="glass-dark p-4 rounded-xl">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <div className="h-5 bg-white/10 rounded w-20"></div>
                    <div className="h-6 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded px-2"></div>
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <div key={j} className="flex justify-between py-1">
                        <div className="h-3 bg-white/10 rounded w-12"></div>
                        <div className="h-3 bg-gray-400/20 rounded w-8"></div>
                        <div className="h-3 bg-gray-400/20 rounded w-10"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
