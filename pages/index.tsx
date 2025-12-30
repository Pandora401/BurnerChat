import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Lobby from '../components/Lobby';
import Chat from '../components/Chat';
import { Room, Message, PeerMetadata } from '../lib/types';
import { P2PClient } from '../lib/p2p-client';
import { E2EE } from '../lib/crypto';

const generatePeerId = () => 'peer-' + Math.random().toString(36).substring(2, 9);
const generateDefaultName = () => `NODE_${Math.floor(Math.random() * 9999 + 1000)}`;

export default function Home() {
  const [peerId] = useState(generatePeerId());
  const [initialName] = useState(generateDefaultName());
  const [room, setRoom] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [peers, setPeers] = useState<PeerMetadata[]>([]);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const p2pClient = useRef<P2PClient | null>(null);

  useEffect(() => {
    const discoveryInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/signal');
        const { allSignals } = await res.json();

        const localRooms: Room[] = allSignals
          .filter((s: any) => s.type === 'offer' && s.to === 'room-discovery')
          .map((s: any) => ({
            id: s.from,
            name: s.data.roomName,
            hostId: s.from,
            hasPassword: s.data.hasPassword
          }));

        const uniqueRooms = Array.from(new Map(localRooms.map(r => [r.id, r])).values());
        setRooms(uniqueRooms);
      } catch (err) {
        console.error('Discovery error', err);
      }
    }, 3000);

    return () => clearInterval(discoveryInterval);
  }, []);

  const handleHost = async (name: string, password?: string) => {
    setIsHost(true);
    const newRoom: Room = { id: peerId, name, hostId: peerId, hasPassword: !!password };
    setRoom(newRoom);

    if (password) {
      setEncryptionKey(E2EE.deriveKey(password, 'local-salt'));
    }

    p2pClient.current = new P2PClient(peerId, initialName, true, (msg) => { }, setPeers);
    await p2pClient.current.startDiscovery();

    await fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'offer',
        from: peerId,
        to: 'room-discovery',
        data: { roomName: name, hasPassword: !!password }
      })
    });
  };

  const handleJoin = async (targetRoom: Room, password?: string) => {
    setRoom(targetRoom);
    setIsHost(false);

    if (password) {
      setEncryptionKey(E2EE.deriveKey(password, 'local-salt'));
    }

    p2pClient.current = new P2PClient(peerId, initialName, false, (msg) => { }, setPeers);
    await p2pClient.current.startDiscovery();
    p2pClient.current.connectToPeer(targetRoom.hostId);
  };

  const handleLeave = () => {
    if (p2pClient.current) p2pClient.current.destroy();
    setRoom(null);
    setIsHost(false);
    setEncryptionKey(null);
    setPeers([]);
  };

  const handleRoleChange = (newIsHost: boolean) => {
    setIsHost(newIsHost);
    if (p2pClient.current) {
      p2pClient.current.updateMetadata({ isHost: newIsHost });
    }
  };

  return (
    <div className="min-h-screen bg-[#000a00]">
      <Head>
        <title>TINCANLAN // LOCAL_NET_SIGNAL</title>
      </Head>

      <main className="h-screen overflow-hidden text-[#00ff41]">
        {!room ? (
          <Lobby rooms={rooms} onHost={handleHost} onJoin={handleJoin} />
        ) : (
          <Chat
            room={room}
            isHost={isHost}
            onLeave={handleLeave}
            p2pClient={p2pClient.current!}
            encryptionKey={encryptionKey}
            peerId={peerId}
            peers={peers}
            onRoleChange={handleRoleChange}
          />
        )}
      </main>
    </div>
  );
}
