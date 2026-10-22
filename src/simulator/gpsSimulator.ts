/**
 * Real-time GPS and Navigation Simulation Engine for GT-U7 + ST7735R emulator.
 */

export interface SatelliteInfo {
  prn: number;
  elev: number;
  azim: number;
  snr: number;
}

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
  desc?: string;
  isFixed?: boolean;
}

export interface GpsState {
  validFix: boolean;
  latitude: number;
  longitude: number;
  altitudeM: number;
  speedKmh: number;
  courseDeg: number;
  satellitesInUse: number;
  satellitesInView: number;
  fixMode: '1' | '2' | '3'; // 1=No fix, 2=2D, 3=3D
  hdop: number;
  utcTime: Date;
  satellites: SatelliteInfo[];
  rawNmeaSentence: string;
}

export interface NavState {
  target: Waypoint | null;
  distanceToTargetM: number;
  bearingToTargetDeg: number;
  relativeBearingDeg: number;
  crossTrackErrorM: number;
  vmgKmh: number;
  etaSeconds: number;
  tripDistanceM: number;
  odometerM: number;
  maxSpeedKmh: number;
  avgMovingSpeedKmh: number;
  movingTimeSec: number;
  stoppedTimeSec: number;
}

export const DEFAULT_PRESET_WAYPOINTS: Waypoint[] = [
  { name: 'WP1', lat: 37.7749, lon: -122.4194, desc: 'Predefined Waypoint 1', isFixed: true },
  { name: 'WP2', lat: 37.7850, lon: -122.4080, desc: 'Predefined Waypoint 2', isFixed: true },
  { name: 'FIX1', lat: 0, lon: 0, desc: 'Fixed Slot 1 (Empty - Hold to Fix)', isFixed: false },
  { name: 'FIX2', lat: 0, lon: 0, desc: 'Fixed Slot 2 (Empty - Hold to Fix)', isFixed: false },
];

export const INITIAL_SATELLITES: SatelliteInfo[] = [
  { prn: 3, elev: 68, azim: 42, snr: 44 },
  { prn: 8, elev: 45, azim: 110, snr: 39 },
  { prn: 14, elev: 78, azim: 210, snr: 48 },
  { prn: 17, elev: 32, azim: 290, snr: 36 },
  { prn: 21, elev: 55, azim: 160, snr: 42 },
  { prn: 22, elev: 24, azim: 75, snr: 28 },
  { prn: 27, elev: 18, azim: 320, snr: 25 },
  { prn: 31, elev: 62, azim: 350, snr: 41 },
  { prn: 65, elev: 48, azim: 135, snr: 38 }, // GLONASS
  { prn: 72, elev: 39, azim: 245, snr: 34 }, // GLONASS
];

// Great Circle Haversine formula
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Initial Bearing formula
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

// Cross Track Error formula
export function calculateXTE(
  latStart: number,
  lonStart: number,
  latEnd: number,
  lonEnd: number,
  latCur: number,
  lonCur: number
): number {
  const R = 6371000;
  const d13 = calculateDistance(latStart, lonStart, latCur, lonCur) / R;
  const theta13 = (calculateBearing(latStart, lonStart, latCur, lonCur) * Math.PI) / 180;
  const theta12 = (calculateBearing(latStart, lonStart, latEnd, lonEnd) * Math.PI) / 180;

  const dxt = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12));
  return dxt * R;
}

// Generate valid NMEA checksum
export function generateNmeaChecksum(sentenceWithoutDollar: string): string {
  let chk = 0;
  for (let i = 0; i < sentenceWithoutDollar.length; i++) {
    chk ^= sentenceWithoutDollar.charCodeAt(i);
  }
  const hex = chk.toString(16).toUpperCase();
  return hex.length === 1 ? '0' + hex : hex;
}

// Format decimal degrees to NMEA ddmm.mmmm
export function formatNmeaCoord(val: number, isLat: boolean): { str: string; dir: string } {
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
  const abs = Math.abs(val);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const degStr = isLat
    ? deg.toString().padStart(2, '0')
    : deg.toString().padStart(3, '0');
  const minStr = min.toFixed(4).padStart(7, '0');
  return { str: `${degStr}${minStr}`, dir };
}

// Create authentic NMEA $GNRMC sentence
export function generateGNRMC(gps: GpsState): string {
  const d = gps.utcTime;
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  const timeStr = `${hh}${mm}${ss}.00`;

  const status = gps.validFix ? 'A' : 'V';
  const latInfo = formatNmeaCoord(gps.latitude, true);
  const lonInfo = formatNmeaCoord(gps.longitude, false);
  const speedKnots = (gps.speedKmh / 1.852).toFixed(2);
  const courseStr = gps.courseDeg.toFixed(1);

  const day = d.getUTCDate().toString().padStart(2, '0');
  const mon = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const yr = (d.getUTCFullYear() % 100).toString().padStart(2, '0');
  const dateStr = `${day}${mon}${yr}`;

  const body = `GNRMC,${timeStr},${status},${latInfo.str},${latInfo.dir},${lonInfo.str},${lonInfo.dir},${speedKnots},${courseStr},${dateStr},,,A`;
  return `$${body}*${generateNmeaChecksum(body)}`;
}

// Create authentic NMEA $GNGGA sentence
export function generateGNGGA(gps: GpsState): string {
  const d = gps.utcTime;
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  const timeStr = `${hh}${mm}${ss}.00`;

  const latInfo = formatNmeaCoord(gps.latitude, true);
  const lonInfo = formatNmeaCoord(gps.longitude, false);
  const fixQuality = gps.validFix ? '1' : '0';
  const sats = gps.satellitesInUse.toString().padStart(2, '0');
  const hdop = gps.hdop.toFixed(2);
  const alt = gps.altitudeM.toFixed(1);

  const body = `GNGGA,${timeStr},${latInfo.str},${latInfo.dir},${lonInfo.str},${lonInfo.dir},${fixQuality},${sats},${hdop},${alt},M,0.0,M,,`;
  return `$${body}*${generateNmeaChecksum(body)}`;
}
