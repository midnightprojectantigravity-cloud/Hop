import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeParse } from '@hop/engine';
import {
  MAX_REQUEST_BYTES,
  validateReplaySubmissionPayload,
  verifyReplayEnvelope
} from './replay-validator.js';

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
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) {
        tooLarge = true;
      }
    });
    req.on('end', () => {
      try {
        if (tooLarge) {
          res.writeHead(413, { ...headers, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Payload too large' }));
          return;
        }

        let payload;
        try { payload = safeParse(body); } catch (e) { payload = JSON.parse(body); }
        const validated = validateReplaySubmissionPayload(payload);
        if (!validated.valid || !validated.replay) {
          res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: validated.error || 'Invalid payload' }));
          return;
        }

        const verification = verifyReplayEnvelope(validated.replay);
        if (!verification.verified) {
          if (verification.error) {
            console.error('Verification engine error', verification.error);
          }
          res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Verification failed' }));
          return;
        }

        const list = readJson();
        const runMapSize = validated.replay.run.mapSize || null;
        const runMapShape = validated.replay.run.mapShape || 'diamond';
        const runKey = runMapSize
          ? `${validated.replay.run.seed}|${runMapShape}|${runMapSize.width}x${runMapSize.height}`
          : `${validated.replay.run.seed}|${runMapShape}`;
        const entry = {
          id: String(Date.now()),
          runKey,
          seed: validated.replay.run.seed,
          mapShape: runMapShape,
          mapSize: runMapSize,
          score: verification.score,
          floor: verification.floor,
          fingerprint: verification.computedFingerprint,
          replayVersion: validated.replay.version,
          actionCount: validated.replay.actions.length,
          date: new Date().toISOString(),
          client: validated.client || null
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
