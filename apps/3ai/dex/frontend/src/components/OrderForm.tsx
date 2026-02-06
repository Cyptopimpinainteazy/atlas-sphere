import React, { useState } from 'react';
import { Box, Button, FormControl, FormLabel, Input, Select, VStack, HStack, Text, useToast } from '@chakra-frontend/frontend/ui/react';
import { useWeb3 } from '../contexts/Web3Context';
import axios from 'axios';
import { API_URL } from '../config';

type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'MARKET', label: 'Market' },
  { value: 'LIMIT', label: 'Limit' },
  { value: 'STOP_LOSS', label: 'Stop Loss' },
  { value: 'TAKE_PROFIT', label: 'Take Profit' },
];

const TRADING_PAIRS = [
  { base: '3AI', quote: 'ETH' },
  { base: '3AI', quote: 'USDC' },
  { base: 'ETH', quote: 'USDC' },
];

export const OrderForm: React.FC = () => {
  const { active, account, library } = useWeb3();
  const toast = useToast();
  
  const [isBuy, setIsBuy] = useState(true);
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [pair, setPair] = useState('3AI/ETH');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!active || !account) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to place an order',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    if (!price && orderType !== 'MARKET') {
      toast({
        title: 'Price reqfrontend/uired',
        description: 'Please enter a price for limit orders',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    if (!amount) {
      toast({
        title: 'Amount reqfrontend/uired',
        description: 'Please enter an amount',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // In a real app, you would sign the transaction with the user's wallet
      // For this example, we'll just simulate an API call
      const response = await axios.post(`${API_URL}/orders`, {
        type: orderType,
        side: isBuy ? 'BUY' : 'SELL',
        pair,
        price: orderType === 'MARKET' ? undefined : parseFloat(price),
        amount: parseFloat(amount),
        // In a real app, you would include a signature from the user's wallet
      });

      toast({
        title: 'Order placed',
        description: `Successfully placed ${isBuy ? 'buy' : 'sell'} order`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Reset form
      setPrice('');
      setAmount('');
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: 'Error',
        description: 'Failed to place order. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box p={4} borderWidth="1px" borderRadius="lg" bg="gray.800" color="white">
      <HStack spacing={4} mb={4}>
        <Button
          flex={1}
          colorScheme={isBuy ? 'green' : 'gray'}
          onClick={() => setIsBuy(true)}
          variant={isBuy ? 'solid' : 'outline'}
        >
          Buy
        </Button>
        <Button
          flex={1}
          colorScheme={!isBuy ? 'red' : 'gray'}
          onClick={() => setIsBuy(false)}
          variant={!isBuy ? 'solid' : 'outline'}
        >
          Sell
        </Button>
      </HStack>

      <form onSubmit={handleSubmit}>
        <VStack spacing={4}>
          <FormControl>
            <FormLabel>Order Type</FormLabel>
            <Select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as OrderType)}
              bg="gray.700"
              borderColor="gray.600"
              color="white"
            >
              {ORDER_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel>Pair</FormLabel>
            <Select
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              bg="gray.700"
              borderColor="gray.600"
              color="white"
            >
              {TRADING_PAIRS.map(({ base, quote }) => (
                <option key={`${base}/${quote}`} value={`${base}/${quote}`}>
                  {base}/{quote}
                </option>
              ))}
            </Select>
          </FormControl>

          {orderType !== 'MARKET' && (
            <FormControl>
              <FormLabel>Price</FormLabel>
              <Input
                type="number"
                step="0.00000001"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                bg="gray.700"
                borderColor="gray.600"
                color="white"
              />
            </FormControl>
          )}

          <FormControl>
            <FormLabel>Amount</FormLabel>
            <Input
              type="number"
              step="0.00000001"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              bg="gray.700"
              borderColor="gray.600"
              color="white"
            />
          </FormControl>

          <Button
            type="submit"
            colorScheme={isBuy ? 'green' : 'red'}
            width="100%"
            isLoading={isSubmitting}
            loadingText="Placing Order..."
            isDisabled={!active}
          >
            {isBuy ? 'Buy' : 'Sell'} {pair.split('/')[0]}
          </Button>

          {!active && (
            <Text color="yellow.400" fontSize="sm" textAlign="center">
              Please connect your wallet to trade
            </Text>
          )}
        </VStack>
      </form>
    </Box>
  );
};
