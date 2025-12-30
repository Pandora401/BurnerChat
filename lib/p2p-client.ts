import Peer from 'simple-peer';
import { E2EE } from './crypto';
import { PeerMetadata } from './types';

export interface P2PPeer {
    id: string;
    peer: Peer.Instance;
    connected: boolean;
    metadata: PeerMetadata;
}

export class P2PClient {
    public myId: string;
    private discoveryKey: string = '';
    private peers: Map<string, P2PPeer> = new Map();
    public onMessage: (msg: any) => void = () => { };
    private pOnPeersUpdate: (peers: PeerMetadata[]) => void;
    private interval: NodeJS.Timeout | null = null;
    private discoveryInterval: NodeJS.Timeout | null = null;
    private myMetadata: PeerMetadata;
    private roomConfig: { name: string, hasPassword: boolean } | null = null;
    private lastSignalTimestamp: number = 0;
    private seenSignalIds: Set<string> = new Set();

    public set onPeersUpdate(fn: (peers: PeerMetadata[]) => void) {
        this.pOnPeersUpdate = fn;
        this.notifyPeersUpdate();
    }

    public get onPeersUpdate() {
        return this.pOnPeersUpdate;
    }

    constructor(
        myId: string,
        initialName: string,
        isHost: boolean,
        onMessage: (msg: any) => void,
        onPeersUpdate: (peers: PeerMetadata[]) => void
    ) {
        this.myId = myId;
        this.myMetadata = { id: myId, name: initialName, isHost };
        this.onMessage = onMessage;
        this.pOnPeersUpdate = onPeersUpdate;
        // Start from "now" to avoid processing old signals from previous sessions
        this.lastSignalTimestamp = Date.now();
    }

    setRoomConfig(name: string, hasPassword: boolean) {
        this.roomConfig = { name, hasPassword };
    }

    updateMetadata(updates: Partial<PeerMetadata>) {
        this.myMetadata = { ...this.myMetadata, ...updates };
        this.broadcast({ type: 'metadata-update', payload: this.myMetadata });
        this.notifyPeersUpdate();
    }

    async startDiscovery() {
        this.pollSignaling();
        if (this.myMetadata.isHost && this.roomConfig) {
            this.startHeartbeat();
        }
    }

