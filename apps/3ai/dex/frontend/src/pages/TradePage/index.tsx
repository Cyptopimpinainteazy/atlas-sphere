import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  GridItem,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Badge,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Divider,
  useColorModeValue,
  Tooltip,
  Tag,
} from '@chakra-ui/react';
import { useAccount } from 'wagmi';
import { PAIRS, TOKENS, ORDER_TYPES, DEFAULT_PAIR, TIME_IN_FORCE_OPTIONS, CHAINS } from '../../config';
import { MainLayout } from '../../layouts/MainLayout';
import { useDex } from '../../hooks/useDex';

// ─── Mock data for demo (would come from API/WebSocket) ─────────────
const MOCK_ORDERBOOK = {
  bids: [
    [0.000842, 1250.5],
    [0.000841, 3420.0],
    [0.000840, 890.2],
    [0.000839, 5100.0],
    [0.000838, 2340.8],
    [0.000837, 1890.0],
    [0.000836, 4200.0],
    [0.000835, 760.5],
  ] as [number, number][],
  asks: [
    [0.000843, 980.0],
    [0.000844, 2100.3],
    [0.000845, 1540.0],
    [0.000846, 4320.0],
    [0.000847, 870.5],
    [0.000848, 3100.0],
    [0.000849, 1250.0],
    [0.000850, 5600.0],
  ] as [number, number][],
  lastPrice: 0.000842,
  priceChange24h: 2.45,
  volume24h: 1245600,
  high24h: 0.000856,
  low24h: 0.000831,
};

const MOCK_TRADES = [
  { time: '11:42:15', price: 0.000842, amount: 150.0, side: 'buy' as const },
  { time: '11:42:10', price: 0.000843, amount: 320.5, side: 'sell' as const },
  { time: '11:41:58', price: 0.000841, amount: 80.0, side: 'buy' as const },
  { time: '11:41:45', price: 0.000842, amount: 1200.0, side: 'buy' as const },
  { time: '11:41:30', price: 0.000844, amount: 450.0, side: 'sell' as const },
  { time: '11:41:22', price: 0.000840, amount: 200.0, side: 'buy' as const },
  { time: '11:41:10', price: 0.000843, amount: 670.0, side: 'sell' as const },
  { time: '11:40:55', price: 0.000841, amount: 510.0, side: 'buy' as const },
];

const MOCK_OPEN_ORDERS = [
  { id: '0x1a2b', pair: '3AI/USDT', side: 'BUY', type: 'LIMIT', price: 0.000835, amount: 5000, filled: 0, status: 'OPEN', time: '11:30:00' },
  { id: '0x3c4d', pair: '3AI/USDT', side: 'SELL', type: 'LIMIT', price: 0.000860, amount: 2500, filled: 0, status: 'OPEN', time: '11:25:00' },
];

// ─── Format helpers ─────────────────────────────────────────────────
const fmt = (n: number, d = 6) =>
  n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtAmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ─── Order Book Panel ───────────────────────────────────────────────
