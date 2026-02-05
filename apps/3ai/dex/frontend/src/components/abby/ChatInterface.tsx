import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  Box, 
  Input, 
  VStack, 
  HStack, 
  Text, 
  Avatar,
  Flex,
  IconButton,
  useColorModeValue
} from '@chakra-ui/react';
import { FaPaperPlane, FaRobot } from 'react-icons/fa';
import { ABBY_CONFIG } from '../../config/constants';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'abby';
  timestamp: Date;
}

interface ChatInterfaceProps {
  onSendMessage?: (message: string) => Promise<void>;
}

export interface ChatInterfaceRef {
  sendMessage: (text: string) => void;
}

const ChatInterface = forwardRef<ChatInterfaceRef, ChatInterfaceProps>(({ onSendMessage }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const inputBg = useColorModeValue('white', 'gray.700');

  // Initial greeting from ABBY
  useEffect(() => {
    setMessages([{
      id: '1',
      text: "Hi there! I'm ABBY, your 3aiXchange assistant. How can I help you with your trades today?",
      sender: 'abby',
      timestamp: new Date()
    }]);
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const messageText = inputValue.trim();
    if (!messageText) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // If onSendMessage is provided, use it
      if (onSendMessage) {
        await onSendMessage(messageText);
      } else {
        // Fallback to default API call
        const response = await fetch('/api/abby/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: messageText }),
        });
        
        if (!response.ok) throw new Error('Failed to get response');
        
        const data = await response.json();
        
        // Add ABBY's response
        const abbyMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.text,
          sender: 'abby',
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, abbyMessage]);
      }
    } catch (error) {
      console.error('Error:', error);
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I'm having trouble connecting to the server. Please try again later.",
        sender: 'abby',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    sendMessage: (text: string) => {
      if (text.trim()) {
        setInputValue(text);
        handleSendMessage({ preventDefault: () => {} } as React.FormEvent);
      }
    }
  }));

  return (
    <Flex 
      direction="column" 
      h="100%"
      bg={bgColor}
      borderRadius="lg"
      boxShadow="md"
      overflow="hidden"
    >
      {/* Chat header */}
      <Box 
        p={3} 
        borderBottom="1px" 
        borderColor={borderColor}
        bgGradient="linear(to-r, blue.500, purple.600)"
        color="white"
      >
        <HStack spacing={3}>
          <Avatar 
            size="sm" 
            icon={<FaRobot />} 
            bg="blue.400"
          />
          <Text fontWeight="bold">ABBY Assistant</Text>
        </HStack>
      </Box>
      
      {/* Messages */}
      <Box 
        flex={1} 
        p={4} 
        overflowY="auto"
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#888',
            borderRadius: '2px',
          },
        }}
      >
        <VStack spacing={4} align="stretch">
          {messages.map((message) => (
            <Box
              key={message.id}
              alignSelf={message.sender === 'user' ? 'flex-end' : 'flex-start'}
              maxW="80%"
            >
              <Box
                p={3}
                borderRadius="lg"
                bg={message.sender === 'user' ? 'blue.500' : 'gray.200'}
                color={message.sender === 'user' ? 'white' : 'gray.800'}
                boxShadow="sm"
              >
                <Text>{message.text}</Text>
                <Text 
                  fontSize="xs" 
                  mt={1}
                  textAlign="right"
                  opacity={0.7}
                  color={message.sender === 'user' ? 'whiteAlpha.800' : 'gray.500'}
                >
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Box>
            </Box>
          ))}
          {isLoading && (
            <Box alignSelf="flex-start" maxW="80%" p={3}>
              <Box
                p={3}
                borderRadius="lg"
                bg="gray.200"
                color="gray.800"
                boxShadow="sm"
              >
                <Text>Thinking...</Text>
              </Box>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </VStack>
      </Box>
      
      {/* Input area */}
      <Box p={3} borderTop="1px" borderColor={borderColor}>
        <form onSubmit={handleSendMessage}>
          <HStack>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              bg={inputBg}
              borderColor={borderColor}
              _hover={{ borderColor: 'blue.300' }}
              _focus={{
                borderColor: 'blue.500',
                boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
              }}
              disabled={isLoading}
            />
            <IconButton
              type="submit"
              colorScheme="blue"
              aria-label="Send message"
              icon={<FaPaperPlane />}
              isLoading={isLoading}
              isDisabled={!inputValue.trim()}
            />
          </HStack>
        </form>
      </Box>
    </Flex>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;
