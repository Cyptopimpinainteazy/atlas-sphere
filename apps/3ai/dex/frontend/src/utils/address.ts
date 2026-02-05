/**
 * Shortens an Ethereum address for display
 * @param address The full Ethereum address
 * @param chars Number of characters to show at the start and end
 * @returns Formatted address (e.g., 0x1234...5678)
 */
export const shortenAddress = (address: string, chars = 4): string => {
  if (!address) return '';
  return `${address.substring(0, chars + 2)}...${address.substring(42 - chars)}`;
};

/**
 * Validates if a string is a valid Ethereum address
 * @param address The address to validate
 * @returns boolean indicating if the address is valid
 */
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Converts an address to checksum address
 * @param address The address to convert
 * @returns Checksum address
 */
export const toChecksumAddress = (address: string): string => {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  
  // If it's already in checksum format, return as is
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    return address;
  }
  
  // Convert to checksum format
  const addressWithoutPrefix = address.toLowerCase().substring(2);
  const hash = require('crypto').createHash('sha256').update(addressWithoutPrefix).digest('hex');
  
  let checksumAddress = '0x';
  
  for (let i = 0; i < addressWithoutPrefix.length; i++) {
    const char = addressWithoutPrefix[i];
    const hashChar = hash[i];
    
    if (parseInt(hashChar, 16) >= 8) {
      checksumAddress += char.toUpperCase();
    } else {
      checksumAddress += char;
    }
  }
  
  return checksumAddress;
};
