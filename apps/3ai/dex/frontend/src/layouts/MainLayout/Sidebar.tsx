import { Box, VStack, Link, Icon, Text, useColorModeValue } from '@chakra-frontend/frontend/ui/react';
import { NavLink as RouterLink, useLocation } from 'react-router-dom';
import { FiHome, FiTrendingUp, FiDollarSign, FiPieChart, FiSettings } from 'react-icons/fi';

const navItems = [
  { icon: FiHome, label: 'Dashboard', to: '/' },
  { icon: FiTrendingUp, label: 'Markets', to: '/markets' },
  { icon: FiDollarSign, label: 'Trade', to: '/trade' },
  { icon: FiPieChart, label: 'Portfolio', to: '/portfolio' },
  { icon: FiSettings, label: 'Settings', to: '/settings' },
];

export const Sidebar = () => {
  const location = useLocation();
  const bgColor = useColorModeValue('white', 'gray.800');
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const activeColor = useColorModeValue('blue.600', 'blue.300');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      as="aside"
      position="fixed"
      left={0}
      top="60px"
      bottom={0}
      w="240px"
      bg={bgColor}
      borderRightWidth="1px"
      borderColor={borderColor}
      display={{ base: 'none', md: 'block' }}
      overflowY="auto"
    >
      <VStack spacing={1} p={2} align="stretch">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              as={RouterLink}
              to={item.to}
              display="flex"
              alignItems="center"
              p={3}
              borderRadius="md"
              bg={isActive ? activeBg : 'transparent'}
              color={isActive ? activeColor : 'inherit'}
              _hover={{
                textDecoration: 'none',
                bg: isActive ? activeBg : hoverBg,
              }}
              fontWeight={isActive ? 'semibold' : 'normal'}
            >
              <Icon as={item.icon} mr={3} fontSize="xl" />
              <Text>{item.label}</Text>
            </Link>
          );
        })}
      </VStack>
    </Box>
  );
};
