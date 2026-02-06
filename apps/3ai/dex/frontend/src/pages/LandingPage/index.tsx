import React from 'react';
import { 
  Box, 
  Button, 
  Container, 
  Flex, 
  Heading, 
  Text, 
  VStack, 
  Image, 
  HStack, 
  SimpleGrid,
  useColorModeValue,
  Link,
  useBreakpointValue
} from '@chakra-frontend/frontend/ui/react';
import { keyframes } from '@emotion/react';
import { FaRocket, FaChartLine, FaLock, FaExchangeAlt, FaRobot } from 'react-icons/fa';
import { Link as RouterLink } from 'react-router-dom';
import { VideoBackground } from '../../components/common/VideoBackground';
import Scene from '../../components/3d/Scene';
import Character from '../../components/3d/Character';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
`;

const FeatureCard = ({ icon, title, description }) => (
  <Box
    p={6}
    bg={useColorModeValue('white', 'gray.800')}
    borderRadius="lg"
    boxShadow="lg"
    _hover={{ transform: 'translateY(-5px)', transition: 'all 0.3s' }}
  >
    <Box color="blue.400" fontSize="2xl" mb={4}>
      {icon}
    </Box>
    <Heading size="md" mb={2}>{title}</Heading>
    <Text color={useColorModeValue('gray.600', 'gray.300')}>{description}</Text>
  </Box>
);

const LandingPage = () => {
  const bgGradient = useColorModeValue(
    'linear(to-r, blue.500, purple.600)',
    'linear(to-r, blue.600, purple.700)'
  );

  const buttonHover = {
    transform: 'translateY(-2px)',
    boxShadow: 'lg',
  };

  return (
    <Box>
      {/* Hero Section */}
      <Box 
        bgGradient={bgGradient} 
        color="white" 
        py={20}
        position="relative"
        overflow="hidden"
        minH="100vh"
        display="flex"
        alignItems="center"
      >
        {/* Video Background */}
        <VideoBackground 
          videoSrc="/assets/videos/background.mp4"
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={0}
        />
        {/* Overlay */}
        <Box 
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bgGradient="linear(to-r, blue.500, purple.600, 60%, transparent)"
          zIndex={1}
        />
        <Container maxW="container.xl">
          <Flex direction={{ base: 'column', md: 'row' }} alignItems="center" position="relative" zIndex={2}>
            <Box flex={1} mb={{ base: 10, md: 0 }}>
              <Text 
                fontWeight="bold" 
                mb={2}
                bg="rgba(255,255,255,0.2)" 
                display="inline-block" 
                px={3} 
                py={1} 
                rounded="full"
                fontSize="sm"
              >
                DECENTRALIZED EXCHANGE
              </Text>
              <Heading 
                as="h1" 
                size="2xl" 
                mb={6}
                lineHeight="1.2"
                animation={`${fadeIn} 0.8s ease-out`}
              >
                Trade on the 3ai Network with <br />
                <Box as="span" color="yellow.300">Lightning Speed</Box>
              </Heading>
              <Text fontSize="xl" mb={8} maxW="2xl" opacity={0.9}>
                Experience the future of decentralized trading with 3aiXchange. 
                Fast, secure, and bfrontend/uilt on the 3ai blockchain.
              </Text>
              <HStack spacing={4}>
                <Button 
                  as={RouterLink}
                  to="/trade"
                  size="lg" 
                  colorScheme="yellow" 
                  rightIcon={<FaRocket />}
                  _hover={buttonHover}
                >
                  Launch App
                </Button>
                <Button 
                  as={RouterLink}
                  to="/abby"
                  size="lg" 
                  variant="outline" 
                  color="white"
                  rightIcon={<FaRobot />}
                  _hover={buttonHover}
                >
                  Meet ABBY
                </Button>
                <Button 
                  as="a"
                  href="#features"
                  size="lg" 
                  variant="ghost" 
                  color="white"
                  _hover={buttonHover}
                >
                  Learn More
                </Button>
              </HStack>
            </Box>
            <Box 
              flex={1} 
              display={{ base: 'none', lg: 'block' }}
              position="relative"
              height="500px"
            >
              <Box
                position="absolute"
                right="0"
                top="50%"
                transform="translateY(-50%)"
                width="400px"
                height="400px"
                animation={`${float} 6s ease-in-out infinite`}
              >
                <Scene cameraPosition={[0, 0, 5]} autoRotate>
                  <Character scale={0.8} position={[0, -1, 0]} />
                </Scene>
              </Box>
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* Features Section */}
      <Box py={20} id="features">
        <Container maxW="container.xl">
          <VStack spacing={2} textAlign="center" mb={16}>
            <Text color="blue.500" fontWeight="bold">WHY CHOOSE 3AIXCHANGE</Text>
            <Heading as="h2" size="xl">Bfrontend/uilt for the Future of Trading</Heading>
            <Text color={useColorModeValue('gray.600', 'gray.400')} maxW="2xl">
              Experience the next generation of decentralized trading with our powerful features
            </Text>
          </VStack>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={8}>
            <FeatureCard
              icon={<FaExchangeAlt />}
              title="Instant Swaps"
              description="Trade assets instantly with our lightning-fast matching engine"
            />
            <FeatureCard
              icon={<FaLock />}
              title="Secure"
              description="Your funds are always in your control with non-custodial trading"
            />
            <FeatureCard
              icon={<FaChartLine />}
              title="Advanced Charts"
              description="Powerful trading tools and real-time market data"
            />
            <FeatureCard
              icon={<FaRobot />}
              title="AI Assistant"
              description="Get trading insights and assistance from ABBY, your AI trading companion"
            />
            <FeatureCard
              icon={<FaRocket />}
              title="Low Fees"
              description="Competitive trading fees with discounts for 3AI token holders"
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box bg={useColorModeValue('gray.50', 'gray.900')} py={20}>
        <Container maxW="container.lg" textAlign="center">
          <Heading as="h2" size="xl" mb={6}>
            Ready to Start Trading?
          </Heading>
          <Text fontSize="xl" mb={8} maxW="2xl" mx="auto" color={useColorModeValue('gray.600', 'gray.300')}>
            Join thousands of traders on 3aiXchange and experience the future of decentralized finance.
          </Text>
          <Button 
            as={RouterLink}
            to="/trade"
            size="lg" 
            colorScheme="blue" 
            rightIcon={<FaRocket />}
            _hover={buttonHover}
            px={8}
          >
            Launch App
          </Button>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;
