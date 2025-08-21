async function getBlobSdk() {
  // @vercel/blob is ESM-only; use dynamic import for compatibility
  return await import('@vercel/blob');
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    try {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', (err) => reject(err));
    } catch (e) {
      resolve('');
    }
  });
}

async function parseJsonBody(req) {
  try {
    if (req.body && typeof req.body === 'object') return req.body;
    if (req.body && typeof req.body === 'string') return JSON.parse(req.body);
  } catch (_) {}
  try {
    const raw = await readRawBody(req);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  // Optional token (works without if Blob integration is configured in Vercel)
  const token = process.env.BLOB_READ_WRITE_TOKEN || undefined;

  if (req.method === 'GET') {
    try {
      const { list } = await getBlobSdk();
      const { blobs } = await list({ prefix: 'state.json', token });
      const blob = (blobs || []).find((b) => b.pathname === 'state.json') || (blobs || [])[0];
      if (!blob) {
        return res.status(200).json({ data: {} });
      }
      const resp = await fetch(blob.url);
      const json = await resp.json().catch(() => ({}));
      return res.status(200).json({ data: json || {} });
    } catch (e) {
      return res.status(200).json({ data: {} });
    }
  }

  if (req.method === 'POST') {
    try {
      const { put } = await getBlobSdk();
      const body = await parseJsonBody(req);
      const payload = body && typeof body === 'object' ? body : {};
      const toStore = JSON.stringify(payload);
      await put('state.json', toStore, {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        token,
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save state' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end('Method Not Allowed');
};

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


