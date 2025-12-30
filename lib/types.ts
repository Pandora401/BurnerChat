export interface Message {
    id: string;
    sender: string;
    senderName: string;
    content: string;
    decryptedContent?: string;
    attachment?: {
        name: string;
        type: string;
        size: number;
        data: string; // Base64 encoded or encrypted data
    };
    timestamp: number;
}

export interface Room {
    id: string;
    name: string;
    hostId: string; // The peer ID of the current host
    hasPassword?: boolean;
}

export interface PeerMetadata {
    id: string;
    name: string;
    isHost: boolean;
}
