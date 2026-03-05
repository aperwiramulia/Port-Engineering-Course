/*
  Minimal AI proxy example for local or server deployment.
  Keeps provider API key on server-side only.
*/

const http = require('http');

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const PROXY_TOKEN = process.env.AI_PROXY_TOKEN || '';

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    writeCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url !== '/api/chat' || req.method !== 'POST') {
    writeCorsHeaders(res);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  if (!OPENAI_API_KEY) {
    writeCorsHeaders(res);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing OPENAI_API_KEY on server' }));
    return;
  }

  const authHeader = req.headers.authorization || '';
  if (PROXY_TOKEN && authHeader !== `Bearer ${PROXY_TOKEN}`) {
    writeCorsHeaders(res);
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const body = await readJsonBody(req);
  if (!body || !body.message) {
    writeCorsHeaders(res);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request body' }));
    return;
  }

  const model = body.model || 'gpt-4o-mini';
  const systemMessage = body.systemMessage || 'You are a helpful assistant.';
  const fallback = body.fallback || 'Please check course pages for verified details.';
  const history = Array.isArray(body.history) ? body.history : [];

  const upstreamPayload = {
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemMessage },
      ...history,
      { role: 'user', content: body.message }
    ]
  };

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(upstreamPayload)
    });

    if (!upstream.ok) {
      writeCorsHeaders(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ answer: fallback }));
      return;
    }

    const data = await upstream.json();
    const answer = data && data.choices && data.choices[0] && data.choices[0].message
      ? String(data.choices[0].message.content || '').trim()
      : fallback;

    writeCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ answer: answer || fallback }));
  } catch (error) {
    writeCorsHeaders(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ answer: fallback }));
  }
});

server.listen(PORT, () => {
  console.log(`AI proxy listening on http://localhost:${PORT}/api/chat`);
});

function writeCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (error) {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}
