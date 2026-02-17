import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const manifestPath = path.join(repoRoot, 'apps', 'web', 'public', 'assets', 'manifest.json');
const schemaPath = path.join(repoRoot, 'apps', 'web', 'public', 'assets', 'manifest.schema.json');
const publicRoot = path.join(repoRoot, 'apps', 'web', 'public');

const requiredLayers = ['ground', 'decal', 'prop', 'unit', 'fx', 'ui'];
const allowedTypes = new Set(['tile', 'decal', 'prop', 'unit', 'fx', 'ui']);
const allowedLayers = new Set(requiredLayers);
const allowedFormats = new Set(['svg', 'webp', 'avif', 'png', 'jpg', 'jpeg']);
const vectorOnlyTypes = new Set(['decal', 'prop', 'ui']);
const tileFormats = new Set(['svg', 'webp', 'avif', 'png']);
const unitFormats = new Set(['webp', 'avif', 'png']);
const fxFormats = new Set(['svg', 'webp', 'avif', 'png']);
const idRe = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const pathRe = /^\/assets\/[a-z0-9/_\-.]+$/;
const allowedExt = new Set(['.webp', '.svg', '.png', '.jpg', '.jpeg']);

const errors = [];
const warnings = [];

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    errors.push(`Failed to parse JSON: ${filePath} (${String(err)})`);
    return null;
  }
};

const manifest = readJson(manifestPath);
const schema = readJson(schemaPath);

if (!manifest || !schema) {
  process.exit(1);
}

if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  errors.push('manifest.version is missing or invalid.');
}

if (manifest.gridTopology !== 'flat-top-hex') {
  errors.push('manifest.gridTopology must be "flat-top-hex".');
}

if (!Number.isFinite(manifest.tileUnitPx) || manifest.tileUnitPx <= 0) {
  errors.push('manifest.tileUnitPx must be a positive number.');
}

if (!Number.isFinite(manifest.tileAspectRatio) || manifest.tileAspectRatio <= 0) {
  errors.push('manifest.tileAspectRatio must be a positive number.');
}

