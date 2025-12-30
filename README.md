# BurnerChat 🔥

![Hacker UI](https://media.istockphoto.com/id/999907254/fi/vektori/voi-soittaa.jpg?s=612x612&w=0&k=20&c=RruQgsPT3fG-dPwB8TqcUGQZNd5F5zRbxb8KHQH8Dw8=)

## Overview
**BurnerChat** is a decentralized, ephemeral, and decentralized P2P chat application designed for secure communication within local networks. Inspired by the "Tin Can" telephone, it ensures that your data never leaves your network and disappears the moment you're done.

### Key Features
- **90s Techno UI**: Immersive CRT terminal aesthetic with flicker and scanline effects.
- **Pure P2P**: Leveraging WebRTC for direct device-to-device communication. No chat data is stored on any server.
- **End-to-End Encryption (E2EE)**: AES-256 encryption with keys derived locally from room passwords.
- **Role Management**: Hosts can "Burn Logs" or "Burn Chat" (terminate session) with global visual effects (progressive fire wipe).
- **Vercel Ready**: Fully serverless signaling architecture designed for the edge.

## Security Model
1. **Discovery**: Peers on the same Public IP discover each other's room metadata via a stateless signaling API.
2. **Handshake**: A WebRTC connection is established directly between peers.
3. **Encryption**: Messages are encrypted in-browser using your room password. The signaling server NEVER sees your plain text or your password.
4. **Persistence**: Zero. Once a room is "Burned" or the host disconnects, the data is gone forever.

## Run Locally

Install dependencies:
```bash
  npm install
```

Run dev server:
```bash
  npm run dev
```

Navigate to:
```bash
  http://localhost:3000/
```

## Deployment
This project is optimized for [Vercel](https://vercel.com). Simply link your repository and deploy. The signaling logic uses standard Next.js API routes.

---
*Inspired by the concept of proximity-based silent communication.*
*Optimized for local networks and privacy-first environments.*
