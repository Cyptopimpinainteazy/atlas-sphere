import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, VStack, Text, Box } from '@chakra-frontend/frontend/ui/react';
import { useConnect } from 'wagmi';
import { FaEthereum } from 'react-icons/fa';
import { SiWalletconnect } from 'react-icons/si';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal = ({ isOpen, onClose }: WalletModalProps) => {
  const { connect, isLoading } = useConnect();

  const handleConnect = (connector: any) => {
    connect({ connector });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Connect Wallet</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4}>
            <WalletOption
              icon={FaEthereum}
              name="MetaMask"
              onClick={() => handleConnect(new InjectedConnector({
                options: {
                  name: 'MetaMask',
                  shimDisconnect: true,
                },
              }))}
              isLoading={isLoading}
            />
            <WalletOption
              icon={SiWalletconnect}
              name="WalletConnect"
              onClick={() => handleConnect(new WalletConnectConnector({
                options: {
                  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID',
                  showQrModal: true,
                },
              }))}
              isLoading={isLoading}
            />
            {/* Add more wallet options as needed */}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

interface WalletOptionProps {
  icon: any;
  name: string;
  onClick: () => void;
  isLoading?: boolean;
}

const WalletOption = ({ icon: Icon, name, onClick, isLoading }: WalletOptionProps) => {
  return (
    <Box
      as="button"
      w="100%"
      p={4}
      borderWidth="1px"
      borderRadius="md"
      _hover={{
        bg: 'gray.50',
        _dark: {
          bg: 'gray.700',
        },
      }}
      onClick={onClick}
      disabled={isLoading}
      display="flex"
      alignItems="center"
      justifyContent="space-between"
    >
      <Box display="flex" alignItems="center">
        <Icon size={24} />
        <Text ml={3} fontWeight="medium">
          {name}
        </Text>
      </Box>
      {isLoading && (
        <Box
          as="span"
          w={4}
          h={4}
          borderWidth="2px"
          borderColor="blue.500"
          borderTopColor="transparent"
          borderRadius="full"
          display="inline-block"
          animation="spin 1s linear infinite"
          sx={{
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        />
      )}
    </Box>
  );
};
