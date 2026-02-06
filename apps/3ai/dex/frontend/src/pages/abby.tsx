import React from 'react';
import { Box, Container, Heading, Text, VStack } from '@chakra-frontend/frontend/ui/react';
import AbbyContainer from '../components/abby/AbbyContainer';

const AbbyPage: React.FC = () => {
  return (
    <Box minH="100vh" bgGradient="linear(to-br, gray.900, purple.900)" py={12}>
      <Container maxW="container.xl">
        <VStack spacing={8} align="stretch">
          <Box textAlign="center" color="white">
            <Heading as="h1" size="2xl" mb={4}>
              Meet ABBY
            </Heading>
            <Text fontSize="xl" opacity={0.8}>
              Your AI assistant for the 3aiXchange DEX
            </Text>
          </Box>
          
          <Box 
            bg="white" 
            borderRadius="xl" 
            overflow="hidden"
            boxShadow="2xl"
            height="calc(100vh - 200px)"
            minH="600px"
          >
            <AbbyContainer />
          </Box>
          
          <Box textAlign="center" color="white" mt={8}>
            <Text fontSize="sm" opacity={0.7}>
              ABBY is an AI assistant that helps you navigate the 3aiXchange DEX.
              Ask about token prices, trading pairs, or get help with your transactions.
            </Text>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};

export default AbbyPage;
