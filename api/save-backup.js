const { put } = require('@vercel/blob');

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', (err) => reject(err));
  });
}

async function parseJsonBody(req) {
  try {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') return JSON.parse(req.body);
  } catch (_) {}
  try {
    const raw = await readRawBody(req);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN || undefined;
  try {
    const body = await parseJsonBody(req);
    const data = body?.data || {};
    const key = `backup-${Date.now()}.json`;
    await put(key, JSON.stringify(data), {
      access: 'public',
      contentType: 'application/json',
      token,
    });
    return res.status(200).json({ ok: true, key });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to save backup' });
  }
};

// Vercel Serverless Function to save a JSON backup to Vercel Blob
// Requires project to be deployed on Vercel with Blob enabled.
// Optional: set BLOB_READ_WRITE_TOKEN for local testing.

import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data } = req.body || {};
    if (!data) {
      return res.status(400).json({ error: 'Missing data in request body' });
    }

    const iso = new Date().toISOString().replace(/[:.]/g, '-');
    const pathname = `backups/life-tracker-${iso}.json`;

    const stringified = JSON.stringify(data, null, 2);
    const result = await put(pathname, stringified, {
      access: 'private',
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return res.status(200).json({ url: result.url, pathname: result.pathname });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Failed to save backup' });
  }
}


