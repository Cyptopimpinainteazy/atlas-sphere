import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
  Button,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { MainLayout } from '../../layouts/MainLayout';

const MARKETS = [
  { pair: '3AI/USDT', price: 0.000842, change: 2.45, volume: '1,245,600', high: 0.000856, low: 0.000831, status: 'TRADING' },
  { pair: '3AI/W3AI', price: 1.0012, change: 0.12, volume: '89,340', high: 1.0025, low: 0.9998, status: 'TRADING' },
  { pair: '3AI/ETH', price: 0.000028, change: -1.23, volume: '452,100', high: 0.000030, low: 0.000027, status: 'TRADING' },
  { pair: 'ETH/USDT', price: 2845.50, change: 1.87, volume: '12,500,000', high: 2890.00, low: 2810.00, status: 'TRADING' },
  { pair: 'BTC/USDT', price: 98450.00, change: 3.12, volume: '45,200,000', high: 99100.00, low: 95800.00, status: 'TRADING' },
];

const fmt = (n: number, d = 6) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d });

const MarketsPage = () => {
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <MainLayout>
      <Container maxW="container.xl" py={4}>
        <HStack justify="space-between" mb={6}>
          <Heading size="lg" color="white">Markets</Heading>
          <InputGroup maxW="300px" size="sm">
            <InputLeftElement><Box as={FiSearch} color="gray.400" /></InputLeftElement>
            <Input placeholder="Search markets..." bg="gray.700" borderColor="gray.600" color="white" />
          </InputGroup>
        </HStack>

        <Box borderWidth="1px" borderRadius="lg" borderColor={borderColor} bg="gray.800" overflow="hidden">
          <Table variant="simple" size="sm">
            <Thead bg="gray.900">
              <Tr>
                <Th color="gray.400">Pair</Th>
                <Th color="gray.400" isNumeric>Price</Th>
                <Th color="gray.400" isNumeric>24h Change</Th>
                <Th color="gray.400" isNumeric>24h Volume</Th>
                <Th color="gray.400" isNumeric>24h High</Th>
                <Th color="gray.400" isNumeric>24h Low</Th>
                <Th color="gray.400">Status</Th>
                <Th color="gray.400"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {MARKETS.map((m) => (
                <Tr key={m.pair} _hover={{ bg: 'gray.700' }}>
                  <Td fontWeight="bold" color="white">{m.pair}</Td>
                  <Td isNumeric fontFamily="mono" color="white">{fmt(m.price)}</Td>
                  <Td isNumeric color={m.change >= 0 ? 'green.400' : 'red.400'} fontFamily="mono">
                    {m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%
                  </Td>
                  <Td isNumeric color="gray.300">{m.volume}</Td>
                  <Td isNumeric fontFamily="mono" color="gray.300">{fmt(m.high)}</Td>
                  <Td isNumeric fontFamily="mono" color="gray.300">{fmt(m.low)}</Td>
                  <Td><Badge colorScheme="green" fontSize="xs">{m.status}</Badge></Td>
                  <Td>
                    <Button as={RouterLink} to="/trade" size="xs" colorScheme="blue" variant="outline">
                      Trade
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Container>
    </MainLayout>
  );
};

export default MarketsPage;
