// Vercel Serverless Function to list and load the most recent backup
// Returns the JSON content of the latest blob under backups/

import { list, get } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const prefix = 'backups/';
    const { blobs } = await list({ prefix, token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!blobs || blobs.length === 0) {
      return res.status(404).json({ error: 'No backups found' });
    }
    // sort by uploadedAt desc
    const latest = blobs.sort((a,b)=> new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
    const { url } = latest;
    const resp = await fetch(url);
    const json = await resp.json();
    return res.status(200).json({ pathname: latest.pathname, url, data: json });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to load backup' });
  }
}


