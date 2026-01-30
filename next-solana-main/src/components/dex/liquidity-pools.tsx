'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { 
  Droplets, 
  Plus, 
  Minus, 
  TrendingUp, 
  Info, 
  Zap,
  Target,
  BarChart3
} from 'lucide-react'

export function LiquidityPools() {
  const [selectedPool, setSelectedPool] = useState<string>()
  const [liquidityAmount, setLiquidityAmount] = useState('')
  const [concentratedRange, setConcentratedRange] = useState({ min: '', max: '' })

  const pools = [
    {
      id: 'sol-usdc',
      pair: 'SOL/USDC',
      tvl: '$25.4M',
      volume24h: '$142M',
      fees24h: '$426K',
      apy: '12.4%',
      myLiquidity: '$0',
      tokens: ['SOL', 'USDC'],
      price: 98.42,
      priceRange: { min: 90, max: 110 },
      utilization: 78,
      feeRate: 0.3,
    },
    {
      id: 'eth-usdc',
      pair: 'ETH/USDC',
      tvl: '$18.2M',
      volume24h: '$98M',
      fees24h: '$294K',
      apy: '8.7%',
      myLiquidity: '$1,250',
      tokens: ['ETH', 'USDC'],
      price: 2847.32,
      priceRange: { min: 2700, max: 3000 },
      utilization: 65,
      feeRate: 0.3,
    },
    {
      id: 'btc-usdc',
      pair: 'BTC/USDC',
      tvl: '$22.1M',
      volume24h: '$76M',
      fees24h: '$228K',
      apy: '6.3%',
      myLiquidity: '$0',
      tokens: ['BTC', 'USDC'],
      price: 43250.89,
      priceRange: { min: 40000, max: 47000 },
      utilization: 82,
      feeRate: 0.3,
    },
    {
      id: 'ray-sol',
      pair: 'RAY/SOL',
      tvl: '$8.3M',
      volume24h: '$45M',
      fees24h: '$135K',
      apy: '18.9%',
      myLiquidity: '$0',
      tokens: ['RAY', 'SOL'],
      price: 1.85,
      priceRange: { min: 1.5, max: 2.2 },
      utilization: 91,
      feeRate: 0.3,
    },
  ]

  const myPositions = pools.filter(pool => parseFloat(pool.myLiquidity.replace(/[$,]/g, '')) > 0)

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pools" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pools">All Pools</TabsTrigger>
          <TabsTrigger value="positions">My Positions</TabsTrigger>
          <TabsTrigger value="create">Create Pool</TabsTrigger>
        </TabsList>

        <TabsContent value="pools">
          <div className="space-y-4">
            {/* Pool Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total TVL</p>
                      <p className="text-2xl font-bold">$74.0M</p>
                    </div>
                    <Droplets className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">24h Volume</p>
                      <p className="text-2xl font-bold">$361M</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">24h Fees</p>
                      <p className="text-2xl font-bold">$1.08M</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pool List */}
            <Card>
              <CardHeader>
                <CardTitle>Liquidity Pools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Pool</th>
                        <th className="text-left py-3 px-4">TVL</th>
                        <th className="text-left py-3 px-4">Volume (24h)</th>
                        <th className="text-left py-3 px-4">Fees (24h)</th>
                        <th className="text-left py-3 px-4">APY</th>
                        <th className="text-left py-3 px-4">My Liquidity</th>
                        <th className="text-left py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pools.map((pool) => (
                        <tr key={pool.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <div className="flex -space-x-1">
                                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                  {pool.tokens[0][0]}
                                </div>
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                  {pool.tokens[1][0]}
                                </div>
                              </div>
                              <div>
                                <div className="font-semibold">{pool.pair}</div>
                                <div className="text-xs text-gray-500">
                                  Fee: {pool.feeRate}%
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">{pool.tvl}</td>
                          <td className="py-4 px-4">{pool.volume24h}</td>
                          <td className="py-4 px-4 text-green-600">{pool.fees24h}</td>
                          <td className="py-4 px-4">
                            <Badge variant="success">{pool.apy}</Badge>
                          </td>
                          <td className="py-4 px-4">
                            {pool.myLiquidity === '$0' ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <span className="font-semibold">{pool.myLiquidity}</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <Button 
                              size="sm" 
                              onClick={() => setSelectedPool(pool.id)}
                            >
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

            {/* Add Liquidity Modal */}
            {selectedPool && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Add Liquidity - {pools.find(p => p.id === selectedPool)?.pair}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedPool(undefined)}
                    >
                      ×
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Concentrated Liquidity Settings */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        Concentrated Liquidity
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Min Price</Label>
                        <Input
                          type="number"
                          placeholder="90.0"
                          value={concentratedRange.min}
                          onChange={(e) => setConcentratedRange(prev => ({ ...prev, min: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Max Price</Label>
                        <Input
                          type="number"
                          placeholder="110.0"
                          value={concentratedRange.max}
                          onChange={(e) => setConcentratedRange(prev => ({ ...prev, max: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                      Current price: ${pools.find(p => p.id === selectedPool)?.price}
                    </div>
                  </div>

                  {/* Liquidity Amount */}
                  <div className="space-y-4">
                    <div>
                      <Label>Amount to Add</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={liquidityAmount}
                        onChange={(e) => setLiquidityAmount(e.target.value)}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Balance: 12.45 SOL, 1,234.56 USDC
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>SOL Amount:</span>
                        <span>5.23 SOL</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>USDC Amount:</span>
                        <span>514.78 USDC</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Share of Pool:</span>
                        <span>0.056%</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Est. APY:</span>
                        <span>12.4%</span>
                      </div>
                    </div>

                    <Button className="w-full" size="lg">
                      Add Liquidity
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="positions">
          <div className="space-y-4">
            {myPositions.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>My Liquidity Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {myPositions.map((position) => (
                      <div key={position.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex -space-x-1">
                              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                {position.tokens[0][0]}
                              </div>
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                {position.tokens[1][0]}
                              </div>
                            </div>
                            <span className="font-semibold">{position.pair}</span>
                          </div>
                          <Badge variant="success">{position.apy}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">My Liquidity</div>
                            <div className="font-semibold">{position.myLiquidity}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Pool Share</div>
                            <div className="font-semibold">0.75%</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Fees Earned</div>
                            <div className="font-semibold text-green-600">$23.45</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Impermanent Loss</div>
                            <div className="font-semibold text-red-600">-$2.34</div>
                          </div>
                        </div>
                        
                        <div className="flex space-x-2 mt-4">
                          <Button variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                          <Button variant="outline" size="sm">
                            <Minus className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                          <Button variant="outline" size="sm">
                            Collect Fees
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Droplets className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Liquidity Positions</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    You haven't provided liquidity to any pools yet.
                  </p>
                  <Button onClick={() => setSelectedPool(pools[0].id)}>
                    Add Liquidity
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create New Pool</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    Creating a new pool requires initial liquidity and has associated costs.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Token A</Label>
                  <Input placeholder="Select token..." />
                </div>
                <div>
                  <Label>Token B</Label>
                  <Input placeholder="Select token..." />
                </div>
              </div>

              <div>
                <Label>Fee Rate</Label>
                <select className="w-full p-2 border rounded">
                  <option value="0.01">0.01% - Stable pairs</option>
                  <option value="0.05">0.05% - Low volatility</option>
                  <option value="0.3">0.3% - Standard</option>
                  <option value="1.0">1.0% - High volatility</option>
                </select>
              </div>

              <div>
                <Label>Initial Price</Label>
                <Input type="number" placeholder="0.00" />
                <div className="text-xs text-gray-500 mt-1">
                  Set the initial price for this pool
                </div>
              </div>

              <Button className="w-full" size="lg" disabled>
                Create Pool (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}