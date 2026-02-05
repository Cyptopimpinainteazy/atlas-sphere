'use client'

import { config, isMockMode, logger } from '@/lib/config'
import { useEffect, useState } from 'react'

export interface AppStatus {
  isLoading: boolean
  isOnline: boolean
  services: {
    supabase: 'connected' | 'mock' | 'error'
    jupiter: 'connected' | 'mock' | 'error'
    solana: 'connected' | 'mock' | 'error'
  }
  errors: string[]
}

export function useAppConfig() {
  const [status, setStatus] = useState<AppStatus>({
    isLoading: true,
    isOnline: true, // Will be updated in useEffect
    services: {
      supabase: 'mock',
      jupiter: 'mock',
      solana: 'mock',
    },
    errors: [],
  })

  useEffect(() => {
    checkServicesStatus()

    // Set up online/offline listeners
    const handleOnline = () => setStatus((prev) => ({ ...prev, isOnline: true }))
    const handleOffline = () => setStatus((prev) => ({ ...prev, isOnline: false }))

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const checkServicesStatus = async () => {
    setStatus((prev) => ({ ...prev, isLoading: true, errors: [] }))

    const newStatus: AppStatus = {
      isLoading: false,
      isOnline: navigator?.onLine ?? true,
      services: {
        supabase: 'mock',
        jupiter: 'mock',
        solana: 'mock',
      },
      errors: [],
    }

    try {
      // Check Supabase
      if (!isMockMode()) {
        try {
          const { getSupabaseClient } = await import('@/lib/supabase')
          const client = await getSupabaseClient()

          if (client && !config.supabase.url.includes('your-project')) {
            // Try a simple query to verify connection
            await client.from('trading_pairs').select('count').limit(1)
            newStatus.services.supabase = 'connected'
            logger.info('Supabase service: Connected')
          } else {
            newStatus.services.supabase = 'mock'
            logger.info('Supabase service: Using mock data')
          }
        } catch (error) {
          newStatus.services.supabase = 'error'
          newStatus.errors.push('Supabase connection failed')
          logger.error('Supabase service error:', error)
        }

        // Check Jupiter
        try {
          const response = await fetch(
            `${config.jupiter.apiUrl}/quote?inputMint=${encodeURIComponent('So11111111111111111111111111111111111111112')}&outputMint=${encodeURIComponent('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')}&amount=1000000000`,
            {
              method: 'GET',
              signal: AbortSignal.timeout(5000), // 5 second timeout
            },
          )

          if (response.ok) {
            newStatus.services.jupiter = 'connected'
            logger.info('Jupiter service: Connected')
          } else {
            throw new Error(`HTTP ${response.status}`)
          }
        } catch (error) {
          newStatus.services.jupiter = 'mock'
          logger.warn('Jupiter service: Using mock data -', error)
        }

        // Check Solana RPC
        try {
          const response = await fetch(config.solana.rpcEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'getHealth',
            }),
            signal: AbortSignal.timeout(5000),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.result === 'ok') {
              newStatus.services.solana = 'connected'
              logger.info('Solana RPC service: Connected')
            } else {
              throw new Error('RPC health check failed')
            }
          } else {
            throw new Error(`HTTP ${response.status}`)
          }
        } catch (error) {
          newStatus.services.solana = 'error'
          newStatus.errors.push('Solana RPC connection failed')
          logger.error('Solana RPC service error:', error)
        }
      } else {
        logger.info('All services: Using mock data (development mode)')
      }
    } catch (error) {
      logger.error('Error checking services status:', error)
      newStatus.errors.push('Failed to check services status')
    }

    setStatus(newStatus)
  }

  const retryConnection = () => {
    logger.info('Retrying service connections...')
    checkServicesStatus()
  }

  return {
    config,
    status,
    isMockMode: isMockMode(),
    isConnected: status.services.supabase === 'connected' || status.services.jupiter === 'connected',
    retryConnection,
    checkServicesStatus,
  }
}
