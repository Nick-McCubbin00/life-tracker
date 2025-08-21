async function readRawBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(500).json({ error: 'Missing GOOGLE_MAPS_API_KEY' });
  try {
    const body = await parseJsonBody(req);
    const type = body?.type;
    if (type === 'autocomplete') {
      const input = String(body?.input || '').slice(0, 200);
      const sessiontoken = body?.sessiontoken ? String(body.sessiontoken) : undefined;
      if (!input) return res.status(400).json({ error: 'Missing input' });
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.set('input', input);
      url.searchParams.set('key', key);
      url.searchParams.set('types', 'geocode');
      if (sessiontoken) url.searchParams.set('sessiontoken', sessiontoken);
      const r = await fetch(url.toString());
      if (!r.ok) {
        const text = await r.text().catch(()=> '');
        return res.status(502).json({ error: `Places Autocomplete HTTP ${r.status}: ${text || 'Upstream error'}` });
      }
      const json = await r.json();
      const status = json?.status;
      if (status && status !== 'OK' && status !== 'ZERO_RESULTS') {
        return res.status(400).json({ error: `Places Autocomplete error: ${status}${json?.error_message ? ' - ' + json.error_message : ''}` });
      }
      return res.status(200).json({ predictions: json?.predictions || [] });
    }
    if (type === 'details') {
      const placeId = String(body?.placeId || '');
      const sessiontoken = body?.sessiontoken ? String(body.sessiontoken) : undefined;
      if (!placeId) return res.status(400).json({ error: 'Missing placeId' });
      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('key', key);
      url.searchParams.set('fields', 'place_id,name,formatted_address,geometry/location,url');
      if (sessiontoken) url.searchParams.set('sessiontoken', sessiontoken);
      const r = await fetch(url.toString());
      if (!r.ok) {
        const text = await r.text().catch(()=> '');
        return res.status(502).json({ error: `Place Details HTTP ${r.status}: ${text || 'Upstream error'}` });
      }
      const json = await r.json();
      const status = json?.status;
      if (status && status !== 'OK') {
        return res.status(400).json({ error: `Place Details error: ${status}${json?.error_message ? ' - ' + json.error_message : ''}` });
      }
      const resPlace = json?.result || {};
      const out = {
        placeId: resPlace.place_id,
        name: resPlace.name,
        address: resPlace.formatted_address,
        location: resPlace.geometry?.location || null,
        url: resPlace.url || null,
      };
      return res.status(200).json({ place: out });
    }
    return res.status(400).json({ error: 'Unsupported type' });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Places request failed' });
  }
};


