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
    public onMessage: (msg: any) => void;
    public onPeersUpdate: (peers: PeerMetadata[]) => void;
    private interval: NodeJS.Timeout | null = null;
    private discoveryInterval: NodeJS.Timeout | null = null;
    private myMetadata: PeerMetadata;
    private roomConfig: { name: string, hasPassword: boolean } | null = null;

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
        this.onPeersUpdate = onPeersUpdate;
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
        this.discoveryInterval = setInterval(sendHeartbeat, 10000); // Heartbeat every 10s
    }

    private async pollSignaling() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/signal?peerId=${this.myId}`);
                const { signals } = await res.json();
                for (const signal of signals) {
                    this.handleSignal(signal);
                }
            } catch (err) { }
        }, 2000);
    }

    private async handleSignal(signal: any) {
        if (signal.from === this.myId) return;

        let p = this.peers.get(signal.from);

        if (signal.type === 'offer') {
            if (p) {
                // If we already have a connection or pending one, only replace if this is a fresh start
                p.peer.destroy();
            }

            const peer = new Peer({ initiator: false, trickle: false });
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
            p.peer.signal(signal.data);
        }
    }

    private setupPeerEvents(peer: Peer.Instance, id: string) {
        peer.on('connect', () => {
            const p = this.peers.get(id);
            if (p) {
                p.connected = true;
                this.broadcastMyMetadata();
            }
        });
        peer.on('data', data => this.handleData(id, data));
        peer.on('close', () => this.removePeer(id));
        peer.on('error', (err) => {
            console.error('Peer error', err);
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
            p.peer.destroy();
            this.peers.delete(id);
            this.notifyPeersUpdate();
        }
    }

    private async sendSignal(type: string, to: string, data: any) {
        await fetch('/api/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, from: this.myId, to, data })
        });
    }

    connectToPeer(peerId: string) {
        if (this.peers.has(peerId)) return;

        const peer = new Peer({ initiator: true, trickle: false });
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
