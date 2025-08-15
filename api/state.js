// Vercel Serverless Function to read/write the primary app state to Vercel Blob
// GET  -> returns latest state JSON (or empty defaults)
// POST -> saves provided state JSON at a fixed path

import { list, put } from '@vercel/blob';

const STATE_PATH = 'state/life-tracker.json';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Try to find the fixed state file first
      const { blobs } = await list({ prefix: 'state/', token: process.env.BLOB_READ_WRITE_TOKEN });
      const exact = blobs.find((b) => b.pathname === STATE_PATH);
      const target = exact || blobs.sort((a,b)=> new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
      if (!target) {
        return res.status(200).json({ data: { reminders: [], tasks: [], habits: [], groceries: [], requests: [] }, url: null, pathname: null });
      }
      const resp = await fetch(target.url);
      const json = await resp.json();
      return res.status(200).json({ pathname: target.pathname, url: target.url, data: json });
    } catch (err) {
      return res.status(500).json({ error: err?.message || 'Failed to load state' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      // Save exactly what the client sends under a fixed path
      const result = await put(STATE_PATH, JSON.stringify(body, null, 2), {
        access: 'private',
        contentType: 'application/json',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      return res.status(200).json({ pathname: result.pathname, url: result.url });
    } catch (err) {
      return res.status(500).json({ error: err?.message || 'Failed to save state' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


