import React, { useRef, useEffect } from 'react';
import { GpsState, NavState, Waypoint, calculateDistance } from '../simulator/gpsSimulator';

interface TFTDisplayProps {
  currentWindow: number;
  gps: GpsState;
  nav: NavState;
  waypoints: Waypoint[];
  breadcrumbs: Array<{ lat: number; lon: number }>;
  zoomMeters: number;
  brightnessPercent: number;
  selectedWpIndex: number;
  onSelectWaypoint?: (index: number) => void;
}

export const TFTDisplay: React.FC<TFTDisplayProps> = ({
  currentWindow,
  gps,
  nav,
  waypoints,
  breadcrumbs,
  zoomMeters,
  brightnessPercent,
  selectedWpIndex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render on 128x160 canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset transform & disable smoothing for sharp pixelated LCD look
    ctx.imageSmoothingEnabled = false;

    // Clear Screen
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 160);

    // =========================================================================
    // 1. TOP STATUS BAR (y=0 to 14)
    // =========================================================================
    ctx.fillStyle = '#0a192f'; // Dark Navy Blue
    ctx.fillRect(0, 0, 128, 14);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 14.5);
    ctx.lineTo(128, 14.5);
    ctx.stroke();

    // Fix Indicator Box
    ctx.fillStyle = gps.validFix ? '#20ff20' : '#ff2222';
    ctx.fillRect(2, 3, 4, 8);

    // Window Tag
    const winNames = ['HUD', 'MAP', 'TRP', 'SAT', 'WPT', 'SET', 'SEA'];
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(winNames[currentWindow] || 'NAV', 8, 10);

    // Satellite Count
    ctx.fillStyle = '#00ffff';
    ctx.font = '8px monospace';
    ctx.fillText(`${gps.satellitesInUse}S`, 40, 10);

    // Time (HH:MM:SS) with compact font and seconds
    const hours = gps.utcTime.getUTCHours().toString().padStart(2, '0');
    const mins = gps.utcTime.getUTCMinutes().toString().padStart(2, '0');
    const secs = gps.utcTime.getUTCSeconds().toString().padStart(2, '0');
    ctx.fillStyle = '#ffa800';
    ctx.font = '7.5px monospace';
    ctx.fillText(`${hours}:${mins}:${secs}`, 68, 10);

    // =========================================================================
    // 2. WINDOW CONTENT (y=15 to 160)
    // =========================================================================
    if (currentWindow === 0) {
      renderHUDWindow(ctx, gps, nav);
    } else if (currentWindow === 1) {
      renderMapWindow(ctx, gps, nav, waypoints, breadcrumbs, zoomMeters);
    } else if (currentWindow === 2) {
      renderTripWindow(ctx, gps, nav);
    } else if (currentWindow === 3) {
      renderSatelliteWindow(ctx, gps);
    } else if (currentWindow === 4) {
      renderWaypointWindow(ctx, gps, nav, waypoints, selectedWpIndex);
    } else if (currentWindow === 5) {
      renderSettingsWindow(ctx, gps);
    } else if (currentWindow === 6) {
      renderMarineWindow(ctx, gps, nav);
    }
  }, [currentWindow, gps, nav, waypoints, breadcrumbs, zoomMeters, selectedWpIndex]);

  return (
    <div className="relative inline-block select-none">
      {/* 1.8" TFT Screen Bezel and Chassis */}
      <div className="relative p-3 bg-zinc-900 rounded-xl shadow-2xl border-4 border-zinc-700/80">
        {/* Metallic Bezel Header */}
        <div className="flex items-center justify-between px-1 pb-1.5 text-[10px] font-mono text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ST7735R SPI
          </span>
          <span className="text-zinc-500 tracking-wider">128x160 RGB565</span>
        </div>

        {/* Display Glass Window */}
        <div className="relative rounded overflow-hidden bg-black ring-2 ring-black/80 shadow-inner">
          <canvas
            ref={canvasRef}
            width={128}
            height={160}
            className="block w-[256px] h-[320px] rendering-pixelated"
            style={{
              imageRendering: 'pixelated',
              filter: `brightness(${Math.max(0.2, brightnessPercent / 100)})`,
            }}
          />

          {/* Authentic LCD Glass Glare & Scanline Texture */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-cyan-300/[0.06]" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.75) 50%)',
              backgroundSize: '100% 2px',
            }}
          />
        </div>

        {/* Screen Bottom Legend / Pinout Summary */}
        <div className="mt-2 pt-1 border-t border-zinc-800 flex justify-between items-center text-[9px] font-mono text-zinc-400">
          <span>Pins: CLK DIN D/C CS RST BL</span>
          <span className="text-cyan-400">GT-U7 9600bd</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SUB-RENDERERS FOR EACH WINDOW
