import { Box, Flex, useColorModeValue } from '@chakra-frontend/frontend/ui/react';
import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Flex direction="column" minH="100vh" bg={bgColor}>
      <Header />
      
      <Flex flex="1" pt="60px">
        <Sidebar />
        
        <Box 
          as="main" 
          flex="1" 
          p={4} 
          ml={{ base: 0, md: '240px' }}
          borderLeftWidth="1px"
          borderColor={borderColor}
        >
          {children}
        </Box>
      </Flex>
      
      <Footer />
    </Flex>
  );
};
