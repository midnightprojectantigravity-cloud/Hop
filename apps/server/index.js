import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateInitialState, gameReducer, fingerprintFromState } from '@hop/engine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
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
          res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Invalid payload' }));
          return;
        }

        // Server-side verification: Replay the actions using the REAL engine
        let verified = false;
        let finalScore = 0;
        let finalFloor = 1;

        try {
          // 1. Initial State re-simulation
          const init = generateInitialState(1, payload.seed, payload.seed);
          let s = init;

          // 2. Action Replay
          for (const a of payload.actions) {
            s = gameReducer(s, a);
          }

          // 3. Fingerprint comparison
          const computedFp = fingerprintFromState(s);
          finalScore = (s.player.hp || 0) + (s.floor || 0) * 100; // Legacy score for now
          finalFloor = s.floor;

          if (payload.fingerprint) {
            verified = payload.fingerprint === computedFp;
          } else {
            // fallback: score/floor safety check
            verified = (payload.floor === s.floor);
          }
        } catch (ve) {
          console.error('Verification engine error', ve);
          verified = false;
        }

        if (!verified) {
          res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Verification failed' }));
          return;
        }

        const list = readJson();
        const entry = {
          id: String(Date.now()),
          seed: payload.seed,
          score: payload.score || finalScore,
          floor: payload.floor || finalFloor,
          date: new Date().toISOString(),
          client: payload.client || null
        };
        list.unshift(entry);
        writeJson(list.slice(0, 1000));
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, entry }));
      } catch (e) {
        console.error('submit error', e);
        res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'server error' }));
      }
    });
    return;
  }

  if (req.url === '/leaderboard' && req.method === 'GET') {
    const list = readJson();
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(list));
    return;
  }

  // default: small README
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hop Unified Validator Server. Replaying runs with @hop/engine.');
    return;
  }

  res.writeHead(404, { ...headers, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Validator server listening on http://localhost:${PORT}`);
});
