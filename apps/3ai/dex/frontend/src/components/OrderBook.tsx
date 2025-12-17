import React, { useEffect } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { Box, Table, Thead, Tbody, Tr, Th, Td, Text, VStack, HStack } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

type OrderBookData = {
  bids: [number, number][];
  asks: [number, number][];
  lastPrice: number;
  priceChange: number;
};

const API_URL = import.meta.env.VITE_API_URL;

export const OrderBook: React.FC = () => {
  const { active, account, globalState } = useWeb3();
  const pair = globalState.markets[0]?.symbol || '3AI/ETH';
  
  const { data: orderBook, isLoading } = useQuery({
    queryKey: ['orderbook', pair],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/orderbook?pair=${pair}`);
      return response.data as OrderBookData;
    },
    refetchInterval: 5000,
    enabled: active && !!account,
  });

  if (!active) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="lg" bg="gray.800" color="white">
        <Text>Please connect your wallet to view the order book.</Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="lg" bg="gray.800" color="white">
        <Text>Loading order book...</Text>
      </Box>
    );
  }

  const formatNumber = (num: number, decimals: number = 4) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <VStack spacing={4} align="stretch">
      <Box p={4} borderWidth="1px" borderRadius="lg" bg="gray.800" color="white">
        <HStack justify="space-between" mb={4}>
          <Text fontSize="xl" fontWeight="bold">Order Book</Text>
          <Text>
            {pair} • ${orderBook?.lastPrice?.toFixed(4) || '0.00'}{' '}
            <Text as="span" color={orderBook?.priceChange >= 0 ? 'green.400' : 'red.400'}>
              {orderBook?.priceChange >= 0 ? '↑' : '↓'} {Math.abs(orderBook?.priceChange || 0).toFixed(2)}%
            </Text>
          </Text>
        </HStack>
        
        <Box display="grid" gridTemplateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
          <Box>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th color="white" px={2} py={1}>Price</Th>
                  <Th color="white" px={2} py={1} isNumeric>Amount</Th>
                  <Th color="white" px={2} py={1} isNumeric>Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orderBook?.bids.slice(0, 8).map(([price, amount], i) => (
                  <Tr key={`bid-${i}`} _hover={{ bg: 'green.900' }}>
                    <Td px={2} py={1} color="green.400">{formatNumber(price)}</Td>
                    <Td px={2} py={1} isNumeric>{formatNumber(amount)}</Td>
                    <Td px={2} py={1} isNumeric>{formatNumber(price * amount)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
          
          <Box>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th color="white" px={2} py={1}>Price</Th>
                  <Th color="white" px={2} py={1} isNumeric>Amount</Th>
                  <Th color="white" px={2} py={1} isNumeric>Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orderBook?.asks.slice(0, 8).map(([price, amount], i) => (
                  <Tr key={`ask-${i}`} _hover={{ bg: 'red.900' }}>
                    <Td px={2} py={1} color="red.400">{formatNumber(price)}</Td>
                    <Td px={2} py={1} isNumeric>{formatNumber(amount)}</Td>
                    <Td px={2} py={1} isNumeric>{formatNumber(price * amount)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      </Box>
    </VStack>
  );
};
