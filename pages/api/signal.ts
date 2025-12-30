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
};

// Global store (will reset when function sleeps, but works for quick handshakes)
let signals: Signal[] = [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ipKey = Array.isArray(publicIp) ? publicIp[0] : publicIp;

  // Prune old signals (older than 30 seconds)
  const now = Date.now();
  signals = signals.filter(s => now - s.timestamp < 30000);

  if (method === 'POST') {
    const { type, from, to, data } = req.body;
    
    if (!type || !from) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    signals.push({ type, from, to, data, timestamp: now });
    return res.status(200).json({ success: true });
  } 
  
  if (method === 'GET') {
    const { peerId } = req.query;
    
    // Find signals intended for this peer
    const intendedSignals = signals.filter(s => s.to === peerId);
    
    // Also return "discovery" signals (offers from others on the same network)
    // For simplicity, we'll just return everything for now and let the client filter
    // in a real app, we'd filter by the hashed publicIp.
    
    return res.status(200).json({ signals: intendedSignals, allSignals: signals });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${method} Not Allowed`);
}
