import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import LandingPage from './pages/LandingPage';
import TradePage from './pages/TradePage';
import MarketsPage from './pages/MarketsPage';
import PortfolioPage from './pages/PortfolioPage';
import AbbyPage from './pages/abby';

// Main App Component
const App = () => {
  return (
    <Box minH="100vh" bg="gray.900">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/trade" element={<TradePage />} />
        <Route path="/markets" element={<MarketsPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/abby" element={<AbbyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Box>
  );
};

export default App;
