import {
  Connection,
  PublicKey,
} from '@solana/web3.js';

interface SolanaPair {
  pool_address: string;
  base_mint: string;
  quote_mint: string;
  base_symbol: string;
  quote_symbol: string;
  price: number;
  volume_24h: number;
  liquidity_usd: number;
  price_change_24h: number;
  dex: string;
  last_updated: string;
}

interface PoolLiquidity {
  pool_address: string;
  base_mint?: string;
  quote_mint?: string;
  base_symbol?: string;
  quote_symbol?: string;
  base_reserve?: number;
  quote_reserve?: number;
  liquidity_usd?: number;
  volume_24h?: number;
  fees_24h?: number;
  apy?: number;
  price?: number;
  price_change_24h?: number;
  dex?: string;
  on_chain_data?: {
    lamports: number;
    owner: string;
    executable: boolean;
    rent_epoch: number;
  };
  last_updated: string;
}

class SolanaMCPClient {
  private connection: Connection;
  private apiUrl: string;

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com', apiUrl?: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.apiUrl = apiUrl || 'https://api.raydium.io';
  }

  // Get real-time trading pairs data
  async getTradingPairs(dex?: string, limit: number = 20): Promise<SolanaPair[]> {
    try {
      // For now, we'll use direct API calls until the MCP server is running
      if (dex === 'raydium' || !dex) {
        const response = await fetch(`${this.apiUrl}/v2/main/pairs`);
        const data = await response.json();

        return (data.data || [])
          .filter((pair: any) => pair.volume24h > 1000 && pair.liquidity > 10000) // Filter low volume pairs
          .sort((a: any, b: any) => (b.volume24h || 0) - (a.volume24h || 0))
          .slice(0, limit)
          .map((pair: any) => ({
            pool_address: pair.ammId,
            base_mint: pair.baseMint,
            quote_mint: pair.quoteMint,
            base_symbol: pair.baseSymbol,
            quote_symbol: pair.quoteSymbol,
            price: parseFloat(pair.price) || 0,
            volume_24h: parseFloat(pair.volume24h) || 0,
            liquidity_usd: parseFloat(pair.liquidity) || 0,
            price_change_24h: parseFloat(pair.priceChange24h) || 0,
            dex: 'raydium',
            last_updated: new Date().toISOString()
          }));
      }

      return [];
    } catch (error) {
      console.warn('Failed to fetch pairs from Raydium API:', error);
      return this.getFallbackPairs(limit);
    }
  }

  // Fallback pairs for demo when API is unavailable
  private getFallbackPairs(limit: number): SolanaPair[] {
    return [
      {
        pool_address: '2QdhepnKRTLjjSqPL1PtKNwqrUkoLee5Gqs8bvZhRdMv',
        base_mint: 'So11111111111111111111111111111111111111112',
        quote_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        base_symbol: 'SOL',
        quote_symbol: 'USDC',
        price: 142.85,
        volume_24h: 145670000,
        liquidity_usd: 28750000,
        price_change_24h: 5.2,
        dex: 'raydium',
        last_updated: new Date().toISOString()
      },
      {
        pool_address: 'DYyTxWFHL92LisCVLJB3AwMNKXLzD6T9GEvKPfA8SGFF',
        base_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        quote_mint: 'So11111111111111111111111111111111111111112',
        base_symbol: 'USDC',
        quote_symbol: 'SOL',
        price: 0.00701,
        volume_24h: 123450000,
        liquidity_usd: 21500000,
        price_change_24h: -2.1,
        dex: 'raydium',
        last_updated: new Date().toISOString()
      },
      {
        pool_address: '8sLbNZoA1cfnvMJLPfpG66TLhJECH1tdMRHYyhELttHY',
        base_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        quote_mint: '9n4nbM75f5Ui33ZbPYXn59EwSgE8JCunNGnidDsEviza',
        base_symbol: 'USDC',
        quote_symbol: 'BTC',
        price: 68950.50,
        volume_24h: 98750000,
        liquidity_usd: 18500000,
        price_change_24h: 3.8,
        dex: 'raydium',
        last_updated: new Date().toISOString()
      },
      {
        pool_address: '4jZYWvvQze7XjBnQXyZUQAzHhqNRgpVFCKCNjDmQmh9Bp',
        base_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        quote_mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        base_symbol: 'USDC',
        quote_symbol: 'ETH',
        price: 2847.32,
        volume_24h: 87650000,
        liquidity_usd: 16800000,
        price_change_24h: 1.2,
        dex: 'raydium',
        last_updated: new Date().toISOString()
      },
      {
        pool_address: 'CmQkzHhGFZ3GjMv4t6A43GUMCGh3UPAyUWC1Vwv9mdZr',
        base_mint: 'DuQM7F1E2KbNQ2TqtMV797WxEQR6KnWLozx7srTZYHHp',
        quote_mint: 'So11111111111111111111111111111111111111112',
        base_symbol: 'RAY',
        quote_symbol: 'SOL',
        price: 0.789,
        volume_24h: 67500000,
        liquidity_usd: 12400000,
        price_change_24h: 8.7,
        dex: 'raydium',
        last_updated: new Date().toISOString()
      }
    ].slice(0, limit);
  }

  // Get pool liquidity data
  async getPoolLiquidity(poolAddress: string): Promise<PoolLiquidity> {
    try {
      const poolData = await this.connection.getAccountInfo(new PublicKey(poolAddress));

      // Try to get Raydium pool data
      try {
        const response = await fetch(`${this.apiUrl}/v2/sdk/liquidity/mainnet.json`);
        const data = await response.json();
        const pool = Object.values(data).find((pool: any) =>
          pool.ammId === poolAddress || pool.id === poolAddress
        );

        if (pool) {
          return {
            pool_address: poolAddress,
            base_mint: pool.baseMint,
            quote_mint: pool.quoteMint,
            base_symbol: pool.baseSymbol,
            quote_symbol: pool.quoteSymbol,
            base_reserve: pool.coinAmount,
            quote_reserve: pool.pcAmount,
            liquidity_usd: pool.liquidity,
            dex: 'raydium',
            on_chain_data: poolData ? {
              lamports: poolData.lamports,
              owner: poolData.owner.toString(),
              executable: poolData.executable,
              rent_epoch: poolData.rentEpoch
            } : undefined,
            last_updated: new Date().toISOString()
          };
        }
      } catch (apiError) {
        console.warn('Raydium API failed, using chain data only');
      }

      // Fallback to basic chain data
      return {
        pool_address: poolAddress,
        dex: 'unknown',
        on_chain_data: poolData ? {
          lamports: poolData.lamports,
          owner: poolData.owner.toString(),
          executable: poolData.executable,
          rent_epoch: poolData.rentEpoch
        } : undefined,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.warn('Failed to fetch pool liquidity:', error);
      return {
        pool_address: poolAddress,
        dex: 'unknown',
        last_updated: new Date().toISOString()
      };
    }
  }

  // Get popular tokens
  async getPopularTokens(): Promise<Array<{mint: string, symbol: string, price: number, volume: number}>> {
    try {
      const pairs = await this.getTradingPairs('raydium', 50);

      // Group by tokens and sum volumes
      const tokenStats: { [key: string]: any } = {};
      pairs.forEach(pair => {
        [pair.base_mint, pair.quote_mint].forEach((mint, index) => {
          const symbol = index === 0 ? pair.base_symbol : pair.quote_symbol;
          if (!tokenStats[mint]) {
            tokenStats[mint] = {
              mint,
              symbol,
              totalVolume: 0,
              pools: 0,
              avgPrice: 0
            };
          }
          tokenStats[mint].totalVolume += pair.volume_24h;
          tokenStats[mint].pools += 1;

          if (index === 0) {  // base token
            tokenStats[mint].avgPrice = pair.price;
          } else {  // quote token, need to inverse
            tokenStats[mint].avgPrice = 1 / pair.price;
          }
        });
      });

      return Object.values(tokenStats)
        .sort((a: any, b: any) => b.totalVolume - a.totalVolume)
        .slice(0, 20);
    } catch (error) {
      console.warn('Failed to get popular tokens:', error);
      return [];
    }
  }
}

export const solanaMCPClient = new SolanaMCPClient();
export type { SolanaPair, PoolLiquidity };
