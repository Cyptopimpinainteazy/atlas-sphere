import { Box, Flex, Text, Link, useColorModeValue } from '@chakra-ui/react';

export const Footer = () => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box
      as="footer"
      bg={bgColor}
      borderTopWidth="1px"
      borderColor={borderColor}
      py={4}
    >
      <Flex
        direction={{ base: 'column', md: 'row' }}
        align="center"
        justify="space-between"
        maxW="container.xl"
        mx="auto"
        px={4}
      >
        <Text color={textColor} fontSize="sm" mb={{ base: 2, md: 0 }}>
          © {new Date().getFullYear()} 3aiXchange. All rights reserved.
        </Text>
        
        <Flex gap={4}>
          <Link href="/terms" color={textColor} fontSize="sm" _hover={{ textDecoration: 'underline' }}>
            Terms of Service
          </Link>
          <Link href="/privacy" color={textColor} fontSize="sm" _hover={{ textDecoration: 'underline' }}>
            Privacy Policy
          </Link>
          <Link 
            href="https://github.com/your-org/3ai-dex" 
            isExternal
            color={textColor} 
            fontSize="sm" 
            _hover={{ textDecoration: 'underline' }}
          >
            GitHub
          </Link>
        </Flex>
      </Flex>
    </Box>
  );
};