const OrderBookPanel = () => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box borderWidth="1px" borderRadius="lg" borderColor={borderColor} bg="gray.800" p={3} h="100%">
      <HStack justify="space-between" mb={2}>
        <Heading size="sm" color="white">Order Book</Heading>
        <Badge colorScheme="green">{DEFAULT_PAIR.id}</Badge>
      </HStack>

      {/* Asks (sell orders) - shown in reverse so lowest ask is at bottom */}
      <Box mb={1}>
        <HStack justify="space-between" px={1} mb={1}>
          <Text fontSize="xs" color="gray.500">Price (USDT)</Text>
          <Text fontSize="xs" color="gray.500">Amount (3AI)</Text>
          <Text fontSize="xs" color="gray.500">Total</Text>
        </HStack>
        {[...MOCK_ORDERBOOK.asks].reverse().map(([price, amount], i) => (
          <HStack key={`ask-${i}`} justify="space-between" px={1} py={0.5}
            _hover={{ bg: 'red.900', cursor: 'pointer' }} borderRadius="sm">
            <Text fontSize="xs" color="red.400" fontFamily="mono" w="33%">{fmt(price)}</Text>
            <Text fontSize="xs" color="gray.300" fontFamily="mono" w="33%" textAlign="right">{fmtAmt(amount)}</Text>
            <Text fontSize="xs" color="gray.500" fontFamily="mono" w="33%" textAlign="right">{fmtAmt(price * amount)}</Text>
          </HStack>
        ))}
      </Box>

      {/* Spread / Last Price */}
      <Box py={2} textAlign="center" borderTopWidth="1px" borderBottomWidth="1px" borderColor={borderColor}>
        <Text fontSize="lg" fontWeight="bold" color="green.400" fontFamily="mono">
          {fmt(MOCK_ORDERBOOK.lastPrice)}
        </Text>
        <Text fontSize="xs" color="gray.400">
          ≈ ${(MOCK_ORDERBOOK.lastPrice * 1).toFixed(6)} USD
        </Text>
      </Box>

      {/* Bids (buy orders) */}
      <Box mt={1}>
        {MOCK_ORDERBOOK.bids.map(([price, amount], i) => (
          <HStack key={`bid-${i}`} justify="space-between" px={1} py={0.5}
            _hover={{ bg: 'green.900', cursor: 'pointer' }} borderRadius="sm">
            <Text fontSize="xs" color="green.400" fontFamily="mono" w="33%">{fmt(price)}</Text>
            <Text fontSize="xs" color="gray.300" fontFamily="mono" w="33%" textAlign="right">{fmtAmt(amount)}</Text>
            <Text fontSize="xs" color="gray.500" fontFamily="mono" w="33%" textAlign="right">{fmtAmt(price * amount)}</Text>
          </HStack>
        ))}
      </Box>
    </Box>
  );
};

// ─── Recent Trades Panel ────────────────────────────────────────────
const RecentTradesPanel = () => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box borderWidth="1px" borderRadius="lg" borderColor={borderColor} bg="gray.800" p={3}>
      <Heading size="sm" color="white" mb={2}>Recent Trades</Heading>
      <HStack justify="space-between" px={1} mb={1}>
        <Text fontSize="xs" color="gray.500">Price</Text>
        <Text fontSize="xs" color="gray.500">Amount</Text>
        <Text fontSize="xs" color="gray.500">Time</Text>
      </HStack>
      {MOCK_TRADES.map((trade, i) => (
        <HStack key={i} justify="space-between" px={1} py={0.5}>
          <Text fontSize="xs" color={trade.side === 'buy' ? 'green.400' : 'red.400'} fontFamily="mono">
            {fmt(trade.price)}
          </Text>
          <Text fontSize="xs" color="gray.300" fontFamily="mono">{fmtAmt(trade.amount)}</Text>
          <Text fontSize="xs" color="gray.500">{trade.time}</Text>
        </HStack>
      ))}
    </Box>
  );
};

