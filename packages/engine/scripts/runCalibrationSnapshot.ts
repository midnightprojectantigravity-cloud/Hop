import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getCalibrationProfile } from '../src/systems/calibration';
import { computeEvaluatorBaselines } from '../src/systems/evaluation-baselines';

const outFile = process.argv[2] || 'docs/UPA_CALIBRATION_SNAPSHOT.json';
const calibrationVersion = process.argv[3] || 'cal-v1';
const modelVersion = process.argv[4] || 'uel-v1';

const calibration = getCalibrationProfile(calibrationVersion);
const baselines = computeEvaluatorBaselines(modelVersion, calibration.version);

const payload = {
    calibration,
    evaluatorBaselines: baselines
};

const target = resolve(process.cwd(), outFile);
writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({
    wrote: target,
    calibrationVersion: calibration.version,
    modelVersion: baselines.modelVersion
}, null, 2));
