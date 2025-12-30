import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Room, Message, PeerMetadata } from '../lib/types';
import { P2PClient } from '../lib/p2p-client';
import { E2EE } from '../lib/crypto';
import ChatInput from './ChatInput';

interface ChatProps {
  room: Room;
  isHost: boolean;
  onLeave: () => void;
  p2pClient: P2PClient;
  encryptionKey: string | null;
  peerId: string;
  peers: PeerMetadata[];
  onRoleChange: (newIsHost: boolean) => void;
}

const Chat: React.FC<ChatProps> = ({ room, isHost, onLeave, p2pClient, encryptionKey, peerId, peers, onRoleChange }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const [showPeers, setShowPeers] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const progressiveWipe = async (completeCallback?: () => void) => {
    setIsBurning(true);

    // We'll remove messages in chunks for a "progressive" feel
    const count = messages.length;
    for (let i = 0; i <= count; i++) {
      await new Promise(r => setTimeout(r, 150));
      setMessages(prev => prev.slice(1)); // Remove from top or bottom? Progressive wipe usually feels better if it "eats" them.
    }

    setTimeout(() => {
      setIsBurning(false);
      if (completeCallback) completeCallback();
    }, 2500);
  };

  useEffect(() => {
    const handleInbound = (data: any) => {
      if (data.type === 'chat') {
        if (processedMessageIds.current.has(data.payload.id)) {
          // console.log('[CHAT] IGNORED DUPLICATE MESSAGE:', data.payload.id);
          return;
        }
        processedMessageIds.current.add(data.payload.id);

        const newMessage: Message = {
          ...data.payload,
          decryptedContent: encryptionKey
            ? E2EE.decrypt(data.payload.content, encryptionKey) || '[DECRYPT_FAILED]'
            : data.payload.content
        };
        setMessages(prev => [...prev, newMessage]);
      } else if (data.type === 'burn-logs') {
        progressiveWipe();
      } else if (data.type === 'burn-chat') {
        progressiveWipe(() => {
          alert('HOST HAS BURNED THE SESSION. DISCONNECTING...');
          window.location.reload();
        });
      } else if (data.type === 'delegate-host' && data.to === peerId) {
        onRoleChange(true);
        alert('YOU ARE NOW THE HOST.');
      } else if (data.type === 'password-verify' && isHost) {
        // If someone sends a password verification, we reply with success if decrypted correctly
        const challenge = E2EE.decrypt(data.challenge, encryptionKey || '');
        if (challenge === 'BURNER_CHALLENGE') {
          p2pClient.broadcast({ type: 'handshake-success', toId: data.fromId });
        }
      }
    };

    p2pClient.onMessage = handleInbound;
    return () => { p2pClient.onMessage = () => { }; };
  }, [p2pClient, encryptionKey, peerId, onRoleChange, messages.length, isHost]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isBurning]);

  const sendMessage = (content: string) => {
    const id = Math.random().toString(36).substring(7);
    processedMessageIds.current.add(id);

    const encrypted = encryptionKey ? E2EE.encrypt(content, encryptionKey) : content;
    const payload: Message = {
      id,
      sender: peerId,
      senderName: p2pClient['myMetadata'].name,
      content: encrypted,
      timestamp: Date.now(),
      decryptedContent: content
    };
    p2pClient.broadcast({ type: 'chat', payload });
    setMessages(prev => [...prev, payload]);
  };

  const burnLogs = () => {
    if (!isHost) return;
    if (confirm('EXECUTE BURN_LOGS? ALL CLIENT HISTORIES WILL BE WIPED.')) {
      p2pClient.broadcast({ type: 'burn-logs' });
      progressiveWipe();
    }
  };

  const burnChat = () => {
    if (!isHost) return;
    if (confirm('EXECUTE BURN_CHAT? ALL CLIENTS WILL BE KICKED AND SESSION TERMINATED.')) {
      p2pClient.broadcast({ type: 'burn-chat' });
      progressiveWipe(() => {
        window.location.reload();
      });
    }
  };

  const delegateHost = (targetPeer: PeerMetadata) => {
    if (!isHost) return;
    if (confirm(`TRANSFER HOST_CONTROL TO ${targetPeer.name}?`)) {
      p2pClient.broadcast({ type: 'delegate-host', to: targetPeer.id });
      onRoleChange(false);
      p2pClient.updateMetadata({ isHost: false });
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/40">
      <div className="crt-overlay" />

      {/* Terminal Top Bar */}
      <header className="terminal-header border-b border-[#003b00] !bg-black/80 flex-wrap gap-2 py-2">
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
          <span className="animate-pulse text-[#d4ff00] text-[10px] hidden sx:inline">●_REC</span>
          <span className="font-bold text-xs md:text-base truncate max-w-[120px] md:max-w-none">
            {room.name.toUpperCase()}
          </span>
          <span className="text-[8px] opacity-60 hidden sm:inline">AES_256_E2EE</span>
        </div>
        <div className="flex gap-1 ml-auto">
          {isHost && (
            <>
              <button
                onClick={burnLogs}
                className="text-[8px] md:text-[10px] border border-red-900 px-1 md:px-2 py-0.5 hover:bg-red-900 text-red-500 hover:text-white transition-colors"
              >
                BURN_LOGS
              </button>
              <button
                onClick={burnChat}
                className="text-[8px] md:text-[10px] border border-red-900 px-1 md:px-2 py-0.5 hover:bg-red-600 text-red-500 hover:text-white font-bold"
              >
                BURN_CHAT
              </button>
            </>
          )}
          {!isHost && (
            <button
              onClick={onLeave}
              className="text-[8px] md:text-[10px] border border-[#003b00] px-1 md:px-2 py-0.5 hover:bg-[#003b00] text-gray-400 hover:text-white"
            >
              QUIT
            </button>
          )}
          {isHost && (
            <button
              disabled
              className="text-[8px] md:text-[10px] border border-white/10 px-1 md:px-2 py-0.5 opacity-30 cursor-not-allowed hidden sm:block"
            >
              HOST_LOCKED
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Peers */}
        <div className={`w-64 border-r border-[#003b00] bg-black/20 flex flex-col ${showPeers ? 'block' : 'hidden md:flex'}`}>
          <div className="p-3 border-b border-[#003b00] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] opacity-50 uppercase">Your Identity</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                defaultValue={p2pClient['myMetadata'].name}
                onBlur={(e) => {
                  const newName = e.target.value.trim();
                  if (newName) p2pClient.updateMetadata({ name: newName });
                }}
                className="bg-black/40 border border-[#003b00] text-[11px] px-2 py-1 w-full focus:border-[#d4ff00] outline-none"
              />
            </div>
          </div>

          <div className="p-3 text-[10px] border-b border-[#003b00] opacity-50">ACTIVE_PEERS [{peers.length}]</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {peers.map(p => (
              <div key={p.id} className="text-xs p-2 border border-transparent hover:border-[#003b00] group flex justify-between items-center">
                <div className="flex flex-col">
                  <span className={p.id === peerId ? 'text-[#d4ff00]' : ''}>
                    {p.name} {p.id === peerId && '(YOU)'}
                  </span>
                  {p.isHost && <span className="text-[8px] text-teal-500">[SYSTEM_HOST]</span>}
                </div>
                {isHost && p.id !== peerId && (
                  <button
                    onClick={() => delegateHost(p)}
                    className="hidden group-hover:block text-[8px] border border-[#003b00] px-1 hover:bg-[#003b00]"
                  >
                    PROMOTE
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Console / Messages */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative overflow-hidden border-b border-[#003b00]">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto p-4 space-y-4 font-mono text-sm scroll-smooth"
            >
              {messages.length === 0 && (
                <div className="text-[#004400] text-xs">READY FOR INPUT...</div>
              )}
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group"
                  >
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-[10px] opacity-30">[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
                      <span className={`text-[11px] font-bold ${msg.sender === peerId ? 'text-[#d4ff00]' : 'text-gray-400'}`}>
                        {msg.senderName.toUpperCase()} {'>'}
                      </span>
                    </div>
                    <div className={`pl-4 border-l ${msg.sender === peerId ? 'border-[#d4ff00]/30' : 'border-[#003b00]'} py-1`}>
                      <p className={`whitespace-pre-wrap leading-tight text-sm ${msg.sender === peerId ? 'text-white' : 'text-[#00ff41]'}`}>
                        {msg.decryptedContent || msg.content}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Fire Animation - Anchored to bottom of logs container, above CRT overlays */}
            {isBurning && (
              <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-[1100] overflow-hidden flex items-end">
                <img
                  src="/animations/burnit.gif"
                  alt="BURNING..."
                  className="w-full h-[180px] object-cover opacity-100"
                />
              </div>
            )}
          </div>

          <div className="p-4">
            <ChatInput onSend={sendMessage} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