// =============================================================================

function renderHUDWindow(ctx: CanvasRenderingContext2D, gps: GpsState, nav: NavState) {
  // 1. Dual Speed Panel (Time is in Header Status Bar!)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(4, 17, 120, 28);
  ctx.strokeStyle = '#1e293b';
  ctx.strokeRect(4, 17, 120, 28);

  const speedKmhStr = formatSpeed(gps.speedKmh, ' KM/H');
  const knotsStr = formatSpeed(gps.speedKmh / 1.852, ' KNOTS');
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`SPD: ${speedKmhStr}`, 8, 27);
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`     ${knotsStr}`, 8, 39);

  // 2. Compass Rose Dial
  const cx = 64;
  const cy = 73;
  const radius = 23;

  // Compass ring
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Cardinal labels
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = '#ef4444'; // Red North
  ctx.fillText('N', cx - 3, cy - radius + 7);
  ctx.fillStyle = '#64748b';
  ctx.fillText('S', cx - 3, cy + radius - 1);
  ctx.fillText('W', cx - radius + 2, cy + 3);
  ctx.fillText('E', cx + radius - 7, cy + 3);

  // Center hub
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  // Actual Course Pointer Arrow (Heading in Cyan)
  const courseRad = ((gps.courseDeg - 90) * Math.PI) / 180;
  const hx = cx + (radius - 5) * Math.cos(courseRad);
  const hy = cy + (radius - 5) * Math.sin(courseRad);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  // Destination Bearing pointer line (Neon Green)
  if (nav.target) {
    const brgRad = ((nav.bearingToTargetDeg - 90) * Math.PI) / 180;
    const bx = cx + (radius - 5) * Math.cos(brgRad);
    const by = cy + (radius - 5) * Math.sin(brgRad);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 3. Target Waypoint & Bearing/Course Info Box (Separate lines, smaller font, zero overlap!)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(4, 103, 120, 54);
  ctx.strokeStyle = '#1e293b';
  ctx.strokeRect(4, 103, 120, 54);

  ctx.font = '7.5px monospace';
  const targetName = nav.target ? nav.target.name.substring(0, 7) : 'NONE';
  ctx.fillStyle = '#facc15';
  ctx.fillText(`WP : ${targetName}`, 8, 115);

  const distKm = nav.distanceToTargetM / 1000;
  const distStr = formatDistance(distKm, 'km');
  ctx.fillStyle = '#22c55e';
  ctx.fillText(`DST: ${distStr}`, 8, 127);

  ctx.fillStyle = '#22c55e';
  ctx.fillText(`BRG: ${Math.round(nav.bearingToTargetDeg).toString().padStart(3, '0')} deg`, 8, 139);

  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`CRS: ${Math.round(gps.courseDeg).toString().padStart(3, '0')} deg`, 8, 151);
}

