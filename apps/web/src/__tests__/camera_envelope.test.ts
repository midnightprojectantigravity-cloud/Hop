import { describe, expect, it } from 'vitest';
import { clampCameraCenter, computeViewBoxFromCamera } from '../visual/camera';
import {
  clampCameraCenterToEnvelope,
  createCameraEnvelope,
  estimateCameraDeadSpaceRatio
} from '../visual/camera-envelope';

const hex = (q: number, r: number, s = -q - r) => ({ q, r, s });

describe('camera envelope', () => {
  it('reduces dead space on irregular board shapes compared with rectangle-only clamping', () => {
    const cells = [
      hex(0, 0),
      hex(1, 0),
      hex(2, 0),
      hex(3, 0),
      hex(0, 1),
      hex(0, 2),
      hex(0, 3)
    ];
    const envelope = createCameraEnvelope(cells, 24);
    const visibleWorldSize = { width: 120, height: 120 };
    const desiredCenter = { x: 90, y: 80 };
    const rectangularCenter = clampCameraCenter(desiredCenter, visibleWorldSize, envelope.bounds);
    const clampedCenter = clampCameraCenterToEnvelope(desiredCenter, visibleWorldSize, envelope);

    const naiveViewBox = computeViewBoxFromCamera(rectangularCenter, visibleWorldSize);
    const clampedViewBox = computeViewBoxFromCamera(clampedCenter, visibleWorldSize);

    expect(estimateCameraDeadSpaceRatio(clampedViewBox, envelope)).toBeLessThan(
      estimateCameraDeadSpaceRatio(naiveViewBox, envelope)
    );
  });

  it('keeps an edge player visible while tightening horizontal slack', () => {
    const cells = [
      hex(0, 0),
      hex(1, 0),
      hex(2, 0),
      hex(3, 0),
      hex(0, 1),
      hex(0, 2)
    ];
    const envelope = createCameraEnvelope(cells, 24);
    const visibleWorldSize = { width: 160, height: 120 };
    const edgeCenter = clampCameraCenterToEnvelope({ x: 108, y: 0 }, visibleWorldSize, envelope);
    const viewBox = computeViewBoxFromCamera(edgeCenter, visibleWorldSize);

    expect(108).toBeGreaterThanOrEqual(viewBox.x);
    expect(108).toBeLessThanOrEqual(viewBox.x + viewBox.width);
    expect(viewBox.x).toBeLessThanOrEqual(envelope.bounds.x + envelope.bounds.width);
  });

  it('centers maps smaller than the viewport without oscillating', () => {
    const cells = [hex(0, 0), hex(1, 0)];
    const envelope = createCameraEnvelope(cells, 24);
    const visibleWorldSize = { width: 240, height: 200 };
    const first = clampCameraCenterToEnvelope({ x: 0, y: 0 }, visibleWorldSize, envelope);
    const second = clampCameraCenterToEnvelope(first, visibleWorldSize, envelope);

    expect(first).toEqual(second);
    expect(first.x).toBeCloseTo(envelope.centroid.x, 8);
    expect(first.y).toBeCloseTo(envelope.centroid.y, 8);
  });
});
