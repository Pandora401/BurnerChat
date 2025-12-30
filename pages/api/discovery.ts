import { NextApiRequest, NextApiResponse } from 'next';

// This endpoint returns the user's public IP address (or a hash of it)
// to facilitate grouping peers on the same local network.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const publicIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const ip = Array.isArray(publicIp) ? publicIp[0] : publicIp;

    // We don't want to expose the actual IP if possible, but for discovery 
    // we need a common key. We'll use a simple hash.
    const discoveryKey = Buffer.from(ip).toString('base64');

    res.status(200).json({ discoveryKey });
}
