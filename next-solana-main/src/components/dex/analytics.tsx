'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, BarChart3, DollarSign, PieChart, Target, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react'

export function Analytics() {
  const protocolStats = {
    totalVolume: '$2.4B',
    totalVolumeChange: '+12.3%',
    tvl: '$890M',
    tvlChange: '+5.7%',
    totalFees: '$7.2M',
    feesChange: '+18.9%',
    activeUsers: '42,567',
    usersChange: '+23.4%',
    totalTrades: '1.2M',
    tradesChange: '+15.6%',
    avgTradeSize: '$2,847',
    tradeSizeChange: '-3.2%',
  }

  const topTokens = [
    { symbol: 'SOL', volume: '$482M', change: '+8.5%', price: '$98.42', mcap: '$45.2B' },
    { symbol: 'ETH', volume: '$324M', change: '+5.2%', price: '$2,847', mcap: '$342.1B' },
    { symbol: 'BTC', volume: '$298M', change: '+3.8%', price: '$43,251', mcap: '$856.7B' },
    { symbol: 'USDC', volume: '$756M', change: '+0.1%', price: '$1.00', mcap: '$38.4B' },
    { symbol: 'RAY', volume: '$89M', change: '+24.7%', price: '$1.85', mcap: '$485M' },
  ]

  const topPools = [
    { pair: 'SOL/USDC', tvl: '$25.4M', volume: '$142M', fees: '$426K', apy: '12.4%', utilization: '78%' },
    { pair: 'ETH/USDC', tvl: '$18.2M', volume: '$98M', fees: '$294K', apy: '8.7%', utilization: '65%' },
    { pair: 'BTC/USDC', tvl: '$22.1M', volume: '$76M', fees: '$228K', apy: '6.3%', utilization: '82%' },
    { pair: 'RAY/SOL', tvl: '$8.3M', volume: '$45M', fees: '$135K', apy: '18.9%', utilization: '91%' },
  ]

  const protocolMetrics = [
    { name: 'Total Value Locked', value: '$890M', change: '+5.7%', positive: true },
    { name: '24h Volume', value: '$142M', change: '+12.3%', positive: true },
    { name: 'Total Fees Collected', value: '$7.2M', change: '+18.9%', positive: true },
    { name: 'Active Liquidity Providers', value: '12,847', change: '+8.4%', positive: true },
    { name: 'Average Trade Size', value: '$2,847', change: '-3.2%', positive: false },
    { name: 'Protocol Revenue', value: '$2.4M', change: '+22.1%', positive: true },
  ]

  return (
    <div className="space-y-6">
      {/* Protocol Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume (24h)</p>
                <p className="text-2xl font-bold">{protocolStats.totalVolume}</p>
                <div className="flex items-center mt-1 text-green-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span className="text-sm">{protocolStats.totalVolumeChange}</span>
                </div>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Value Locked</p>
                <p className="text-2xl font-bold">{protocolStats.tvl}</p>
                <div className="flex items-center mt-1 text-green-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span className="text-sm">{protocolStats.tvlChange}</span>
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Protocol Fees (24h)</p>
                <p className="text-2xl font-bold">{protocolStats.totalFees}</p>
                <div className="flex items-center mt-1 text-green-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span className="text-sm">{protocolStats.feesChange}</span>
                </div>
              </div>
              <Zap className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Users (24h)</p>
                <p className="text-2xl font-bold">{protocolStats.activeUsers}</p>
                <div className="flex items-center mt-1 text-green-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span className="text-sm">{protocolStats.usersChange}</span>
                </div>
              </div>
              <Users className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Trades (24h)</p>
                <p className="text-2xl font-bold">{protocolStats.totalTrades}</p>
                <div className="flex items-center mt-1 text-green-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span className="text-sm">{protocolStats.tradesChange}</span>
                </div>
              </div>
              <Activity className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Trade Size</p>
                <p className="text-2xl font-bold">{protocolStats.avgTradeSize}</p>
                <div className="flex items-center mt-1 text-red-600">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  <span className="text-sm">{protocolStats.tradeSizeChange}</span>
                </div>
              </div>
              <Target className="w-8 h-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tokens" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tokens">Top Tokens</TabsTrigger>
          <TabsTrigger value="pools">Top Pools</TabsTrigger>
          <TabsTrigger value="metrics">Protocol Metrics</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens">
          <Card>
            <CardHeader>
              <CardTitle>Top Tokens by Volume (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3">Token</th>
                      <th className="text-left py-3">Price</th>
                      <th className="text-left py-3">24h Change</th>
                      <th className="text-left py-3">Volume (24h)</th>
                      <th className="text-left py-3">Market Cap</th>
                      <th className="text-left py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTokens.map((token, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {token.symbol[0]}
                            </div>
                            <span className="font-semibold">{token.symbol}</span>
                          </div>
                        </td>
                        <td className="py-4 font-mono">{token.price}</td>
                        <td className="py-4">
                          <Badge variant={token.change.startsWith('+') ? 'success' : 'destructive'}>
                            {token.change}
                          </Badge>
                        </td>
                        <td className="py-4 font-semibold">{token.volume}</td>
                        <td className="py-4">{token.mcap}</td>
                        <td className="py-4">
                          <Button size="sm" variant="outline">
                            Trade
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pools">
          <Card>
            <CardHeader>
              <CardTitle>Top Liquidity Pools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3">Pool</th>
                      <th className="text-left py-3">TVL</th>
                      <th className="text-left py-3">Volume (24h)</th>
                      <th className="text-left py-3">Fees (24h)</th>
                      <th className="text-left py-3">APY</th>
                      <th className="text-left py-3">Utilization</th>
                      <th className="text-left py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPools.map((pool, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-4">
                          <div className="flex items-center space-x-2">
                            <div className="flex -space-x-1">
                              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                {pool.pair.split('/')[0][0]}
                              </div>
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                {pool.pair.split('/')[1][0]}
                              </div>
                            </div>
                            <span className="font-semibold">{pool.pair}</span>
                          </div>
                        </td>
                        <td className="py-4 font-semibold">{pool.tvl}</td>
                        <td className="py-4">{pool.volume}</td>
                        <td className="py-4 text-green-600">{pool.fees}</td>
                        <td className="py-4">
                          <Badge variant="success">{pool.apy}</Badge>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: pool.utilization }} />
                            </div>
                            <span className="text-sm">{pool.utilization}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <Button size="sm" variant="outline">
                            Add Liquidity
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {protocolMetrics.map((metric, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{metric.name}</p>
                      <p className="text-2xl font-bold">{metric.value}</p>
                      <div className={`flex items-center mt-1 ${metric.positive ? 'text-green-600' : 'text-red-600'}`}>
                        {metric.positive ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        )}
                        <span className="text-sm">{metric.change}</span>
                      </div>
                    </div>
                    <PieChart className="w-8 h-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="charts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Volume Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-gray-500">Volume chart would go here</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>TVL Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-gray-500">TVL chart would go here</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fee Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-gray-500">Fee revenue chart would go here</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                  <div className="text-gray-500">User activity chart would go here</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
