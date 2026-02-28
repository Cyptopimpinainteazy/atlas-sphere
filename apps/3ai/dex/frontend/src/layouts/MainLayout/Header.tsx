import { Box, Flex, IconButton, useColorMode, useColorModeValue, Image } from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { useState } from 'react';

export const Header = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box 
      as="header" 
      position="fixed" 
      top={0} 
      left={0} 
      right={0} 
      zIndex={10}
      bg={bgColor}
      borderBottomWidth="1px"
      borderColor={borderColor}
      px={4}
      h="60px"
    >
      <Flex h="100%" align="center" justify="space-between">
        <Flex align="center">
          <Image
            src="/logo.svg"
            alt="3aiXchange"
            h="32px"
            mr={2}
          />
          <Box fontWeight="bold" fontSize="xl">3aiXchange</Box>
        </Flex>
        
        <Flex align="center">
          <IconButton
            aria-label="Toggle color mode"
            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={toggleColorMode}
            variant="ghost"
            mr={2}
          />

          {/* Network selector — persists x3_active_network and reloads to pick up endpoints */}
          <select
            defaultValue={typeof window !== 'undefined' ? (window.localStorage.getItem('x3_active_network') || (process.env.NODE_ENV === 'development' ? 'local' : 'testnet')) : 'testnet'}
            onChange={(e) => { if (typeof window !== 'undefined') { window.localStorage.setItem('x3_active_network', e.target.value); window.location.reload(); } }}
            className="mr-3 px-2 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700"
            title="Select network"
          >
            <option value="local">Local</option>
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>

          <WalletConnectButton />
        </Flex>
      </Flex>
    </Box>
  );
};
