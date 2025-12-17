/**
 * Cross-Chain Swap Component
 *
 * UI for atomic cross-chain swaps between Solana and Atlas Sphere.
 */

'use client';

import { useState, useCallback } from 'react';
import { ArrowDownUp, Loader2, CheckCircle, XCircle, Zap, Globe, Link } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  useCrossChainSwap,
  useAtlasSphere,
  useCanonicalBalances,
  type CrossChainAsset,
} from '@/hooks/useCrossChainTrading';

/**
 * Asset selector component
 */
function AssetSelector({
  label,
  value,
  onChange,
  assets,
  balance,
  filterChain,
}: {
  label: string;
  value: CrossChainAsset | null;
  onChange: (asset: CrossChainAsset) => void;
  assets: CrossChainAsset[];
  balance?: string;
  filterChain?: string;
}) {
  // Group assets by chain
  const groupedAssets = assets.reduce((acc, asset) => {
    if (filterChain && asset.chain !== filterChain) return acc;
    const chain = asset.chain;
    if (!acc[chain]) acc[chain] = [];
    acc[chain].push(asset);
    return acc;
  }, {} as Record<string, CrossChainAsset[]>);

  const chainOrder = ['solana', 'atlas-evm', 'atlas-svm'];
  const sortedChains = Object.keys(groupedAssets).sort(
    (a, b) => chainOrder.indexOf(a) - chainOrder.indexOf(b)
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>{label}</Label>
        {balance && (
          <span className="text-sm text-muted-foreground">Balance: {balance}</span>
        )}
      </div>
      <Select
        value={value ? `${value.chain}-${value.symbol}` : undefined}
        onValueChange={(val) => {
          const [chain, symbol] = val.split('-');
          const asset = assets.find((a) => a.chain === chain && a.symbol === symbol);
          if (asset) onChange(asset);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select token">
            {value && (
              <div className="flex items-center gap-2">
                <TokenIcon symbol={value.symbol} chain={value.chain} />
                <span className="font-medium">{value.symbol}</span>
                <ChainBadge chain={value.chain} />
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {sortedChains.map((chain) => (
            <div key={chain}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {getChainName(chain)}
              </div>
              {groupedAssets[chain].map((asset) => (
                <SelectItem 
                  key={`${asset.chain}-${asset.symbol}`} 
                  value={`${asset.chain}-${asset.symbol}`}
                >
                  <div className="flex items-center gap-2">
                    <TokenIcon symbol={asset.symbol} chain={asset.chain} />
                    <span className="font-medium">{asset.symbol}</span>
                    <ChainBadge chain={asset.chain} />
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Token icon component
 */
function TokenIcon({ symbol, chain }: { symbol: string; chain: string }) {
  const getTokenEmoji = (symbol: string) => {
    const icons: Record<string, string> = {
      SOL: '◎',
      USDC: '💵',
      ATLAS: '🔷',
      WETH: 'Ξ',
      eUSDC: '💵',
      aUSDC: '💵',
      DAI: '◈',
      WBTC: '₿',
      UNI: '🦄',
      LINK: '⬡',
      AAVE: '👻',
    };
    return icons[symbol] || '🪙';
  };

  return (
    <span className="text-lg" title={`${symbol} on ${chain}`}>
      {getTokenEmoji(symbol)}
    </span>
  );
}

/**
 * Get human-readable chain name
 */
function getChainName(chain: string): string {
  switch (chain) {
    case 'solana':
      return '🟣 Solana';
    case 'atlas-evm':
      return '🔵 Atlas EVM';
    case 'atlas-svm':
      return '🟢 Atlas SVM';
    default:
      return chain;
  }
}

/**
 * Chain badge component
 */
function ChainBadge({ chain }: { chain: string }) {
  const getChainColor = (chain: string) => {
    switch (chain) {
      case 'solana':
        return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      case 'atlas-evm':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'atlas-svm':
        return 'bg-green-500/20 text-green-500 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  const getChainLabel = (chain: string) => {
    switch (chain) {
      case 'solana':
        return 'SOL';
      case 'atlas-evm':
        return 'EVM';
      case 'atlas-svm':
        return 'SVM';
      default:
        return chain;
    }
  };

  return (
    <Badge variant="outline" className={`text-xs px-1.5 py-0 ${getChainColor(chain)}`}>
      {getChainLabel(chain)}
    </Badge>
  );
}

/**
 * Swap route display
 */
function SwapRouteDisplay({ route }: { route: { chain: string; protocol: string }[] }) {
  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
      {route.map((hop, index) => (
        <div key={index} className="flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground/50">→</span>}
          <span className="text-xs">{hop.protocol}</span>
          <ChainBadge chain={hop.chain} />
        </div>
      ))}
    </div>
  );
}

/**
 * Main Cross-Chain Swap Component
 */
export function CrossChainSwap() {
  const {
    inputAsset,
    outputAsset,
    inputAmount,
    quote,
    isQuoting,
    isSwapping,
    lastResult,
    setInputAsset,
    setOutputAsset,
    setInputAmount,
    switchAssets,
    executeSwap,
    atlasConnected,
    availableAssets,
  } = useCrossChainSwap();

  const { getFormattedBalance } = useCanonicalBalances();
  const [signerInput, setSignerInput] = useState('');

  const handleSwap = useCallback(async () => {
    if (!signerInput) {
      alert('Please enter your Atlas Sphere signer mnemonic');
      return;
    }
    await executeSwap(signerInput);
  }, [executeSwap, signerInput]);

  const formatOutputAmount = () => {
    if (!quote || !outputAsset) return '0';
    return (Number(quote.outputAmount) / 10 ** outputAsset.decimals).toFixed(6);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Cross-Chain Swap
            </CardTitle>
            <CardDescription>
              Atomic swaps between Solana and Atlas Sphere
            </CardDescription>
          </div>
          <Badge variant={atlasConnected ? 'default' : 'destructive'}>
            {atlasConnected ? (
              <>
                <Globe className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Disconnected
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Input section */}
        <div className="space-y-2">
          <AssetSelector
            label="From"
            value={inputAsset}
            onChange={setInputAsset}
            assets={availableAssets}
            balance={
              inputAsset?.canonicalId !== undefined
                ? getFormattedBalance(inputAsset.canonicalId, inputAsset.decimals)
                : undefined
            }
          />
          <Input
            type="number"
            placeholder="0.0"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            className="text-2xl h-14"
          />
        </div>

        {/* Swap direction button */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={switchAssets}
            className="rounded-full border"
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>
        </div>

        {/* Output section */}
        <div className="space-y-2">
          <AssetSelector
            label="To"
            value={outputAsset}
            onChange={setOutputAsset}
            assets={availableAssets}
            balance={
              outputAsset?.canonicalId !== undefined
                ? getFormattedBalance(outputAsset.canonicalId, outputAsset.decimals)
                : undefined
            }
          />
          <div className="relative">
            <Input
              type="text"
              value={isQuoting ? 'Getting quote...' : formatOutputAmount()}
              readOnly
              className="text-2xl h-14 bg-muted"
            />
            {isQuoting && (
              <Loader2 className="h-5 w-5 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
        </div>

        {/* Quote details */}
        {quote && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price Impact</span>
              <span className={quote.priceImpact > 5 ? 'text-red-500' : ''}>
                {quote.priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Gas</span>
              <span>{quote.estimatedGas.toString()} units</span>
            </div>
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Route</Label>
              <SwapRouteDisplay route={quote.route} />
            </div>
          </div>
        )}

        {/* Signer input (simplified - in production use secure wallet signing) */}
        <div className="space-y-2">
          <Label>Atlas Sphere Signer</Label>
          <Input
            type="password"
            placeholder="Enter mnemonic or //Alice for dev"
            value={signerInput}
            onChange={(e) => setSignerInput(e.target.value)}
          />
        </div>

        {/* Swap button */}
        <Button
          className="w-full h-12 text-lg"
          disabled={!quote || isSwapping || !atlasConnected}
          onClick={handleSwap}
        >
          {isSwapping ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Executing Atomic Swap...
            </>
          ) : (
            <>
              <Link className="h-5 w-5 mr-2" />
              Swap Atomically
            </>
          )}
        </Button>

        {/* Result display */}
        {lastResult && (
          <div
            className={`p-3 rounded-lg ${
              lastResult.success
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {lastResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                {lastResult.success ? 'Swap Successful!' : 'Swap Failed'}
              </span>
            </div>
            {lastResult.txHash && (
              <p className="text-sm text-muted-foreground mt-1 font-mono truncate">
                Tx: {lastResult.txHash}
              </p>
            )}
            {lastResult.error && (
              <p className="text-sm text-red-500 mt-1">{lastResult.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Atlas Connection Status Component
 */
export function AtlasConnectionStatus() {
  const { isConnected, chainInfo, isLoading, error, connect, disconnect } =
    useAtlasSphere();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Atlas Sphere Connection
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connecting...</span>
          </div>
        ) : isConnected && chainInfo ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium">Connected</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Chain: {chainInfo.chain}</p>
              <p>Node: {chainInfo.nodeName} v{chainInfo.nodeVersion}</p>
            </div>
            <Button variant="outline" size="sm" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button onClick={connect}>
              Connect to Atlas Sphere
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CrossChainSwap;