function renderMapWindow(
  ctx: CanvasRenderingContext2D,
  gps: GpsState,
  nav: NavState,
  waypoints: Waypoint[],
  breadcrumbs: Array<{ lat: number; lon: number }>,
  zoomMeters: number
) {
  const yOffset = 15;
  const w = 128;
  const h = 145;
  const cx = w / 2;
  const cy = yOffset + h / 2;

  // Grid Crosshairs
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 15, cy);
  ctx.lineTo(cx + 15, cy);
  ctx.moveTo(cx, cy - 15);
  ctx.lineTo(cx, cy + 15);
  ctx.stroke();

  // Range Ring (half zoom radius)
  const ringR = Math.floor(h / 3);
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  // North Reference Indicator Line (Center to True North)
  const northY = Math.max(yOffset + 5, cy - 36);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, northY);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('N', cx - 3, northY - 2);

  const metersPerPixel = zoomMeters / h;

  const latlonToScreen = (lat: number, lon: number) => {
    const dy = (lat - gps.latitude) * 111320.0;
    const dx = (lon - gps.longitude) * 111320.0 * Math.cos((gps.latitude * Math.PI) / 180);
    const sx = cx + dx / metersPerPixel;
    const sy = cy - dy / metersPerPixel;
    return { sx, sy };
  };

  // Breadcrumbs Trail
  if (breadcrumbs.length > 1) {
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (const pt of breadcrumbs) {
      const { sx, sy } = latlonToScreen(pt.lat, pt.lon);
      if (sx >= -10 && sx <= w + 10 && sy >= yOffset - 10 && sy <= yOffset + h + 10) {
        if (!started) {
          ctx.moveTo(sx, sy);
          started = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      }
    }
    ctx.stroke();
  }

  // Draw Waypoints (skip unfixed slots with 0,0 coordinates)
  waypoints.forEach((wp) => {
    if (wp.isFixed === false || (wp.lat === 0 && wp.lon === 0)) return;
    const { sx, sy } = latlonToScreen(wp.lat, wp.lon);
    if (sx >= -20 && sx <= w + 20 && sy >= yOffset - 20 && sy <= yOffset + h + 20) {
      const isTarget = nav.target && nav.target.name === wp.name;
      ctx.fillStyle = isTarget ? '#facc15' : '#f97316';

      // Diamond marker
      ctx.beginPath();
      ctx.moveTo(sx, sy - 3);
      ctx.lineTo(sx + 3, sy);
      ctx.lineTo(sx, sy + 3);
      ctx.lineTo(sx - 3, sy);
      ctx.closePath();
      ctx.fill();

      // Waypoint Name
      ctx.font = '8px monospace';
      ctx.fillStyle = isTarget ? '#fde047' : '#fed7aa';
      ctx.fillText(wp.name.substring(0, 4), sx + 4, sy + 2);

      // Direct line to active target
      if (isTarget) {
        ctx.strokeStyle = '#22c55e';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  });

  // User Heading Arrow (Carrot) at center
  const rad = ((gps.courseDeg - 90) * Math.PI) / 180;
  const arrowLen = 8;
  const tipX = cx + arrowLen * Math.cos(rad);
  const tipY = cy + arrowLen * Math.sin(rad);
  const leftX = cx + arrowLen * 0.7 * Math.cos(rad + 2.5);
  const leftY = cy + arrowLen * 0.7 * Math.sin(rad + 2.5);
  const rightX = cx + arrowLen * 0.7 * Math.cos(rad - 2.5);
  const rightY = cy + arrowLen * 0.7 * Math.sin(rad - 2.5);

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(cx, cy);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fill();

  // Bottom Map Legend
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(2, 146, 56, 12);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(2, 146, 56, 12);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 8px monospace';
  const scaleStr = zoomMeters < 1000 ? `${zoomMeters}m` : `${(zoomMeters / 1000).toFixed(1)}k`;
  ctx.fillText(`ZOOM:${scaleStr}`, 4, 155);
}

function renderTripWindow(ctx: CanvasRenderingContext2D, gps: GpsState, nav: NavState) {
  const movStr = formatTripTime(nav.movingTimeSec);
  const stpStr = formatTripTime(nav.stoppedTimeSec);
  const remStr = formatDistance(nav.distanceToTargetM / 1000, 'km');
  const odoStr = formatDistance(nav.odometerM / 1000, 'km');
  const altStr = formatAltitude(gps.altitudeM);
  const spdStr = formatSpeed(nav.avgMovingSpeedKmh, 'kph');

  const items = [
    { label: 'AVG SPD', val: spdStr, color: '#22c55e' },
    { label: 'MOV TM', val: movStr, color: '#ffffff' },
    { label: 'STP TM', val: stpStr, color: '#94a3b8' },
    { label: 'ALT', val: altStr, color: '#f59e0b' },
    { label: 'ODO', val: odoStr, color: '#facc15' },
    { label: 'COURSE', val: `${Math.round(gps.courseDeg).toString().padStart(3, '0')} deg`, color: '#38bdf8' },
    { label: 'REM DST', val: remStr, color: '#22c55e' },
    { label: 'BEARING', val: `${Math.round(nav.bearingToTargetDeg).toString().padStart(3, '0')} deg`, color: '#facc15' },
  ];

  ctx.font = '8px monospace';
  let y = 28;
  items.forEach((item) => {
    ctx.fillStyle = '#64748b';
    ctx.fillText(item.label, 2, y);
    ctx.fillStyle = item.color;
    ctx.fillText(item.val, 62, y);
    y += 16;
  });
}

function renderSatelliteWindow(ctx: CanvasRenderingContext2D, gps: GpsState) {
  // Polar Skyplot Circle
  const cx = 36;
  const cy = 54;
  const r = 26;

  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();

  // Draw Satellites on Skyplot
  gps.satellites.slice(0, 10).forEach((sat) => {
    const dist = (r * (90 - sat.elev)) / 90;
    const rad = ((sat.azim - 90) * Math.PI) / 180;
    const sx = cx + dist * Math.cos(rad);
    const sy = cy + dist * Math.sin(rad);

    ctx.fillStyle = sat.snr > 32 ? '#22c55e' : sat.snr > 18 ? '#facc15' : '#ef4444';
    ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
  });

  // Telemetry details
  ctx.font = '8px monospace';
  ctx.fillStyle = gps.validFix ? '#22c55e' : '#ef4444';
  ctx.fillText(`FIX: ${gps.fixMode}D FIX`, 72, 28);

  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`SATS: ${gps.satellitesInUse}/${gps.satellitesInView}`, 72, 42);

  ctx.fillStyle = '#f59e0b';
  ctx.fillText(`HDOP: ${gps.hdop.toFixed(2)}`, 72, 56);

  ctx.fillStyle = '#ffffff';
  const altFourDigits = Math.max(0, Math.round(gps.altitudeM)).toString().padStart(4, '0');
  ctx.fillText(`ALT : ${altFourDigits}m`, 72, 70);

  // Bottom SNR Bar Graph
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(4, 88);
  ctx.lineTo(124, 88);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.fillText('SIGNAL SNR (dB-Hz)', 6, 99);

  let bx = 6;
  gps.satellites.slice(0, 9).forEach((sat) => {
    const barH = Math.min(42, Math.floor((sat.snr / 50) * 42));
    ctx.fillStyle = sat.snr > 32 ? '#22c55e' : sat.snr > 18 ? '#facc15' : '#ef4444';
    ctx.fillRect(bx, 150 - barH, 9, barH);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '7px monospace';
    ctx.fillText(sat.prn.toString(), bx + 1, 158);
    bx += 13;
  });
}

function renderWaypointWindow(
  ctx: CanvasRenderingContext2D,
  gps: GpsState,
  nav: NavState,
  waypoints: Waypoint[],
  selectedIdx: number
) {
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('WAYPOINTS (SEL=GO)', 6, 26);

  let y = 38;
  waypoints.slice(0, 4).forEach((wp, idx) => {
    const isSelected = idx === selectedIdx;
    const isActiveTarget = nav.target && nav.target.name === wp.name;

    if (isSelected) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(4, y - 2, 120, 18);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(4, y - 2, 120, 18);
    }

    const isFixedSlot = wp.name.startsWith('FIX');
    const hasFix = wp.isFixed ?? (!isFixedSlot || (wp.lat !== 0 && wp.lon !== 0));

    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = isActiveTarget
      ? '#22c55e'
      : isFixedSlot
      ? (hasFix ? '#38bdf8' : '#94a3b8')
      : '#ffffff';
    const marker = isActiveTarget ? '▶' : isSelected ? '●' : ' ';
    ctx.fillText(`${marker}${wp.name.padEnd(6, ' ')}`, 6, y + 10);

    if (isFixedSlot && !hasFix) {
      ctx.fillStyle = '#64748b';
      ctx.fillText('--.- km', 70, y + 10);
    } else {
      const distKm = calculateDistance(gps.latitude, gps.longitude, wp.lat, wp.lon) / 1000;
      ctx.fillStyle = isActiveTarget ? '#22c55e' : '#38bdf8';
      ctx.fillText(formatDistance(distKm, 'km'), 70, y + 10);
    }

    y += 20;
  });

  ctx.fillStyle = '#94a3b8';
  ctx.font = '7px monospace';
  ctx.fillText('[SEL] Cycle / Select', 6, 136);
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('[HOLD] Fix Cur Pos', 6, 148);
}

