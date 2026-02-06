import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ChakraProvider, Box } from '@chakra-frontend/frontend/ui/react';
import { Web3Provider } from './providers/Web3Provider';
import { MainLayout } from './layouts/MainLayout';
import LandingPage from './pages/LandingPage';
import AbbyPage from './pages/abby';
import theme from './theme';

// Main App Component
const App = () => {
  return (
    <ChakraProvider theme={theme}>
      <Web3Provider>
        <Box minH="100vh" bg={theme.styles.global.body.bg}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route 
              path="/trade/*" 
              element={
                <MainLayout>
                  <Box>Trade Interface Coming Soon</Box>
                </MainLayout>
              } 
            />
            <Route path="/abby" element={<AbbyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
      </Web3Provider>
    </ChakraProvider>
  );
};

export default App;
