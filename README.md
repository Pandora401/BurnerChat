# BurnerChat 🔥

![lobby](https://raw.githubusercontent.com/Pandora401/TinCanLan/refs/heads/main/public/scrnshts/readme.png)

## Overview
**BurnerChat** is a decentralized, ephemeral, and decentralized P2P chat application designed for secure communication within local networks. Inspired by the "Tin Can" telephone, it ensures that your data never leaves your network and disappears the moment you're done.

![chat room](https://raw.githubusercontent.com/Pandora401/TinCanLan/refs/heads/main/public/scrnshts/readme2.png)

### Key Features
- **Pure P2P**: Leveraging WebRTC for direct device-to-device communication. No chat data is stored on any server.
- **End-to-End Encryption (E2EE)**: AES-256 encryption with keys derived locally from room passwords.
- **BURN THE LOGS!!!**: Hosts can "Burn Logs" or "Burn Chat" (terminate session) with global visual effects (progressive fire wipe).
- **Vercel Ready**: Fully serverless signaling architecture designed for the edge.

![how it works](https://raw.githubusercontent.com/Pandora401/TinCanLan/refs/heads/main/public/scrnshts/howitworks.png)

## Security Model
1. **Discovery**: Peers on the same Public IP discover each other's room metadata via a stateless signaling API.
2. **Handshake**: A WebRTC connection is established directly between peers.
3. **Encryption**: Messages are encrypted in-browser using your room password. The signaling server NEVER sees your plain text or your password.
4. **Persistence**: Zero. Once a room is "Burned" or the host disconnects, the data is gone forever.

![flow](https://raw.githubusercontent.com/Pandora401/TinCanLan/refs/heads/main/public/scrnshts/flowsample.png)

## Play with it Yourself
Available POC on Vercel: https://burnit-mauve.vercel.app/

## Deployment
This project is optimized for [Vercel](https://vercel.com). Simply link your repository and deploy. The signaling logic uses standard Next.js API routes.

---
*Inspired by the concept of proximity-based silent communication.*
*Optimized for local networks and privacy-first environments.*
