'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, DollarSign, Target, TrendingDown, TrendingUp, Wallet } from 'lucide-react'

export function Portfolio() {
  const totalValue = 12847.32
  const todayChange = 234.56
  const todayChangePercent = 1.86

  const tokens = [
    {
      symbol: 'SOL',
      name: 'Solana',
      amount: 125.45,
      value: 12341.23,
      change: 5.2,
      price: 98.42,
      allocation: 96.1,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      amount: 425.67,
      value: 425.67,
      change: 0.0,
      price: 1.0,
      allocation: 3.3,
    },
    {
      symbol: 'RAY',
      name: 'Raydium',
      amount: 45.23,
      value: 83.68,
      change: 12.5,
      price: 1.85,
      allocation: 0.6,
    },
  ]

  const openOrders = [
    {
      id: '1',
      pair: 'SOL/USDC',
      type: 'Limit Buy',
      amount: '10.5 SOL',
      price: '$95.00',
      total: '$997.50',
      status: 'Open',
      created: '2 hours ago',
    },
    {
      id: '2',
      pair: 'ETH/USDC',
      type: 'Limit Sell',
      amount: '0.5 ETH',
      price: '$2,900.00',
      total: '$1,450.00',
      status: 'Partial',
      created: '1 day ago',
    },
  ]

  const dcaOrders = [
    {
      id: '1',
      pair: 'SOL/USDC',
      amount: '$100',
      frequency: 'Weekly',
      nextExecution: '2 days',
      totalInvested: '$2,400',
      avgPrice: '$89.23',
      status: 'Active',
    },
    {
      id: '2',
      pair: 'BTC/USDC',
      amount: '$250',
      frequency: 'Bi-weekly',
      nextExecution: '1 week',
      totalInvested: '$3,750',
      avgPrice: '$41,234.56',
      status: 'Active',
    },
  ]

  const recentTrades = [
    {
      id: '1',
      pair: 'SOL/USDC',
      type: 'Buy',
      amount: '5.23 SOL',
      price: '$97.85',
      total: '$511.73',
      time: '2 hours ago',
      fee: '$1.54',
    },
    {
      id: '2',
      pair: 'RAY/SOL',
      type: 'Sell',
      amount: '125.0 RAY',
      price: '0.0187 SOL',
      total: '2.34 SOL',
      time: '1 day ago',
      fee: '0.007 SOL',
    },
    {
      id: '3',
      pair: 'ETH/USDC',
      type: 'Buy',
      amount: '0.25 ETH',
      price: '$2,847.32',
      total: '$711.83',
      time: '2 days ago',
      fee: '$2.14',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
                <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
                <div className={`flex items-center mt-1 ${todayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {todayChange >= 0 ? (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  )}
                  <span className="text-sm">
                    ${Math.abs(todayChange).toFixed(2)} ({todayChange >= 0 ? '+' : ''}
                    {todayChangePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
              <Wallet className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Available Balance</p>
                <p className="text-2xl font-bold">$425.67</p>
                <p className="text-sm text-gray-500">USDC</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Open Orders</p>
                <p className="text-2xl font-bold">{openOrders.length}</p>
                <p className="text-sm text-gray-500">$2,447.50 locked</p>
              </div>
              <Target className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">DCA Orders</p>
                <p className="text-2xl font-bold">{dcaOrders.length}</p>
                <p className="text-sm text-gray-500">Active strategies</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tokens" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="dca">DCA</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens">
          <Card>
            <CardHeader>
              <CardTitle>Token Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tokens.map((token, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                        {token.symbol[0]}
                      </div>
                      <div>
                        <div className="font-semibold">{token.symbol}</div>
                        <div className="text-sm text-gray-500">{token.name}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold">
                        {token.amount.toFixed(2)} {token.symbol}
                      </div>
                      <div className="text-sm text-gray-500">${token.value.toLocaleString()}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold">${token.price.toFixed(2)}</div>
                      <div className={`text-sm ${token.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {token.change >= 0 ? '+' : ''}
                        {token.change.toFixed(2)}%
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${token.allocation}%` }} />
                        </div>
                        <span className="text-sm font-medium">{token.allocation.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Open Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {openOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3">Pair</th>
                        <th className="text-left py-3">Type</th>
                        <th className="text-left py-3">Amount</th>
                        <th className="text-left py-3">Price</th>
                        <th className="text-left py-3">Total</th>
                        <th className="text-left py-3">Status</th>
                        <th className="text-left py-3">Created</th>
                        <th className="text-left py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openOrders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-3 font-semibold">{order.pair}</td>
                          <td className="py-3">
                            <Badge variant={order.type.includes('Buy') ? 'success' : 'destructive'}>{order.type}</Badge>
                          </td>
                          <td className="py-3">{order.amount}</td>
                          <td className="py-3">{order.price}</td>
                          <td className="py-3">{order.total}</td>
                          <td className="py-3">
                            <Badge variant={order.status === 'Open' ? 'outline' : 'warning'}>{order.status}</Badge>
                          </td>
                          <td className="py-3 text-gray-500">{order.created}</td>
                          <td className="py-3">
                            <Button variant="outline" size="sm">
                              Cancel
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No open orders</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dca">
          <Card>
            <CardHeader>
              <CardTitle>Dollar Cost Averaging</CardTitle>
            </CardHeader>
            <CardContent>
              {dcaOrders.length > 0 ? (
                <div className="space-y-4">
                  {dcaOrders.map((order) => (
                    <div key={order.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <BarChart3 className="w-5 h-5 text-purple-500" />
                          <span className="font-semibold">{order.pair}</span>
                          <Badge variant="success">{order.status}</Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {order.amount} {order.frequency}
                          </div>
                          <div className="text-sm text-gray-500">Next: {order.nextExecution}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500">Total Invested</div>
                          <div className="font-semibold">{order.totalInvested}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Average Price</div>
                          <div className="font-semibold">{order.avgPrice}</div>
                        </div>
                      </div>

                      <div className="flex space-x-2 mt-4">
                        <Button variant="outline" size="sm">
                          Pause
                        </Button>
                        <Button variant="outline" size="sm">
                          Modify
                        </Button>
                        <Button variant="outline" size="sm">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No DCA strategies active</p>
                  <Button className="mt-4">Create DCA Strategy</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Trading History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3">Pair</th>
                      <th className="text-left py-3">Type</th>
                      <th className="text-left py-3">Amount</th>
                      <th className="text-left py-3">Price</th>
                      <th className="text-left py-3">Total</th>
                      <th className="text-left py-3">Fee</th>
                      <th className="text-left py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((trade) => (
                      <tr key={trade.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 font-semibold">{trade.pair}</td>
                        <td className="py-3">
                          <Badge variant={trade.type === 'Buy' ? 'success' : 'destructive'}>{trade.type}</Badge>
                        </td>
                        <td className="py-3">{trade.amount}</td>
                        <td className="py-3">{trade.price}</td>
                        <td className="py-3">{trade.total}</td>
                        <td className="py-3 text-gray-500">{trade.fee}</td>
                        <td className="py-3 text-gray-500">{trade.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
