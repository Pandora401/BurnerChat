import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Room } from '../lib/types';

interface LobbyProps {
    rooms: Room[];
    onHost: (name: string, password?: string) => void;
    onJoin: (room: Room, password?: string) => void;
    nodeName: string;
    setNodeName: (name: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ rooms, onHost, onJoin, nodeName, setNodeName }) => {
    const [roomName, setRoomName] = useState('');
    const [password, setPassword] = useState('');
    const [joiningRoom, setJoiningRoom] = useState<Room | null>(null);
    const [joinPassword, setJoinPassword] = useState('');

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="crt-overlay" />

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center mb-12 border-b border-[#003b00] pb-6"
            >
                <div className="flex items-center justify-center gap-2 md:gap-6 mb-2 overflow-hidden">
                    <img src="/animations/burnit.gif" alt="" className="h-12 md:h-28 mix-blend-screen opacity-80 flip-horizontal hidden sm:block" style={{ transform: 'scaleX(-1)' }} />
                    <div className="flex flex-col items-center">
                        <motion.h1 className="text-3xl md:text-6xl font-bold glitch tracking-tighter mb-1 md:mb-2 whitespace-nowrap">
                            BurnerChat
                        </motion.h1>
                        <p className="text-[#008f11] text-[8px] md:text-xs uppercase tracking-widest md:tracking-[0.3em] whitespace-nowrap">
                            E2EE P2P LAN CHAT // NO_LOGS
                        </p>
                    </div>
                    <img src="/animations/burnit.gif" alt="" className="h-12 md:h-28 mix-blend-screen opacity-80 hidden sm:block" />
                </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Identity & Discovery */}
                <div className="space-y-12">
                    <section className="terminal-window border-[#d4ff00]">
                        <div className="terminal-header !bg-[#d4ff00] !text-black">
                            <span>SESSION_IDENTITY</span>
                        </div>
                        <div className="p-6">
                            <div className="text-[10px] mb-1 opacity-50">NODE_ALIAS:</div>
                            <input
                                type="text"
                                value={nodeName}
                                onChange={(e) => setNodeName(e.target.value)}
                                placeholder="ENTER_ALIAS"
                                className="hacker-input !border-[#d4ff00] !text-[#d4ff00]"
                            />
                            <p className="text-[8px] mt-2 opacity-40 italic">THIS_ID_WILL_BE_VISIBLE_TO_PEERS</p>
                        </div>
                    </section>

                    <section className="terminal-window">
                        <div className="terminal-header">
                            <span>AVAILABLE_NODES</span>
                            <span>[{rooms.length}]</span>
                        </div>
                        <div className="p-4 space-y-4 min-h-[200px]">
                            {rooms.length === 0 ? (
                                <div className="text-[#004400] text-sm italic animate-pulse">
                                    SCANNIG FOR LOCAL PEERS...
                                </div>
                            ) : (
                                rooms.map((room) => (
                                    <div
                                        key={room.id}
                                        className="border border-[#003b00] p-3 hover:bg-[#003b00]/30 cursor-crosshair group flex justify-between items-center transition-all"
                                        onClick={() => room.hasPassword ? setJoiningRoom(room) : onJoin(room)}
                                    >
                                        <div>
                                            <div className="text-sm font-bold group-hover:text-white">{room.name}</div>
                                            <div className="text-[10px] text-[#008f11]/60">HOST_ID: {room.hostId.substring(0, 8)}</div>
                                        </div>
                                        <div className="text-xs">
                                            {room.hasPassword ? '[LOCKED]' : '[OPEN]'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* Initialize Node */}
                <section className="terminal-window">
                    <div className="terminal-header">
                        <span>INITIALIZE_NEW_RELAY</span>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <div className="text-[10px] mb-1 opacity-50">RELAY_NAME:</div>
                            <input
                                type="text"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                placeholder="ROOM_IDENTIFIER"
                                className="hacker-input"
                            />
                        </div>
                        <div>
                            <div className="text-[10px] mb-1 opacity-50">ENCRYPTION_PASS:</div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="OPTIONAL_AES256_KEY"
                                className="hacker-input"
                            />
                        </div>
                        <button
                            onClick={() => onHost(roomName, password)}
                            disabled={!roomName || !nodeName}
                            className="w-full hacker-btn py-3 mt-4"
                        >
                            EXECUTE::START_SESSION
                        </button>
                        <div className="text-[10px] text-[#004400] mt-4 leading-relaxed">
                            WARNING: ALL TRAFFIC IS P2P. SERVER DOES NOT PERSIST MESSAGES.
                            HOST CONTROL REMAINS WITH INITIALIZER UNTIL DELEGATED.
                        </div>
                    </div>
                </section>
            </div>

            {/* Password Prompt */}
            <AnimatePresence>
                {joiningRoom && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/90 p-4"
                    >
                        <div className="terminal-window max-w-sm w-full">
                            <div className="terminal-header">
                                <span>SECURITY_VERIFICATION</span>
                            </div>
                            <div className="p-6">
                                <p className="text-xs mb-4">NODE REQUIRES AES-256 HANDSHAKE PASS:</p>
                                <input
                                    type="password"
                                    autoFocus
                                    value={joinPassword}
                                    onChange={(e) => setJoinPassword(e.target.value)}
                                    placeholder="********"
                                    className="hacker-input mb-6"
                                />
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setJoiningRoom(null)}
                                        className="flex-1 hacker-btn opacity-50"
                                    >
                                        ABORT
                                    </button>
                                    <button
                                        onClick={() => onJoin(joiningRoom, joinPassword)}
                                        className="flex-1 hacker-btn"
                                    >
                                        AUTH_AND_JOIN
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Lobby;
