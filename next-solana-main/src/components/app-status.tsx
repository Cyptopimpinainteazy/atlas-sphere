'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppConfig } from '@/hooks/use-app-config'
import { AlertCircle, CheckCircle, RefreshCw, WifiOff, Zap } from 'lucide-react'
import { useState } from 'react'

export function AppStatus() {
  const { status, isMockMode, retryConnection } = useAppConfig()
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    await retryConnection()
    setTimeout(() => setIsRetrying(false), 1000)
  }

  if (!status.isOnline) {
    return (
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <WifiOff className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
              You're offline. Some features may not work.
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status.errors.length > 0) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                Service connection issues detected
              </span>
              <div className="text-xs text-red-600 dark:text-red-300 mt-1">{status.errors.join(', ')}</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-600 dark:text-red-300"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isMockMode) {
    return (
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Development Mode - Using mock data
            </span>
          </div>
          <div className="flex space-x-2">
            <Badge variant="outline" className="text-blue-700 border-blue-300">
              Mock Data
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show connected services status
  const connectedServices = Object.entries(status.services).filter(([_, status]) => status === 'connected')

  if (connectedServices.length > 0) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              Connected to production services
            </span>
          </div>
          <div className="flex space-x-2">
            {Object.entries(status.services).map(([service, serviceStatus]) => (
              <Badge
                key={service}
                variant={
                  serviceStatus === 'connected' ? 'success' : serviceStatus === 'error' ? 'destructive' : 'outline'
                }
                className="text-xs capitalize"
              >
                {service}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

// Minimal status indicator for header
export function AppStatusIndicator() {
  const { status, isMockMode } = useAppConfig()

  if (!status.isOnline) {
    return (
      <Badge variant="warning" className="flex items-center gap-1">
        <WifiOff className="h-3 w-3" />
        Offline
      </Badge>
    )
  }

  if (status.errors.length > 0) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Error
      </Badge>
    )
  }

  if (isMockMode) {
    return (
      <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-300">
        <Zap className="h-3 w-3" />
        Dev
      </Badge>
    )
  }

  const connectedServices = Object.values(status.services).filter((s) => s === 'connected').length

  if (connectedServices > 0) {
    return (
      <Badge variant="success" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Live
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <Zap className="h-3 w-3" />
      Mock
    </Badge>
  )
}