    private startHeartbeat() {
        if (this.discoveryInterval) clearInterval(this.discoveryInterval);
        const sendHeartbeat = () => {
            fetch('/api/signal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'offer',
                    from: this.myId,
                    to: 'room-discovery',
                    data: { roomName: this.roomConfig?.name, hasPassword: this.roomConfig?.hasPassword }
                })
            }).catch(() => { });
        };
        sendHeartbeat();
        this.discoveryInterval = setInterval(sendHeartbeat, 5000); // Heartbeat every 5s
    }

    private async pollSignaling() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/signal?peerId=${this.myId}`);
                const { signals } = await res.json();

                let maxTimestamp = this.lastSignalTimestamp;
                for (const signal of signals) {
                    if (signal.timestamp <= this.lastSignalTimestamp) continue;

                    this.handleSignal(signal);
                    if (signal.timestamp > maxTimestamp) maxTimestamp = signal.timestamp;
                }
                this.lastSignalTimestamp = maxTimestamp;
            } catch (err) { }
        }, 2000);
    }

    private async handleSignal(signal: any) {
        if (signal.from === this.myId) return;

        let p = this.peers.get(signal.from);

        if (signal.type === 'offer') {
            if (p && p.connected) {
                console.log(`[P2P] IGNORING RE-OFFER FROM ${signal.from} (CONNECTED)`);
                return;
            }

            if (p) {
                console.log(`[P2P] REPLACING STALE PEER ${signal.from}`);
                try { p.peer.destroy(); } catch (e) { }
            }

            console.log(`[P2P] RECEIVING OFFER FROM ${signal.from}`);
            const peer = new Peer({
                initiator: false,
                trickle: false,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                }
            });
            peer.on('signal', data => this.sendSignal('answer', signal.from, data));
            this.setupPeerEvents(peer, signal.from);

            this.peers.set(signal.from, {
                id: signal.from,
                peer,
                connected: false,
                metadata: { id: signal.from, name: 'Anonymous', isHost: false }
            });
            peer.signal(signal.data);
        } else if (p) {
            console.log(`[P2P] RECEIVING ${signal.type.toUpperCase()} FROM ${signal.from}`);
            try { p.peer.signal(signal.data); } catch (e) { }
        }
    }

    private setupPeerEvents(peer: Peer.Instance, id: string) {
        peer.on('connect', () => {
            console.log(`[P2P] CONNECTED TO PEER ${id}`);
            const p = this.peers.get(id);
            if (p) {
                p.connected = true;
                this.broadcastMyMetadata();

                // If I am the host, I must introduce this new peer to all existing peers
                // to form a full mesh network.
                if (this.myMetadata.isHost) {
                    console.log(`[P2P] HOST INTRODUCING ${id} TO ALL PEERS`);
                    this.broadcast({
                        type: 'peer-introduction',
                        payload: { id, metadata: p.metadata }
                    });
                }
            }
        });
        peer.on('data', data => this.handleData(id, data));
        peer.on('close', () => {
            console.log(`[P2P] CLOSED CONNECTION WITH ${id}`);
            this.removePeer(id);
        });
        peer.on('error', (err) => {
            console.error(`[P2P] ERROR WITH PEER ${id}:`, err);
            this.removePeer(id);
        });
    }

    private handleData(fromId: string, data: any) {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'metadata-update') {
                const p = this.peers.get(fromId);
                if (p) {
                    p.metadata = msg.payload;
                    this.notifyPeersUpdate();
                }
            } else if (msg.type === 'peer-introduction') {
                // If the host tells us about a peer we don't know, connect to them!
                const intro = msg.payload;
                if (intro.id !== this.myId && !this.peers.has(intro.id)) {
                    console.log(`[P2P] INTRODUCED TO ${intro.id} BY HOST. CONNECTING...`);
                    this.connectToPeer(intro.id);
                }
            } else {
                this.onMessage(msg);
            }
        } catch (e) { }
    }

    private broadcastMyMetadata() {
        this.broadcast({ type: 'metadata-update', payload: this.myMetadata });
    }

    private removePeer(id: string) {
        const p = this.peers.get(id);
        if (p) {
            try { p.peer.destroy(); } catch (e) { }
            this.peers.delete(id);
            this.notifyPeersUpdate();
        }
    }

    private async sendSignal(type: string, to: string, data: any) {
        console.log(`[P2P] SENDING ${type.toUpperCase()} TO ${to}`);
        await fetch('/api/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, from: this.myId, to, data })
        });
    }

    connectToPeer(peerId: string) {
        if (this.peers.has(peerId) && this.peers.get(peerId)?.connected) return;

        console.log(`[P2P] INITIATING CONNECTION TO ${peerId}`);
        const peer = new Peer({
            initiator: true,
            trickle: false,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            }
        });
        peer.on('signal', data => this.sendSignal('offer', peerId, data));
        this.setupPeerEvents(peer, peerId);

        this.peers.set(peerId, {
            id: peerId,
            peer,
            connected: false,
            metadata: { id: peerId, name: 'Anonymous', isHost: false }
        });
    }

    broadcast(message: any) {
        const data = JSON.stringify(message);
        this.peers.forEach(p => {
            if (p.connected) {
                try {
                    p.peer.send(data);
                } catch (e) {
                    console.error('Broadcast failed for peer', p.id, e);
                }
            }
        });
    }

    destroy() {
        if (this.interval) clearInterval(this.interval);
        if (this.discoveryInterval) clearInterval(this.discoveryInterval);
        this.peers.forEach(p => p.peer.destroy());
        this.peers.clear();
    }

    private notifyPeersUpdate() {
        const peerMetas = Array.from(this.peers.values())
            .filter(p => p.connected)
            .map(p => p.metadata);
        this.onPeersUpdate([this.myMetadata, ...peerMetas]);
    }

    getPeers() {
        return Array.from(this.peers.values()).filter(p => p.connected);
    }
}
