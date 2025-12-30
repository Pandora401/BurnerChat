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
    private myMetadata: PeerMetadata;

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

    updateMetadata(updates: Partial<PeerMetadata>) {
        this.myMetadata = { ...this.myMetadata, ...updates };
        this.broadcast({ type: 'metadata-update', payload: this.myMetadata });
        this.notifyPeersUpdate();
    }

    async startDiscovery() {
        try {
            const res = await fetch('/api/discovery');
            const data = await res.json();
            this.discoveryKey = data.discoveryKey;
            this.pollSignaling();
        } catch (err) {
            console.error('Discovery failed', err);
        }
    }

    private async pollSignaling() {
        this.interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/signal?peerId=${this.myId}`);
                const { signals } = await res.json();
                for (const signal of signals) {
                    this.handleSignal(signal);
                }
            } catch (err) { }
        }, 3000);
    }

    private async handleSignal(signal: any) {
        let p = this.peers.get(signal.from);
        if (!p) {
            const peer = new Peer({ initiator: false, trickle: false });
            peer.on('signal', data => this.sendSignal('answer', signal.from, data));
            peer.on('connect', () => {
                p!.connected = true;
                this.broadcastMyMetadata();
            });
            peer.on('data', data => this.handleData(signal.from, data));
            peer.on('close', () => this.removePeer(signal.from));
            peer.on('error', () => this.removePeer(signal.from));

            p = {
                id: signal.from,
                peer,
                connected: false,
                metadata: { id: signal.from, name: 'Anonymous', isHost: false }
            };
            this.peers.set(signal.from, p);
        }
        p.peer.signal(signal.data);
    }

    private handleData(fromId: string, data: any) {
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
    }

    private broadcastMyMetadata() {
        this.broadcast({ type: 'metadata-update', payload: this.myMetadata });
    }

    private removePeer(id: string) {
        this.peers.delete(id);
        this.notifyPeersUpdate();
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
        peer.on('connect', () => {
            const pState = this.peers.get(peerId);
            if (pState) pState.connected = true;
            this.broadcastMyMetadata();
        });
        peer.on('data', data => this.handleData(peerId, data));
        peer.on('close', () => this.removePeer(peerId));

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
                try { p.peer.send(data); } catch (e) { }
            }
        });
    }

    destroy() {
        if (this.interval) clearInterval(this.interval);
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
