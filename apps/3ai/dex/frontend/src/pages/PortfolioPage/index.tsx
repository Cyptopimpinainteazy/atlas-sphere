import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  HStack,
  VStack,
  Progress,
  useColorModeValue,
} from '@chakra-ui/react';
import { useAccount } from 'wagmi';
import { MainLayout } from '../../layouts/MainLayout';

const MOCK_BALANCES = [
  { token: '3AI', balance: '125,000.00', value: '$105.25', change: 2.45 },
  { token: 'USDT', balance: '5,420.00', value: '$5,420.00', change: 0.0 },
  { token: 'W3AI', balance: '50,000.00', value: '$42.10', change: 0.12 },
  { token: 'ETH', balance: '1.2500', value: '$3,556.88', change: 1.87 },
];

const MOCK_HISTORY = [
  { time: '2026-02-10 11:30', pair: '3AI/USDT', side: 'BUY', amount: '5,000', price: '0.000842', total: '4.21', status: 'FILLED' },
  { time: '2026-02-10 10:15', pair: '3AI/USDT', side: 'SELL', amount: '2,500', price: '0.000845', total: '2.11', status: 'FILLED' },
  { time: '2026-02-09 16:45', pair: 'ETH/USDT', side: 'BUY', amount: '0.5', price: '2,840.00', total: '1,420.00', status: 'FILLED' },
];

const PortfolioPage = () => {
  const { isConnected, address } = useAccount();
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const totalValue = '$9,124.23';

  if (!isConnected) {
    return (
      <MainLayout>
        <Container maxW="container.xl" py={8}>
          <VStack spacing={4} textAlign="center" py={20}>
            <Heading size="lg" color="white">Portfolio</Heading>
            <Text color="gray.400" fontSize="lg">Connect your wallet to view your portfolio</Text>
          </VStack>
        </Container>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Container maxW="container.xl" py={4}>
        <Heading size="lg" color="white" mb={6}>Portfolio</Heading>

        {/* Summary Stats */}
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4} mb={6}>
          <Stat p={4} bg="gray.800" borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
            <StatLabel color="gray.400">Total Value</StatLabel>
            <StatNumber color="white" fontSize="2xl">{totalValue}</StatNumber>
            <StatHelpText><StatArrow type="increase" />3.24% (24h)</StatHelpText>
          </Stat>
          <Stat p={4} bg="gray.800" borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
            <StatLabel color="gray.400">Available Balance</StatLabel>
            <StatNumber color="white" fontSize="2xl">$8,940.12</StatNumber>
          </Stat>
          <Stat p={4} bg="gray.800" borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
            <StatLabel color="gray.400">In Orders</StatLabel>
            <StatNumber color="yellow.400" fontSize="2xl">$184.11</StatNumber>
          </Stat>
          <Stat p={4} bg="gray.800" borderRadius="lg" borderWidth="1px" borderColor={borderColor}>
            <StatLabel color="gray.400">PnL (30d)</StatLabel>
            <StatNumber color="green.400" fontSize="2xl">+$412.50</StatNumber>
            <StatHelpText><StatArrow type="increase" />4.73%</StatHelpText>
          </Stat>
        </SimpleGrid>

        {/* Asset Allocation */}
        <Box bg="gray.800" borderRadius="lg" borderWidth="1px" borderColor={borderColor} p={4} mb={6}>
          <Heading size="sm" color="white" mb={4}>Asset Allocation</Heading>
          <VStack spacing={3} align="stretch">
            {[
              { token: 'USDT', pct: 59.4, color: 'green' },
              { token: 'ETH', pct: 39.0, color: 'blue' },
              { token: '3AI', pct: 1.2, color: 'purple' },
              { token: 'W3AI', pct: 0.4, color: 'cyan' },
            ].map((a) => (
              <HStack key={a.token} spacing={3}>
                <Text w="50px" fontSize="sm" color="gray.300">{a.token}</Text>
                <Progress value={a.pct} size="sm" flex={1} colorScheme={a.color} borderRadius="full" bg="gray.700" />
                <Text w="50px" fontSize="sm" color="gray.400" textAlign="right">{a.pct}%</Text>
              </HStack>
            ))}
          </VStack>
        </Box>

        {/* Token Balances */}
        <Box bg="gray.800" borderRadius="lg" borderWidth="1px" borderColor={borderColor} overflow="hidden" mb={6}>
          <Table variant="simple" size="sm">
            <Thead bg="gray.900">
              <Tr>
                <Th color="gray.400">Token</Th>
                <Th color="gray.400" isNumeric>Balance</Th>
                <Th color="gray.400" isNumeric>Value</Th>
                <Th color="gray.400" isNumeric>24h Change</Th>
              </Tr>
            </Thead>
            <Tbody>
              {MOCK_BALANCES.map((b) => (
                <Tr key={b.token} _hover={{ bg: 'gray.700' }}>
                  <Td fontWeight="bold" color="white">{b.token}</Td>
                  <Td isNumeric fontFamily="mono" color="white">{b.balance}</Td>
                  <Td isNumeric fontFamily="mono" color="gray.300">{b.value}</Td>
                  <Td isNumeric color={b.change >= 0 ? 'green.400' : b.change < 0 ? 'red.400' : 'gray.400'}>
                    {b.change > 0 ? '+' : ''}{b.change.toFixed(2)}%
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        {/* Recent History */}
        <Box bg="gray.800" borderRadius="lg" borderWidth="1px" borderColor={borderColor} overflow="hidden">
          <Heading size="sm" color="white" p={4} pb={2}>Recent Activity</Heading>
          <Table variant="simple" size="sm">
            <Thead bg="gray.900">
              <Tr>
                <Th color="gray.400">Time</Th>
                <Th color="gray.400">Pair</Th>
                <Th color="gray.400">Side</Th>
                <Th color="gray.400" isNumeric>Amount</Th>
                <Th color="gray.400" isNumeric>Price</Th>
                <Th color="gray.400" isNumeric>Total</Th>
                <Th color="gray.400">Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {MOCK_HISTORY.map((h, i) => (
                <Tr key={i} _hover={{ bg: 'gray.700' }}>
                  <Td fontSize="xs" color="gray.400">{h.time}</Td>
                  <Td color="white" fontWeight="medium">{h.pair}</Td>
                  <Td><Badge colorScheme={h.side === 'BUY' ? 'green' : 'red'} fontSize="xs">{h.side}</Badge></Td>
                  <Td isNumeric fontFamily="mono" color="white">{h.amount}</Td>
                  <Td isNumeric fontFamily="mono" color="gray.300">{h.price}</Td>
                  <Td isNumeric fontFamily="mono" color="gray.300">${h.total}</Td>
                  <Td><Badge colorScheme="blue" fontSize="xs">{h.status}</Badge></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Container>
    </MainLayout>
  );
};

export default PortfolioPage;
