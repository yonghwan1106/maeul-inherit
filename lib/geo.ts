// Haversine distance and lat/lon -> SVG projection. No map library (spec section 2).

const R_EARTH_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle (straight-line) distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface LatLon { lat: number; lon: number }
export interface BBox { minLat: number; maxLat: number; minLon: number; maxLon: number }

export function distKm(a: LatLon, b: LatLon): number {
  return haversineKm(a.lat, a.lon, b.lat, b.lon);
}

/** Bounding box of points that have coordinates (points without lat/lon are skipped). */
export function bboxOf(pts: Array<Partial<LatLon>>, padRatio = 0): BBox {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of pts) {
    if (typeof p.lat !== "number" || typeof p.lon !== "number") continue;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  if (!Number.isFinite(minLat)) return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
  const dLat = (maxLat - minLat) * padRatio;
  const dLon = (maxLon - minLon) * padRatio;
  return { minLat: minLat - dLat, maxLat: maxLat + dLat, minLon: minLon - dLon, maxLon: maxLon + dLon };
}

export interface Projector {
  (lat: number, lon: number): { x: number; y: number };
  width: number;
  height: number;
}

/**
 * Equirectangular projection scaled by cos(center latitude), fitted into width x height
 * with `pad` px margin, aspect ratio preserved and centred. North is up.
 */
export function makeProjector(bbox: BBox, width: number, height: number, pad = 16): Projector {
  const lat0 = toRad((bbox.minLat + bbox.maxLat) / 2);
  const kx = Math.cos(lat0);
  const spanX = Math.max((bbox.maxLon - bbox.minLon) * kx, 1e-9);
  const spanY = Math.max(bbox.maxLat - bbox.minLat, 1e-9);
  const s = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * s) / 2;
  const offY = (height - spanY * s) / 2;
  const f = ((lat: number, lon: number) => ({
    x: offX + (lon - bbox.minLon) * kx * s,
    y: offY + (bbox.maxLat - lat) * s,
  })) as Projector;
  f.width = width;
  f.height = height;
  return f;
}
