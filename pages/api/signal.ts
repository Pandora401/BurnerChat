import { NextApiRequest, NextApiResponse } from 'next';

// This is a simple in-memory signaling store.
// In a real production environment on Vercel, this would be backed by Redis (e.g., Upstash)
// because serverless functions are stateless.
// For this local network discovery, we'll use it to facilitate the handshake.
// NOTE: Vercel functions are stateless, but for rapid signaling handshakes, 
// a small in-memory cache might persist across some requests within the same execution context.

type Signal = {
  type: 'offer' | 'answer' | 'candidate';
  from: string;
  to: string;
  data: any;
  timestamp: number;
  ipKey: string;
};

// Global store
let signals: Signal[] = [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ipKey = Array.isArray(publicIp) ? publicIp[0] : (publicIp as string);

  // Prune old signals (older than 60 seconds for discovery, can be shorter for handshakes)
  const now = Date.now();
  signals = signals.filter(s => now - s.timestamp < 60000);

  if (method === 'POST') {
    const { type, from, to, data } = req.body;

    if (!type || !from) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Only allow one discovery offer per peer to keep it clean
    if (to === 'room-discovery') {
      signals = signals.filter(s => !(s.from === from && s.to === 'room-discovery'));
    }

    signals.push({ type, from, to, data, timestamp: now, ipKey });
    return res.status(200).json({ success: true });
  }

  if (method === 'GET') {
    const { peerId } = req.query;

    // Scoped by IP: Only show signals from the same network
    const localSignals = signals.filter(s => s.ipKey === ipKey);

    // Find signals intended specifically for this peer
    const intendedSignals = localSignals.filter(s => s.to === peerId);

    return res.status(200).json({
      signals: intendedSignals,
      allSignals: localSignals // These used for discovery
    });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${method} Not Allowed`);
}
