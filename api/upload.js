async function getBlobSdk() {
	return await import('@vercel/blob');
}

async function readRawBody(req) {
	return new Promise((resolve) => {
		let data = '';
		req.on('data', (chunk) => (data += chunk));
		req.on('end', () => resolve(data));
		req.on('error', () => resolve(''));
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

function parseDataUrl(dataUrl) {
	// Expects: data:<mime>;base64,<payload>
	if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
	const comma = dataUrl.indexOf(',');
	if (comma < 0) return null;
	const header = dataUrl.slice(5, comma); // remove 'data:'
	const base64 = dataUrl.slice(comma + 1);
	const isBase64 = /;base64$/i.test(header) || /;base64;/.test(header);
	const mime = header.replace(/;base64/i, '');
	try {
		const buffer = Buffer.from(base64, 'base64');
		return { mime, buffer };
	} catch (_) {
		return null;
	}
}

module.exports = async function handler(req, res) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', 'POST');
		return res.status(405).end('Method Not Allowed');
	}
	try {
		const body = await parseJsonBody(req);
		const { dataUrl, filename, scope } = body || {};
		if (!dataUrl) {
			return res.status(400).json({ error: 'Missing dataUrl' });
		}
		const parsed = parseDataUrl(dataUrl);
		if (!parsed) {
			return res.status(400).json({ error: 'Invalid dataUrl' });
		}
		const { put } = await getBlobSdk();
		const safeName = String(filename || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
		const targetPath = `${scope === 'work' ? 'uploads/work' : 'uploads/recipes'}/${Date.now()}-${safeName}`;
		const result = await put(targetPath, parsed.buffer, {
			access: 'private',
			contentType: parsed.mime || 'application/octet-stream',
			token: process.env.BLOB_READ_WRITE_TOKEN || undefined,
		});
		return res.status(200).json({ url: result.url, pathname: result.pathname });
	} catch (err) {
		return res.status(500).json({ error: err?.message || 'Upload failed' });
	}
};