function renderSettingsWindow(ctx: CanvasRenderingContext2D, gps: GpsState) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('SYSTEM & SPECS', 6, 26);

  const configs = [
    { label: 'MCU', val: 'ESP32-C3 160MHz', color: '#38bdf8' },
    { label: 'GPS', val: 'GT-U7 (9600 8N1)', color: '#38bdf8' },
    { label: 'TFT', val: 'ST7735R 1.8" SPI', color: '#38bdf8' },
    { label: 'PINS', val: 'CLK DIN DC CS RST', color: '#38bdf8' },
    { label: 'RATE', val: '1 Hz NMEA-0183', color: '#22c55e' },
    { label: 'LOG', val: '/route.gpx', color: '#22c55e' },
    { label: 'HEAP', val: 'Free 218 KB', color: '#ffffff' },
  ];

  ctx.font = '8px monospace';
  let y = 42;
  configs.forEach((item) => {
    ctx.fillStyle = '#64748b';
    ctx.fillText(item.label, 6, y);
    ctx.fillStyle = item.color;
    ctx.fillText(item.val, 42, y);
    y += 16;
  });
}

function formatDMS(degFloat: number, isLat: boolean): string {
  if (degFloat === 0) {
    return isLat ? `00°00'00"N` : `000°00'00"E`;
  }
  const direction = (degFloat >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W'));
  const dAbs = Math.abs(degFloat);
  const deg = Math.floor(dAbs);
  const minFloat = (dAbs - deg) * 60;
  const minutes = Math.floor(minFloat);
  const sec = Math.floor((minFloat - minutes) * 60);
  const degStr = isLat ? deg.toString().padStart(2, '0') : deg.toString().padStart(3, '0');
  return `${degStr}°${minutes.toString().padStart(2, '0')}'${sec.toString().padStart(2, '0')}"${direction}`;
}

function formatSpeed(val: number, unit = 'kph'): string {
  const safeVal = Math.max(0, isNaN(val) ? 0 : val);
  const parts = safeVal.toFixed(1).split('.');
  const intPart = parts[0].padStart(2, '0');
  return `${intPart}.${parts[1]}${unit}`;
}

function formatDistance(dist: number, unit = 'km'): string {
  const safeDist = Math.max(0, isNaN(dist) ? 0 : dist);
  const parts = safeDist.toFixed(1).split('.');
  const intPart = parts[0].padStart(3, '0');
  return `${intPart}.${parts[1]} ${unit}`;
}

function formatAltitude(altM: number): string {
  const safeAlt = Math.max(0, isNaN(altM) ? 0 : altM);
  const parts = safeAlt.toFixed(1).split('.');
  const intPart = parts[0].padStart(4, '0');
  return `${intPart}.${parts[1]} m`;
}

function formatTripTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(isNaN(totalSec) ? 0 : totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTwoIntOneDec(val: number): string {
  const safeVal = Math.max(0, isNaN(val) ? 0 : val);
  const parts = safeVal.toFixed(1).split('.');
  return `${parts[0].padStart(2, '0')}.${parts[1]}`;
}

function renderMarineWindow(ctx: CanvasRenderingContext2D, gps: GpsState, nav: NavState) {
  // Conversions: 1 NM = 1852 meters
  const speedKnVal = gps.speedKmh / 1.852;
  const odoNmVal = nav.odometerM / 1852;
  const remNmVal = nav.distanceToTargetM / 1852;
  const vmgKnVal = nav.vmgKmh / 1.852;
  const avgKnVal = nav.movingTimeSec > 0 ? nav.odometerM / 1852 / (nav.movingTimeSec / 3600) : 0.0;

  const rows = [
    { label: 'SPD', val: `${formatSpeed(speedKnVal, ' kn')}`, col: '#ffffff' },
    { label: 'AVG SPD', val: `${formatSpeed(avgKnVal, ' kn')}`, col: '#22c55e' },
    { label: 'ODO DST', val: `${formatDistance(odoNmVal, 'NM')}`, col: '#facc15' },
    { label: 'REM DST', val: `${formatDistance(remNmVal, 'NM')}`, col: '#38bdf8' },
    {
      label: 'BRG/CRS',
      val: `${Math.round(nav.bearingToTargetDeg).toString().padStart(3, '0')}°/${Math.round(gps.courseDeg).toString().padStart(3, '0')}°`,
      col: '#ffffff',
    },
  ];

  ctx.font = '6.5px monospace'; // Smaller letters as requested
  let y = 26;
  rows.forEach((r) => {
    ctx.fillStyle = '#64748b';
    ctx.fillText(r.label, 4, y);
    ctx.fillStyle = r.col;
    ctx.fillText(r.val, 62, y);
    y += 13;
  });

  // Position DMS Section
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(4, y - 1);
  ctx.lineTo(124, y - 1);
  ctx.stroke();

  ctx.fillStyle = '#00ffff';
  ctx.font = 'bold 6.5px monospace';
  ctx.fillText('POSITION (DMS)', 4, y + 9);

  ctx.font = '6.5px monospace'; // Smaller letters as requested
  ctx.fillStyle = '#f59e0b';
  // LAT strictly has 2 spaces for degrees, LON has 3 spaces
  ctx.fillText(`LAT: ${formatDMS(gps.latitude, true)}`, 2, y + 21);
  ctx.fillText(`LON: ${formatDMS(gps.longitude, false)}`, 2, y + 33);

  // VMG Section below (WP eliminated, SPEED -> SPD, 2 int + 1 dec)
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(4, y + 40);
  ctx.lineTo(124, y + 40);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '6.5px monospace';
  ctx.fillText('VMG SPD:', 4, y + 50);

  ctx.fillStyle = '#22c55e';
  ctx.font = 'bold 6.5px monospace';
  ctx.fillText(`${formatSpeed(vmgKnVal, ' kn')}`, 62, y + 50);
}


