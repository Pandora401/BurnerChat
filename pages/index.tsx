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
        const res = await fetch(`/api/signal?peerId=${peerId}`);
        const { allSignals } = await res.json();

        // console.log('[DISCOVERY] ALL_SIGNALS:', allSignals.length);

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
      } catch (err) { }
    }, 1500);

    return () => clearInterval(discoveryInterval);
  }, [peerId]);

  const handleHost = async (name: string, password?: string) => {
    setIsHost(true);
    const newRoom: Room = { id: peerId, name, hostId: peerId, hasPassword: !!password };
    setRoom(newRoom);

    if (password) {
      setEncryptionKey(E2EE.deriveKey(password, 'BURNER_SALT_v1'));
    }

    p2pClient.current = new P2PClient(peerId, initialName, true, (msg) => { }, setPeers);
    p2pClient.current.setRoomConfig(name, !!password);
    await p2pClient.current.startDiscovery();
  };

  const handleJoin = async (targetRoom: Room, password?: string) => {
    const derivedKey = password ? E2EE.deriveKey(password, 'BURNER_SALT_v1') : null;

    // 1. Setup temporary client for handshake
    const tempClient = new P2PClient(peerId, initialName, false, () => { }, () => { });
    await tempClient.startDiscovery();

    // 2. Connect and verify
    return new Promise<void>((resolve, reject) => {
      let verified = !targetRoom.hasPassword;
      const timeout = setTimeout(() => {
        if (!verified) {
          tempClient.destroy();
          alert('CONNECTION_TIMEOUT OR INVALID_KEY::ACCESS_DENIED');
        }
      }, 10000);

      tempClient.onMessage = (msg) => {
        if (msg.type === 'handshake-success' && msg.toId === peerId) {
          verified = true;
          clearTimeout(timeout);
          proceed();
        }
      };

      const proceed = () => {
        p2pClient.current = tempClient;
        p2pClient.current.onPeersUpdate = setPeers;
        setEncryptionKey(derivedKey);
        setRoom(targetRoom);
        setIsHost(false);
        resolve();
      };

      tempClient.onPeersUpdate = (peers) => {
        const hostPeer = peers.find(p => p.id === targetRoom.hostId);
        if (hostPeer && targetRoom.hasPassword && !verified) {
          console.log('[JOIN] HOST_FOUND. SENDING_PASSWORD_VERIFICATION...');
          // Send challenge
          const challenge = E2EE.encrypt('BURNER_CHALLENGE', derivedKey || '');
          tempClient.broadcast({ type: 'password-verify', fromId: peerId, challenge });
        } else if (hostPeer && !targetRoom.hasPassword && !verified) {
          console.log('[JOIN] HOST_FOUND (UNLOCKED). PROCEEDING...');
          verified = true;
          clearTimeout(timeout);
          proceed();
        }
      };

      tempClient.connectToPeer(targetRoom.hostId);
    });
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
