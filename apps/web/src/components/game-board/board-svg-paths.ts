type SvgPoint = { x: number; y: number };

export const parseSvgPointList = (points: string): SvgPoint[] => {
  const trimmed = points.trim();
  if (!trimmed) return [];

  return trimmed
    .split(/\s+/)
    .map((token) => {
      const [x, y] = token.split(',').map(Number);
      return { x, y };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
};

const formatNumber = (value: number): string => Number(value.toFixed(2)).toString();

export const buildTranslatedPolygonPath = (
  origins: ReadonlyArray<SvgPoint>,
  polygonPoints: ReadonlyArray<SvgPoint>,
): string => {
  if (origins.length === 0 || polygonPoints.length === 0) return '';

  const parts: string[] = [];
  for (const origin of origins) {
    const firstPoint = polygonPoints[0]!;
    parts.push(`M${formatNumber(origin.x + firstPoint.x)} ${formatNumber(origin.y + firstPoint.y)}`);
    for (let index = 1; index < polygonPoints.length; index += 1) {
      const point = polygonPoints[index]!;
      parts.push(`L${formatNumber(origin.x + point.x)} ${formatNumber(origin.y + point.y)}`);
    }
    parts.push('Z');
  }
  return parts.join(' ');
};
