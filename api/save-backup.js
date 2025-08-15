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


