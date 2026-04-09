/**
 * Validates Ethereum/EVM wallet addresses using EIP-55 checksum format
 */

import crypto from "crypto";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SOL_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Validates EIP-55 checksum for Ethereum addresses
 */
function isChecksumValid(address: string): boolean {
  const addressLower = address.toLowerCase().replace("0x", "");
  const hash = crypto.createHash("keccak256").update(addressLower).digest("hex");
  
  for (let i = 0; i < 40; i++) {
    const hashChar = hash[i];
    const addressChar = address[i];
    const lowerChar = addressLower[i];
    
    // If hash character is 8 or higher, the character should be uppercase
    if (parseInt(hashChar, 16) >= 8) {
      if (addressChar !== lowerChar.toUpperCase()) return false;
    } else {
      if (addressChar !== lowerChar) return false;
    }
  }
  
  return true;
}

/**
 * Checks if a string is a valid EVM address format
 */
export function isEVMAddress(address: string): boolean {
  if (!ETH_ADDRESS_REGEX.test(address)) return false;
  return isChecksumValid(address);
}

/**
 * Checks if a string is a valid Solana address format
 */
export function isSolanaAddress(address: string): boolean {
  return SOL_ADDRESS_REGEX.test(address);
}

/**
 * Validates a wallet address based on chain type
 */
export function isValidWalletAddress(address: string, chain: string): boolean {
  const sanitized = address.trim();

  if (!sanitized) return false;

  switch (chain.toLowerCase()) {
    case "solana":
      return isSolanaAddress(sanitized);
    case "ethereum":
    case "polygon":
    case "arbitrum":
    case "optimism":
    case "bsc":
    case "avalanche":
    case "fantom":
    default:
      return isEVMAddress(sanitized);
  }
}

/**
 * Sanitizes and validates a wallet address
 * Throws error if invalid
 */
export function validateWalletAddress(address: string, chain: string): string {
  const sanitized = address.trim();

  if (!sanitized) {
    throw new Error("Wallet address cannot be empty");
  }

  if (!isValidWalletAddress(sanitized, chain)) {
    throw new Error(`Invalid wallet address for chain ${chain}`);
  }

  return sanitized;
}

/**
 * Validates API key format (basic validation)
 */
export function validateApiKey(apiKey: string): string {
  const sanitized = apiKey.trim();

  if (!sanitized) {
    throw new Error("API key cannot be empty");
  }

  if (sanitized.length < 8 || sanitized.length > 256) {
    throw new Error("API key must be between 8 and 256 characters");
  }

  return sanitized;
}

/**
 * Validates secret key format (basic validation)
 */
export function validateSecretKey(secretKey: string): string {
  const sanitized = secretKey.trim();

  if (!sanitized) {
    throw new Error("Secret key cannot be empty");
  }

  if (sanitized.length < 16 || sanitized.length > 256) {
    throw new Error("Secret key must be between 16 and 256 characters");
  }

  return sanitized;
}
