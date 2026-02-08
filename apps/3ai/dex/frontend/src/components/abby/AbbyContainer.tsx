import React, { useState, useRef, useCallback } from 'react';
import { Box, useBreakpointValue } from '@chakra-ui/react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import Character from '../3d/Character';
import ChatInterface, { ChatInterfaceRef } from './ChatInterface';
import { ABBY_CONFIG } from '../../config/constants';

const AbbyContainer: React.FC = () => {
  const [isTalking, setIsTalking] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState<keyof typeof ABBY_CONFIG.ANIMATIONS>('IDLE');
  const chatInterfaceRef = useRef<ChatInterfaceRef>(null);
  
  // Responsive layout
  const isMobile = useBreakpointValue({ base: true, md: false });
  const containerHeight = isMobile ? '70vh' : '80vh';
  const canvasHeight = isMobile ? '50%' : '100%';
  const chatHeight = isMobile ? '50%' : '100%';

  // Handle messages from chat
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;
    
    // Set talking animation
    setIsTalking(true);
    setCurrentAnimation('TALKING');
    
    try {
      // Process the message (this is where you'd integrate with your AI service)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Add a response from ABBY
      const response = `I received your message: "${message}". This is a simulated response.`;
      
      // If you want to show the response in the chat
      if (chatInterfaceRef.current) {
        chatInterfaceRef.current.sendMessage(response);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    } finally {
      // Reset to idle animation
      setTimeout(() => {
        setIsTalking(false);
        setCurrentAnimation('IDLE');
      }, 1000);
    }
  }, []);

  return (
    <Box 
      position="relative" 
      w="100%" 
      h={containerHeight}
      maxW="1200px"
      mx="auto"
      borderRadius="lg"
      overflow="hidden"
      boxShadow="xl"
      display="flex"
      flexDirection={isMobile ? 'column' : 'row'}
    >
      {/* 3D Character Canvas */}
      <Box 
        position="relative" 
        w={isMobile ? '100%' : '60%'} 
        h={canvasHeight}
        bgGradient="linear(to-br, blue.900, purple.900)"
      >
        <Canvas 
          shadows 
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ width: '100%', height: '100%' }}
        >
          <ambientLight intensity={0.5} />
          <spotLight 
            position={[10, 10, 10]} 
            angle={0.15} 
            penumbra={1} 
            intensity={1} 
            castShadow 
          />
          <pointLight position={[-10, -10, -10]} />
          
          <Character 
            animation={currentAnimation}
            isTalking={isTalking}
            position={ABBY_CONFIG.POSITION as [number, number, number]}
            scale={ABBY_CONFIG.SCALE}
          />
          
          <Environment preset="city" />
          <OrbitControls 
            enableZoom={false} 
            enablePan={false} 
            autoRotate 
            autoRotateSpeed={0.5} 
          />
        </Canvas>
      </Box>
      
      {/* Chat Interface */}
      <Box 
        w={isMobile ? '100%' : '40%'} 
        h={chatHeight}
        bg="white"
        borderLeftWidth={isMobile ? 0 : '1px'}
        borderTopWidth={isMobile ? '1px' : 0}
        borderColor="gray.200"
      >
        <ChatInterface 
          ref={chatInterfaceRef}
          onSendMessage={handleSendMessage}
        />
      </Box>
    </Box>
  );
};

export default AbbyContainer;