if (manifest.biomeUnderlay !== undefined) {
  const u = manifest.biomeUnderlay;
  if (!u || typeof u !== 'object') {
    errors.push('manifest.biomeUnderlay must be an object when provided.');
  } else {
    if (typeof u.default !== 'string' || !pathRe.test(u.default)) {
      errors.push('manifest.biomeUnderlay.default must be a /assets/... path.');
    } else {
      const ext = path.extname(u.default).toLowerCase();
      if (!allowedExt.has(ext)) {
        errors.push(`manifest.biomeUnderlay.default extension ${ext} is not allowed.`);
      }
      const fullPath = path.join(publicRoot, u.default.replace(/^\//, ''));
      if (!fs.existsSync(fullPath)) {
        errors.push(`manifest.biomeUnderlay.default not found on disk: ${u.default}`);
      }
    }
    if (u.themes !== undefined) {
      if (!u.themes || typeof u.themes !== 'object') {
        errors.push('manifest.biomeUnderlay.themes must be an object when provided.');
      } else {
        for (const [theme, p] of Object.entries(u.themes)) {
          if (typeof theme !== 'string' || theme.trim().length === 0) {
            errors.push('manifest.biomeUnderlay.themes contains an invalid theme key.');
            continue;
          }
          if (typeof p !== 'string' || !pathRe.test(p)) {
            errors.push(`manifest.biomeUnderlay.themes.${theme} must be a /assets/... path.`);
            continue;
          }
          const ext = path.extname(p).toLowerCase();
          if (!allowedExt.has(ext)) {
            errors.push(`manifest.biomeUnderlay.themes.${theme} extension ${ext} is not allowed.`);
          }
          const fullPath = path.join(publicRoot, p.replace(/^\//, ''));
          if (!fs.existsSync(fullPath)) {
            errors.push(`manifest.biomeUnderlay.themes.${theme} not found on disk: ${p}`);
          }
        }
      }
    }
    if (u.mode !== undefined && u.mode !== 'off' && u.mode !== 'cover' && u.mode !== 'repeat') {
      errors.push('manifest.biomeUnderlay.mode must be "off", "cover", or "repeat" when provided.');
    }
    if (u.scalePx !== undefined && (!Number.isFinite(u.scalePx) || u.scalePx <= 0)) {
      errors.push('manifest.biomeUnderlay.scalePx must be > 0 when provided.');
    }
    if (u.opacity !== undefined && (!Number.isFinite(u.opacity) || u.opacity < 0 || u.opacity > 1)) {
      errors.push('manifest.biomeUnderlay.opacity must be in [0, 1] when provided.');
    }
  }
}

if (!Array.isArray(manifest.layers)) {
  errors.push('manifest.layers must be an array.');
} else {
  for (const layer of requiredLayers) {
    if (!manifest.layers.includes(layer)) {
      errors.push(`manifest.layers missing required layer "${layer}".`);
    }
  }
}

if (!Array.isArray(manifest.assets)) {
  errors.push('manifest.assets must be an array.');
} else {
  const seenIds = new Set();
  for (let i = 0; i < manifest.assets.length; i++) {
    const asset = manifest.assets[i];
    const p = `assets[${i}]`;
    if (!asset || typeof asset !== 'object') {
      errors.push(`${p} must be an object.`);
      continue;
    }

    if (typeof asset.id !== 'string' || !idRe.test(asset.id)) {
      errors.push(`${p}.id is invalid; expected lowercase tokenized id.`);
    } else if (seenIds.has(asset.id)) {
      errors.push(`${p}.id duplicate: ${asset.id}`);
    } else {
      seenIds.add(asset.id);
    }

    if (!allowedTypes.has(asset.type)) {
      errors.push(`${p}.type is invalid (${String(asset.type)}).`);
    }

    if (!allowedLayers.has(asset.layer)) {
      errors.push(`${p}.layer is invalid (${String(asset.layer)}).`);
    }

    if (typeof asset.recommendedFormat !== 'string' || !allowedFormats.has(asset.recommendedFormat)) {
      errors.push(`${p}.recommendedFormat is invalid (${String(asset.recommendedFormat)}).`);
    } else {
      if (vectorOnlyTypes.has(asset.type) && asset.recommendedFormat !== 'svg') {
        errors.push(`${p}.recommendedFormat must be "svg" for ${asset.type}.`);
      }
      if (asset.type === 'tile' && !tileFormats.has(asset.recommendedFormat)) {
        errors.push(`${p}.recommendedFormat must be svg/webp/avif/png for tile.`);
      }
      if (asset.type === 'unit' && !unitFormats.has(asset.recommendedFormat)) {
        errors.push(`${p}.recommendedFormat must be webp/avif/png for unit.`);
      }
      if (asset.type === 'fx' && !fxFormats.has(asset.recommendedFormat)) {
        errors.push(`${p}.recommendedFormat must be svg/webp/avif/png for fx.`);
      }
    }

    if (typeof asset.path !== 'string' || !pathRe.test(asset.path)) {
      errors.push(`${p}.path is invalid (${String(asset.path)}).`);
    } else {
      const ext = path.extname(asset.path).toLowerCase();
      if (!allowedExt.has(ext)) {
        errors.push(`${p}.path extension ${ext} is not allowed.`);
      }
      if (typeof asset.recommendedFormat === 'string') {
        const normalizedExt = ext.startsWith('.') ? ext.slice(1) : ext;
        if (allowedFormats.has(asset.recommendedFormat) && normalizedExt !== asset.recommendedFormat) {
          warnings.push(`${p} format mismatch: recommendedFormat=${asset.recommendedFormat} but path extension is ${normalizedExt}.`);
        }
      }
      const fullPath = path.join(publicRoot, asset.path.replace(/^\//, ''));
      if (!fs.existsSync(fullPath)) {
        errors.push(`${p}.path not found on disk: ${asset.path}`);
      }
    }

    if (!Number.isFinite(asset.width) || asset.width <= 0) {
      errors.push(`${p}.width must be > 0.`);
    }
    if (!Number.isFinite(asset.height) || asset.height <= 0) {
      errors.push(`${p}.height must be > 0.`);
    }

    if (asset.type === 'tile' && Number.isFinite(asset.width) && Number.isFinite(asset.height)) {
      const ratio = asset.width / Math.max(1, asset.height);
      const drift = Math.abs(ratio - manifest.tileAspectRatio);
      if (drift > 0.08) {
        warnings.push(`${p} has non-standard tile ratio (${ratio.toFixed(3)} vs ${manifest.tileAspectRatio}).`);
      }
    }
  }
}

if (Array.isArray(manifest.assets) && manifest.assets.length === 0) {
  warnings.push('manifest.assets is empty (scaffolding mode).');
}

if (errors.length > 0) {
  console.error('[asset-manifest] Validation failed:');
  for (const e of errors) {
    console.error(`- ${e}`);
  }
  if (warnings.length > 0) {
    console.error('[asset-manifest] Warnings:');
    for (const w of warnings) console.error(`- ${w}`);
  }
  process.exit(1);
}

console.log(`[asset-manifest] OK: ${manifest.assets.length} assets validated.`);
if (warnings.length > 0) {
  console.log('[asset-manifest] Warnings:');
  for (const w of warnings) console.log(`- ${w}`);
}
