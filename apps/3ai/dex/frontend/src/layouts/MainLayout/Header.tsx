import { Box, Flex, IconButton, useColorMode, useColorModeValue, Image } from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { WalletConnectButton } from '@/components/WalletConnectButton';

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
          <WalletConnectButton />
        </Flex>
      </Flex>
    </Box>
  );
};
