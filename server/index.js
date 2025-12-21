// Minimal HTTP server to accept leaderboard submissions.
// No external deps: uses Node's built-in http and fs modules.

const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'leaderboard.json');

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
}

const readJson = () => {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read leaderboard', e);
    return [];
  }
};

const writeJson = (arr) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write leaderboard', e);
    return false;
  }
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.url === '/submit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        // Basic validation: require seed and actions
        if (!payload || !payload.seed || !Array.isArray(payload.actions)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid payload' }));
          return;
        }

        // Server-side verification: replay the actions and compare fingerprint
        let verified = false;
        try {
          const verifier = require('./verifier');
          const init = verifier.generateInitialState(1, payload.seed, payload.seed);
          let s = init;
          for (const a of payload.actions) {
            s = verifier.gameReducer(s, a);
          }
          const computedFp = verifier.fingerprintFromState(s);
          // Accept either a client-provided fingerprint that matches, or accept if no fingerprint provided but scores/floor match
          if (payload.fingerprint) {
            verified = payload.fingerprint === computedFp;
          } else {
            // fallback: basic sanity check on score/floor
            verified = (payload.floor === s.floor) && (payload.score === (s.player.hp || 0) + (s.floor || 0) * 100);
          }
        } catch (ve) {
          console.error('verifier error', ve);
          verified = false;
        }

        if (!verified) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Verification failed' }));
          return;
        }

        const list = readJson();
        const entry = {
          id: String(Date.now()),
          seed: payload.seed,
          score: payload.score || 0,
          floor: payload.floor || 0,
          date: new Date().toISOString(),
          client: payload.client || null
        };
        list.unshift(entry);
        writeJson(list.slice(0, 1000));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, entry }));
      } catch (e) {
        console.error('submit error', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'server error' }));
      }
    });
    return;
  }

  if (req.url === '/leaderboard' && req.method === 'GET') {
    const list = readJson();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(list));
    return;
  }

  // default: small README
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hop leaderboard server. POST /submit to submit verified runs. GET /leaderboard to fetch.');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Leaderboard server listening on http://localhost:${PORT}`);
});
