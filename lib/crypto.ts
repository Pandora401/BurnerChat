import CryptoJS from 'crypto-js';

/**
 * Enhanced E2EE helper using AES-256 for chat messages.
 * This version focus on simplicity and security for local P2P.
 */
export const E2EE = {
    /**
     * Derives a key from a password and salt using PBKDF2.
     * This ensures that even weak passwords are hardened.
     */
    deriveKey: (password: string, salt: string) => {
        return CryptoJS.PBKDF2(password, salt, {
            keySize: 256 / 32,
            iterations: 1000,
        }).toString();
    },

    /**
     * Encrypts a message using a derived key.
     */
    encrypt: (message: string, key: string) => {
        return CryptoJS.AES.encrypt(message, key).toString();
    },

    /**
     * Decrypts a message using a derived key.
     */
    decrypt: (encryptedMessage: string, key: string) => {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            return originalText;
        } catch (e) {
            console.error('Decryption failed', e);
            return null;
        }
    },

    /**
     * Generates a random salt or room ID.
     */
    generateId: (length: number = 10) => {
        return Math.random().toString(36).substring(2, 2 + length);
    }
};