// ─── Order Form Panel ───────────────────────────────────────────────
const OrderFormPanel = ({ onOrderPlaced }: { onOrderPlaced?: () => void }) => {
  const { isConnected, address } = useAccount();
  const toast = useToast();
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const { submitOrder, initialized: dexReady } = useDex();

  const [isBuy, setIsBuy] = useState(true);
  const [orderType, setOrderType] = useState('LIMIT');
  const [pair, setPair] = useState(DEFAULT_PAIR.id);
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [timeInForce, setTimeInForce] = useState('GTC');
  const [sourceChain, setSourceChain] = useState('ethereum');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPair = PAIRS.find((p) => p.id === pair) || DEFAULT_PAIR;
  const total = price && amount ? (parseFloat(price) * parseFloat(amount)).toFixed(6) : '0.000000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      toast({ title: 'Wallet not connected', description: 'Please connect your wallet to trade', status: 'warning', duration: 4000, isClosable: true });
      return;
    }
    if (!amount) {
      toast({ title: 'Amount required', status: 'error', duration: 3000, isClosable: true });
      return;
    }
    if (orderType !== 'MARKET' && !price) {
      toast({ title: 'Price required for limit orders', status: 'error', duration: 3000, isClosable: true });
      return;
    }

    try {
      setIsSubmitting(true);

      const sdkOrderType = orderType === 'STOP_LOSS' ? 'stop-loss'
        : orderType === 'TAKE_PROFIT' ? 'take-profit'
        : orderType.toLowerCase() as 'market' | 'limit';

      const result = await submitOrder({
        baseAsset: currentPair.base,
        quoteAsset: currentPair.quote,
        type: sdkOrderType,
        side: isBuy ? 'buy' : 'sell',
        price: orderType === 'MARKET' ? '0' : price,
        amount,
        timeInForce: timeInForce as 'GTC' | 'IOC' | 'FOK',
      });

      if (result.success) {
        toast({
          title: 'Order placed via X3 DEX',
          description: `${isBuy ? 'Buy' : 'Sell'} ${amount} ${currentPair.base} @ ${orderType === 'MARKET' ? 'market' : price} — Chain: ${sourceChain}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        setPrice('');
        setAmount('');
        onOrderPlaced?.();
      } else {
        toast({ title: 'Order failed', description: result.error, status: 'error', duration: 5000, isClosable: true });
      }
    } catch {
      toast({ title: 'Order failed', status: 'error', duration: 5000, isClosable: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" borderColor={borderColor} bg="gray.800" p={4}>
      <Heading size="sm" color="white" mb={3}>Place Order</Heading>

      {/* Buy / Sell toggle */}
      <HStack spacing={2} mb={4}>
        <Button flex={1} size="sm" colorScheme={isBuy ? 'green' : 'gray'} variant={isBuy ? 'solid' : 'outline'} onClick={() => setIsBuy(true)}>
          Buy
        </Button>
        <Button flex={1} size="sm" colorScheme={!isBuy ? 'red' : 'gray'} variant={!isBuy ? 'solid' : 'outline'} onClick={() => setIsBuy(false)}>
          Sell
        </Button>
      </HStack>

      <form onSubmit={handleSubmit}>
        <VStack spacing={3}>
          <FormControl size="sm">
            <FormLabel fontSize="xs" color="gray.400">Order Type</FormLabel>
            <Select size="sm" bg="gray.700" borderColor="gray.600" color="white"
              value={orderType} onChange={(e) => setOrderType(e.target.value)}>
              {ORDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="xs" color="gray.400">Pair</FormLabel>
            <Select size="sm" bg="gray.700" borderColor="gray.600" color="white"
              value={pair} onChange={(e) => setPair(e.target.value)}>
              {PAIRS.map((p) => (
                <option key={p.id} value={p.id}>{p.base}/{p.quote}</option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel fontSize="xs" color="gray.400">
              Settlement Chain
              <Tooltip label="Chain used for atomic swap settlement" fontSize="xs">
                <Tag size="sm" ml={1} colorScheme="blue" variant="subtle">cross-chain</Tag>
              </Tooltip>
            </FormLabel>
            <Select size="sm" bg="gray.700" borderColor="gray.600" color="white"
              value={sourceChain} onChange={(e) => setSourceChain(e.target.value)}>
              {CHAINS.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
              ))}
            </Select>
          </FormControl>

          <FormControl size="sm">
            <FormLabel fontSize="xs" color="gray.400">Time in Force</FormLabel>
            <Select size="sm" bg="gray.700" borderColor="gray.600" color="white"
              value={timeInForce} onChange={(e) => setTimeInForce(e.target.value)}>
              {TIME_IN_FORCE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </FormControl>

          {orderType !== 'MARKET' && (
            <FormControl>
              <FormLabel fontSize="xs" color="gray.400">Price ({currentPair.quote})</FormLabel>
              <Input size="sm" type="number" step="0.000001" placeholder="0.000000"
                bg="gray.700" borderColor="gray.600" color="white"
                value={price} onChange={(e) => setPrice(e.target.value)} />
            </FormControl>
          )}

          <FormControl>
            <FormLabel fontSize="xs" color="gray.400">Amount ({currentPair.base})</FormLabel>
            <Input size="sm" type="number" step="0.0001" placeholder="0.0000"
              bg="gray.700" borderColor="gray.600" color="white"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormControl>

          <HStack w="100%" justify="space-between">
            <Text fontSize="xs" color="gray.500">Total</Text>
            <Text fontSize="xs" color="white" fontFamily="mono">{total} {currentPair.quote}</Text>
          </HStack>

          <Button type="submit" w="100%" size="md"
            colorScheme={isBuy ? 'green' : 'red'}
            isLoading={isSubmitting} loadingText="Placing..."
            isDisabled={!isConnected}>
            {isBuy ? 'Buy' : 'Sell'} {currentPair.base}
          </Button>

          {!dexReady && (
            <Text color="blue.300" fontSize="xs" textAlign="center">
              X3 DEX SDK initializing...
            </Text>
          )}

          {!isConnected && (
            <Text color="yellow.400" fontSize="xs" textAlign="center">
              Connect your wallet to trade
            </Text>
          )}
        </VStack>
      </form>
    </Box>
  );
};

// ─── Open Orders Panel ──────────────────────────────────────────────
const OpenOrdersPanel = () => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box borderWidth="1px" borderRadius="lg" borderColor={borderColor} bg="gray.800" p={3}>
      <Heading size="sm" color="white" mb={2}>Open Orders</Heading>
      {MOCK_OPEN_ORDERS.length === 0 ? (
        <Text color="gray.500" fontSize="sm" textAlign="center" py={4}>No open orders</Text>
      ) : (
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th color="gray.500" px={2}>Pair</Th>
              <Th color="gray.500" px={2}>Side</Th>
              <Th color="gray.500" px={2}>Type</Th>
              <Th color="gray.500" px={2} isNumeric>Price</Th>
              <Th color="gray.500" px={2} isNumeric>Amount</Th>
              <Th color="gray.500" px={2}>Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {MOCK_OPEN_ORDERS.map((order) => (
              <Tr key={order.id}>
                <Td px={2} fontSize="xs" color="white">{order.pair}</Td>
                <Td px={2}><Badge colorScheme={order.side === 'BUY' ? 'green' : 'red'} fontSize="xs">{order.side}</Badge></Td>
                <Td px={2} fontSize="xs" color="gray.300">{order.type}</Td>
                <Td px={2} fontSize="xs" color="white" fontFamily="mono" isNumeric>{fmt(order.price)}</Td>
                <Td px={2} fontSize="xs" color="white" fontFamily="mono" isNumeric>{fmtAmt(order.amount)}</Td>
                <Td px={2}><Button size="xs" colorScheme="red" variant="ghost">Cancel</Button></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  );
};

// ─── Market Stats Bar ───────────────────────────────────────────────
const MarketStatsBar = () => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const { initialized: dexReady } = useDex();

  return (
    <HStack spacing={6} p={3} bg="gray.800" borderWidth="1px" borderRadius="lg" borderColor={borderColor} overflowX="auto">
      <HStack spacing={2}>
        <Badge colorScheme="purple" fontSize="xs">Atomic Swap DEX</Badge>
        {dexReady ? (
          <Badge colorScheme="green" fontSize="xs">SDK Ready</Badge>
        ) : (
          <Badge colorScheme="yellow" fontSize="xs">Connecting...</Badge>
        )}
      </HStack>
      <Divider orientation="vertical" h="40px" />
      <Stat minW="120px">
        <StatLabel fontSize="xs" color="gray.400">{DEFAULT_PAIR.base}/{DEFAULT_PAIR.quote}</StatLabel>
        <StatNumber fontSize="md" color="green.400" fontFamily="mono">{fmt(MOCK_ORDERBOOK.lastPrice)}</StatNumber>
        <StatHelpText fontSize="xs" mb={0}>
          <StatArrow type={MOCK_ORDERBOOK.priceChange24h >= 0 ? 'increase' : 'decrease'} />
          {MOCK_ORDERBOOK.priceChange24h.toFixed(2)}%
        </StatHelpText>
      </Stat>
      <Divider orientation="vertical" h="40px" />
      <Stat minW="100px">
        <StatLabel fontSize="xs" color="gray.400">24h High</StatLabel>
        <StatNumber fontSize="sm" color="white" fontFamily="mono">{fmt(MOCK_ORDERBOOK.high24h)}</StatNumber>
      </Stat>
      <Stat minW="100px">
        <StatLabel fontSize="xs" color="gray.400">24h Low</StatLabel>
        <StatNumber fontSize="sm" color="white" fontFamily="mono">{fmt(MOCK_ORDERBOOK.low24h)}</StatNumber>
      </Stat>
      <Stat minW="100px">
        <StatLabel fontSize="xs" color="gray.400">24h Volume</StatLabel>
        <StatNumber fontSize="sm" color="white" fontFamily="mono">{(MOCK_ORDERBOOK.volume24h).toLocaleString()} 3AI</StatNumber>
      </Stat>
      <Divider orientation="vertical" h="40px" />
      <HStack spacing={1} flexShrink={0}>
        <Text fontSize="xs" color="gray.500">Chains:</Text>
        {['ETH', 'SOL', 'BTC', 'X3'].map((c) => (
          <Tag key={c} size="sm" colorScheme="blue" variant="subtle" fontSize="2xs">{c}</Tag>
        ))}
      </HStack>
    </HStack>
  );
};

// ─── Chart Placeholder ──────────────────────────────────────────────
const ChartPanel = () => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box borderWidth="1px" borderRadius="lg" borderColor={borderColor} bg="gray.800" p={3} h="100%" minH="300px" position="relative">
      <HStack justify="space-between" mb={2}>
        <Heading size="sm" color="white">{DEFAULT_PAIR.base}/{DEFAULT_PAIR.quote}</Heading>
        <HStack spacing={1}>
          {['1m', '5m', '15m', '1h', '4h', '1D'].map((interval) => (
            <Button key={interval} size="xs" variant="ghost" color="gray.400"
              _hover={{ color: 'white', bg: 'gray.700' }}
              _active={{ color: 'blue.300' }}>
              {interval}
            </Button>
          ))}
        </HStack>
      </HStack>

      {/* Simulated candlestick area */}
      <Box h="calc(100% - 40px)" display="flex" alignItems="center" justifyContent="center" position="relative">
        <Box position="absolute" inset={0} opacity={0.15}>
          {/* Simple price bars visualization */}
          <HStack h="100%" align="flex-end" spacing={1} px={2} pb={4}>
            {[65, 72, 58, 80, 75, 62, 85, 70, 90, 68, 78, 55, 82, 76, 88, 60, 73, 92, 67, 84, 71, 95, 63, 87, 79].map((h, i) => (
              <Box key={i} flex={1} bg={i % 3 === 0 ? 'red.500' : 'green.500'} h={`${h}%`} borderRadius="sm" minW="4px" />
            ))}
          </HStack>
        </Box>
        <VStack spacing={2}>
          <Text color="gray.500" fontSize="sm">TradingView chart integration ready</Text>
          <Text color="gray.600" fontSize="xs">Connect to API for live data</Text>
        </VStack>
      </Box>
    </Box>
  );
};

// ─── Main Trade Page ────────────────────────────────────────────────
const TradePage = () => {
  return (
    <MainLayout>
      <VStack spacing={3} align="stretch" h="calc(100vh - 120px)">
        {/* Market stats bar */}
        <MarketStatsBar />

        {/* Main trading grid */}
        <Grid
          templateColumns={{ base: '1fr', lg: '260px 1fr 300px' }}
          templateRows={{ base: 'auto', lg: '1fr auto' }}
          gap={3}
          flex={1}
          minH={0}
        >
          {/* Left: Order Book */}
          <GridItem rowSpan={{ base: 1, lg: 2 }} overflow="auto">
            <OrderBookPanel />
          </GridItem>

          {/* Center: Chart */}
          <GridItem>
            <ChartPanel />
          </GridItem>

          {/* Right: Order Form */}
          <GridItem>
            <OrderFormPanel />
          </GridItem>

          {/* Center bottom: Recent Trades */}
          <GridItem>
            <RecentTradesPanel />
          </GridItem>

          {/* Right bottom: nothing or can be additional panel */}
          <GridItem display={{ base: 'none', lg: 'block' }} />
        </Grid>

        {/* Bottom: Open Orders / History */}
        <Tabs size="sm" variant="enclosed" colorScheme="blue">
          <TabList>
            <Tab color="gray.400" _selected={{ color: 'white', bg: 'gray.800' }}>Open Orders ({MOCK_OPEN_ORDERS.length})</Tab>
            <Tab color="gray.400" _selected={{ color: 'white', bg: 'gray.800' }}>Order History</Tab>
            <Tab color="gray.400" _selected={{ color: 'white', bg: 'gray.800' }}>Trade History</Tab>
          </TabList>
          <TabPanels>
            <TabPanel p={0} pt={2}>
              <OpenOrdersPanel />
            </TabPanel>
            <TabPanel p={0} pt={2}>
              <Box bg="gray.800" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.700">
                <Text color="gray.500" textAlign="center" fontSize="sm">No order history</Text>
              </Box>
            </TabPanel>
            <TabPanel p={0} pt={2}>
              <Box bg="gray.800" p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.700">
                <Text color="gray.500" textAlign="center" fontSize="sm">No trade history</Text>
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </MainLayout>
  );
};

export default TradePage;
