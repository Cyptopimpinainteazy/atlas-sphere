import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { ChakraProvider, ColorModeScript, Box, Text } from '@chakra-ui/react';
import { Web3Provider } from './providers/Web3Provider';
import theme from './theme';
import App from './App';
import './index.css';

// Error Boundary Component
class ErrorBoundary extends React.Component<{children: React.ReactNode}> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by error boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={4} bg="red.900" color="white" minH="100vh">
          <Text fontSize="xl" fontWeight="bold" mb={4}>
            Something went wrong
          </Text>
          <Text as="pre" whiteSpace="pre-wrap">
            {this.state.error?.toString()}
          </Text>
        </Box>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <Web3Provider>
        <Router>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </Router>
      </Web3Provider>
    </ChakraProvider>
  </React.StrictMode>
);
