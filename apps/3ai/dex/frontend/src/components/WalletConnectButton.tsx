import { Button, Text, useDisclosure } from '@chakra-ui/react';
import type { ButtonProps } from '@chakra-ui/react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { shortenAddress } from '../utils/address';
import { WalletModal } from './WalletModal';

export const WalletConnectButton = (props: ButtonProps) => {
  const { isConnected, address } = useAccount();
  const { connect, connectors, isLoading } = useConnect();
  const { disconnect } = useDisconnect();
  const { isOpen, onOpen, onClose } = useDisclosure();

  if (isConnected && address) {
    return (
      <Button
        onClick={() => disconnect()}
        colorScheme="blue"
        variant="outline"
        {...props}
      >
        <Text fontFamily="mono" fontSize="sm">
          {shortenAddress(address)}
        </Text>
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={onOpen}
        colorScheme="blue"
        isLoading={isLoading}
        loadingText="Connecting..."
        {...props}
      >
        Connect Wallet
      </Button>
      
      <WalletModal isOpen={isOpen} onClose={onClose} />
    </>
  );
};
