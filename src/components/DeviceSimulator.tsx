import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Navigation,
  Compass,
  MapPin,
  Sliders,
  Radio,
  Clock,
  Gauge,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  PlusCircle,
  Zap,
  Download,
  X,
  Plus,
  Crosshair,
  Check,
  Trash2,
} from 'lucide-react';
import { TFTDisplay } from './TFTDisplay';
import {
  GpsState,
  NavState,
  Waypoint,
  DEFAULT_PRESET_WAYPOINTS,
  INITIAL_SATELLITES,
  calculateDistance,
  calculateBearing,
  calculateXTE,
  generateGNRMC,
  generateGNGGA,
} from '../simulator/gpsSimulator';

export const DeviceSimulator: React.FC = () => {
  // Device Screen State
  const [currentWindow, setCurrentWindow] = useState<number>(0);
  const [zoomMeters, setZoomMeters] = useState<number>(500);
  const [brightnessPercent, setBrightnessPercent] = useState<number>(100);
  const [selectedWpIndex, setSelectedWpIndex] = useState<number>(0);

  // Simulation Route Presets
  const [routeType, setRouteType] = useState<
    'highway' | 'hike' | 'city' | 'stationary' | 'lost_signal'
  >('highway');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeedFactor, setSimSpeedFactor] = useState<number>(1.0);

  // Waypoints State: 2 Predefined (WP1, WP2) + 2 Fixed Slots (FIX1, FIX2)
  const [waypoints, setWaypoints] = useState<Waypoint[]>(DEFAULT_PRESET_WAYPOINTS);
  const [activeTarget, setActiveTarget] = useState<Waypoint | null>(DEFAULT_PRESET_WAYPOINTS[0]);
  const [lastFixedSlot, setLastFixedSlot] = useState<'FIX1' | 'FIX2'>('FIX2');

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // GPS State
  const [gps, setGps] = useState<GpsState>({
    validFix: true,
    latitude: 37.7749,
    longitude: -122.4194,
    altitudeM: 52.0,
    speedKmh: 54.2,
    courseDeg: 42.0,
    satellitesInUse: 10,
    satellitesInView: 12,
    fixMode: '3',
    hdop: 0.88,
    utcTime: new Date(),
    satellites: INITIAL_SATELLITES,
    rawNmeaSentence: '',
  });

  // Navigation State
  const [nav, setNav] = useState<NavState>({
    target: DEFAULT_PRESET_WAYPOINTS[1],
    distanceToTargetM: 1420,
    bearingToTargetDeg: 42.0,
    relativeBearingDeg: 0.0,
    crossTrackErrorM: 12.4,
    vmgKmh: 52.1,
    etaSeconds: 94,
    tripDistanceM: 8420,
    odometerM: 128400,
    maxSpeedKmh: 82.5,
    avgMovingSpeedKmh: 44.8,
    movingTimeSec: 675,
    stoppedTimeSec: 80,
  });

  // Breadcrumbs Trail
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ lat: number; lon: number }>>([
    { lat: 37.7700, lon: -122.4250 },
    { lat: 37.7712, lon: -122.4235 },
    { lat: 37.7725, lon: -122.4220 },
    { lat: 37.7738, lon: -122.4205 },
    { lat: 37.7749, lon: -122.4194 },
  ]);

  // Serial NMEA Console Logs
  const [nmeaLog, setNmeaLog] = useState<string[]>([]);

  // Custom Waypoint Form State
  const [showAddWpModal, setShowAddWpModal] = useState(false);
  const [customWpName, setCustomWpName] = useState('');
  const [customWpLat, setCustomWpLat] = useState('');
  const [customWpLon, setCustomWpLon] = useState('');
  const [customWpDesc, setCustomWpDesc] = useState('');

  const handleAddCustomWaypoint = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customWpName || !customWpLat || !customWpLon) return;
    const lat = parseFloat(customWpLat);
    const lon = parseFloat(customWpLon);
    if (isNaN(lat) || isNaN(lon)) return;

    const cleanName = customWpName.trim().toUpperCase().substring(0, 8);
    const newWp: Waypoint = {
      name: cleanName,
      lat,
      lon,
      desc: customWpDesc.trim() || 'Custom Waypoint',
    };
    setWaypoints((prev) => [...prev, newWp]);
    setSelectedWpIndex(waypoints.length);
    setActiveTarget(newWp);
    setCustomWpName('');
    setCustomWpLat('');
    setCustomWpLon('');
    setCustomWpDesc('');
    setShowAddWpModal(false);
    showNotification(`Waypoint "${cleanName}" created and set as active target!`);
  };

  const fillCurrentGpsCoords = () => {
    setCustomWpLat(gps.latitude.toFixed(6));
    setCustomWpLon(gps.longitude.toFixed(6));
    if (!customWpName) {
      setCustomWpName(`WP${waypoints.length + 1}`);
    }
  };

  const applyPreset = (name: string, lat: number, lon: number, desc: string) => {
    setCustomWpName(name);
    setCustomWpLat(lat.toFixed(6));
    setCustomWpLon(lon.toFixed(6));
    setCustomWpDesc(desc);
  };

  const handleDeleteWaypoint = (indexToDelete: number) => {
    if (waypoints.length <= 1) {
      showNotification('At least one waypoint must remain.');
      return;
    }
    const wpToDelete = waypoints[indexToDelete];
    const newWps = waypoints.filter((_, idx) => idx !== indexToDelete);
    setWaypoints(newWps);
    if (activeTarget?.name === wpToDelete.name) {
      setActiveTarget(newWps[0] || null);
    }
    setSelectedWpIndex(0);
    showNotification(`Waypoint "${wpToDelete.name}" removed.`);
  };

  // Simulation timer loop
  const simTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      simTimeRef.current += 0.2 * simSpeedFactor;
      const t = simTimeRef.current;

      setGps((prevGps) => {
        let newLat = prevGps.latitude;
        let newLon = prevGps.longitude;
        let newSpeed = prevGps.speedKmh;
        let newCourse = prevGps.courseDeg;
        let newAlt = prevGps.altitudeM;
        let fix = true;
        let sats = 10;
        let mode: '1' | '2' | '3' = '3';

        if (routeType === 'lost_signal') {
          fix = false;
          sats = 2;
          mode = '1';
          newSpeed = 0;
        } else if (routeType === 'highway') {
          // Driving along curved road
          newSpeed = 65.0 + Math.sin(t * 0.5) * 15.0;
          newCourse = (45.0 + Math.sin(t * 0.2) * 35.0 + 360) % 360;
          const rad = (newCourse * Math.PI) / 180;
          const dMeters = (newSpeed / 3.6) * 0.2;
          newLat += (dMeters * Math.cos(rad)) / 111320.0;
          newLon += (dMeters * Math.sin(rad)) / (111320.0 * Math.cos((newLat * Math.PI) / 180));
          newAlt = 50.0 + Math.sin(t * 0.1) * 20.0;
        } else if (routeType === 'hike') {
          newSpeed = 4.2 + Math.sin(t * 0.8) * 0.8;
          newCourse = (120.0 + Math.sin(t * 0.3) * 60.0 + 360) % 360;
          const rad = (newCourse * Math.PI) / 180;
          const dMeters = (newSpeed / 3.6) * 0.2;
          newLat += (dMeters * Math.cos(rad)) / 111320.0;
          newLon += (dMeters * Math.sin(rad)) / (111320.0 * Math.cos((newLat * Math.PI) / 180));
          newAlt = 280.0 + (t * 0.4);
        } else if (routeType === 'city') {
          // 90 degree turns
          const phase = Math.floor(t / 8) % 4;
          newCourse = phase * 90;
          newSpeed = 15.0 + Math.sin(t) * 4.0;
          const rad = (newCourse * Math.PI) / 180;
          const dMeters = (newSpeed / 3.6) * 0.2;
          newLat += (dMeters * Math.cos(rad)) / 111320.0;
          newLon += (dMeters * Math.sin(rad)) / (111320.0 * Math.cos((newLat * Math.PI) / 180));
        } else if (routeType === 'stationary') {
          // Jitter
          newSpeed = Math.abs(Math.sin(t * 1.5)) * 0.6;
          newLat += (Math.random() - 0.5) * 0.000005;
          newLon += (Math.random() - 0.5) * 0.000005;
        }

        const now = new Date();
        const updatedGps: GpsState = {
          ...prevGps,
          validFix: fix,
          latitude: newLat,
          longitude: newLon,
          speedKmh: newSpeed,
          courseDeg: newCourse,
          altitudeM: newAlt,
          satellitesInUse: sats,
          fixMode: mode,
          utcTime: now,
        };

        // Generate NMEA sentences
        const rmc = generateGNRMC(updatedGps);
        const gga = generateGNGGA(updatedGps);

        // Update serial console
        setNmeaLog((prev) => [rmc, gga, ...prev.slice(0, 18)]);

        // Append to breadcrumbs
        if (fix && Math.random() > 0.6) {
          setBreadcrumbs((prev) => {
            const last = prev[prev.length - 1];
            if (!last || calculateDistance(last.lat, last.lon, newLat, newLon) > 8) {
              return [...prev.slice(-200), { lat: newLat, lon: newLon }];
            }
            return prev;
          });
        }

        // Update NavEngine metrics
        setNav((prevNav) => {
          let dist = prevNav.distanceToTargetM;
          let brg = prevNav.bearingToTargetDeg;
          let xte = prevNav.crossTrackErrorM;
          let vmg = 0;
          let eta = 0;

          if (activeTarget && fix) {
            dist = calculateDistance(newLat, newLon, activeTarget.lat, activeTarget.lon);
            brg = calculateBearing(newLat, newLon, activeTarget.lat, activeTarget.lon);
            xte = calculateXTE(
              breadcrumbs[0]?.lat || newLat,
              breadcrumbs[0]?.lon || newLon,
              activeTarget.lat,
              activeTarget.lon,
              newLat,
              newLon
            );
            const relBrg = brg - newCourse;
            vmg = Math.max(0, newSpeed * Math.cos((relBrg * Math.PI) / 180));
            const speedMps = newSpeed / 3.6;
            eta = speedMps > 0.5 ? Math.floor(dist / speedMps) : 0;
          }

          const stepDist = (newSpeed / 3.6) * 0.2;
          const newTripDist = prevNav.tripDistanceM + stepDist;
          const newMovingTime = newSpeed > 1.5 ? prevNav.movingTimeSec + 0.2 : prevNav.movingTimeSec;
          const newStoppedTime = newSpeed <= 1.5 ? prevNav.stoppedTimeSec + 0.2 : prevNav.stoppedTimeSec;

          return {
            ...prevNav,
            target: activeTarget,
            distanceToTargetM: dist,
            bearingToTargetDeg: brg,
            crossTrackErrorM: xte,
            vmgKmh: vmg,
            etaSeconds: eta,
            tripDistanceM: newTripDist,
            odometerM: prevNav.odometerM + stepDist,
            maxSpeedKmh: Math.max(prevNav.maxSpeedKmh, newSpeed),
            avgMovingSpeedKmh:
              newMovingTime > 0 ? (newTripDist / 1000) / (newMovingTime / 3600) : 0,
            movingTimeSec: Math.floor(newMovingTime),
            stoppedTimeSec: Math.floor(newStoppedTime),
          };
        });

        return updatedGps;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying, routeType, simSpeedFactor, activeTarget, breadcrumbs]);

  // Button Action Handlers matching MicroPython buttons.py
  const handleBtnNext = () => {
    // Button 1 (GPIO8): Always advances to the next window (7 windows total)
    setCurrentWindow((prev) => (prev + 1) % 7);
  };

  const handleBtnPrev = () => {
    // Button 2 (GPIO9): Always retreats to the previous window (7 windows total)
    setCurrentWindow((prev) => (prev - 1 + 7) % 7);
  };

  const handleBtnSelect = () => {
    // Button 3 (GPIO0): Action button for the active window
    if (currentWindow === 1) {
      // Step closer and wrap from 200m back around to 15000m (15k)
      const levels = [15000, 5000, 2500, 1000, 500, 200];
      const curIdx = levels.indexOf(zoomMeters);
      const nextIdx = (curIdx + 1) % levels.length;
      setZoomMeters(levels[nextIdx]);
    } else if (currentWindow === 4) {
      // Cycle waypoint selection on Window 4
      const nextIdx = (selectedWpIndex + 1) % waypoints.length;
      setSelectedWpIndex(nextIdx);
      const wp = waypoints[nextIdx];
      if (wp) {
        setActiveTarget(wp);
      }
    } else if (currentWindow === 0 || currentWindow === 2 || currentWindow === 6) {
      // Reset trip distance on HUD, Trip, or Marine windows
      setNav((prev) => ({ ...prev, tripDistanceM: 0, maxSpeedKmh: gps.speedKmh }));
    }
  };

  const handleFixCurrentWaypoint = (slotName?: 'FIX1' | 'FIX2') => {
    setWaypoints((prev) => {
      let targetName = slotName;
      if (!targetName) {
        const fix1 = prev.find((w) => w.name === 'FIX1');
        const fix2 = prev.find((w) => w.name === 'FIX2');
        if (!fix1?.isFixed) {
          targetName = 'FIX1';
        } else if (!fix2?.isFixed) {
          targetName = 'FIX2';
        } else {
          targetName = lastFixedSlot === 'FIX1' ? 'FIX2' : 'FIX1';
        }
      }
      setLastFixedSlot(targetName);

      const updated = prev.map((w) => {
        if (w.name === targetName) {
          return {
            ...w,
            lat: gps.latitude,
            lon: gps.longitude,
            desc: `Fixed at (${gps.latitude.toFixed(4)}°, ${gps.longitude.toFixed(4)}°)`,
            isFixed: true,
          };
        }
        return w;
      });

      const idx = updated.findIndex((w) => w.name === targetName);
      if (idx >= 0) {
        setSelectedWpIndex(idx);
        setActiveTarget(updated[idx]);
      }
      showNotification(`Position saved to ${targetName} & set as destination target!`);
      return updated;
    });
  };

  const handleResetWaypoints = () => {
    setWaypoints(DEFAULT_PRESET_WAYPOINTS);
    setActiveTarget(DEFAULT_PRESET_WAYPOINTS[0]);
    setSelectedWpIndex(0);
    setLastFixedSlot('FIX2');
    showNotification('Waypoints reset to 2 Predefined (WP1, WP2) and 2 Empty Fixed slots (FIX1, FIX2).');
  };

  const handleMarkCurrentWaypoint = () => handleFixCurrentWaypoint();

  const handleExportGPX = () => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\\n';
    xml += '<gpx version="1.1" creator="ESP32-C3 GPS Navigator" xmlns="http://www.topografix.com/GPX/1/1">\\n';
    xml += '  <trk>\\n';
    xml += '    <name>ESP32 Recorded Track</name>\\n';
    xml += '    <trkseg>\\n';
    breadcrumbs.forEach((pt) => {
      xml += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}">\\n`;
      xml += `        <ele>${gps.altitudeM.toFixed(1)}</ele>\\n`;
      xml += `        <time>${new Date().toISOString()}</time>\\n`;
      xml += `      </trkpt>\\n`;
    });
    xml += '    </trkseg>\\n';
    xml += '  </trk>\\n';
    xml += '</gpx>\\n';

    const blob = new Blob([xml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'route.gpx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const windowNames = [
    { id: 0, label: 'HUD Cockpit', tag: 'HUD' },
    { id: 1, label: 'Vector Map', tag: 'MAP' },
    { id: 2, label: 'Trip Computer', tag: 'TRIP' },
    { id: 3, label: 'GNSS Satellites', tag: 'GNSS' },
    { id: 4, label: 'Waypoint Manager', tag: 'WPT' },
    { id: 5, label: 'System Settings', tag: 'SET' },
    { id: 6, label: 'Marine Sea Nav', tag: 'SEA' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* =====================================================================
          LEFT: Interactive Handheld GPS Device (1.8" TFT + Physical Buttons)
          ===================================================================== */}
      <div className="lg:col-span-5 flex flex-col items-center">
        {/* Device Shell Chassis */}
        <div className="w-full max-w-[340px] bg-gradient-to-b from-zinc-800 to-zinc-900 border-2 border-zinc-700 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
          {/* Top Brand & Status LEDs */}
          <div className="w-full flex items-center justify-between pb-3 px-1 border-b border-zinc-700/80">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-[11px] font-mono font-bold text-amber-400 tracking-wider">
                ESP32-C3 NAV
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
              <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-700">
                GT-U7 GPS
              </span>
            </div>
          </div>

          {/* 1.8" TFT Display */}
          <div className="my-4">
            <TFTDisplay
              currentWindow={currentWindow}
              gps={gps}
              nav={nav}
              waypoints={waypoints}
              breadcrumbs={breadcrumbs}
              zoomMeters={zoomMeters}
              brightnessPercent={brightnessPercent}
              selectedWpIndex={selectedWpIndex}
              onSelectWaypoint={(idx) => setSelectedWpIndex(idx)}
            />
          </div>

          {/* Physical Tactile Navigation Buttons */}
          <div className="w-full mt-2 pt-3 border-t border-zinc-700/80">
            <div className="text-[10px] font-mono text-center text-zinc-400 mb-2 uppercase tracking-wider">
              Physical ESP32-C3 Tactile Switches
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* Button PREV (GPIO9) */}
              <button
                onClick={handleBtnPrev}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-950 text-zinc-200 border border-zinc-600 shadow-md transition-all cursor-pointer group"
                title="GPIO9: Previous window or Zoom Out on Map"
              >
                <ArrowUp className="w-4 h-4 text-cyan-400 group-hover:-translate-y-0.5 transition-transform" />
                <span className="text-[10px] font-mono font-bold mt-1">PREV</span>
                <span className="text-[8px] text-zinc-500 font-mono">GPIO9</span>
              </button>

              {/* Button SELECT / MARK (GPIO0) */}
              <button
                onClick={handleBtnSelect}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleMarkCurrentWaypoint();
                }}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 active:bg-amber-700 text-black border border-amber-400 shadow-md transition-all cursor-pointer font-bold group"
                title="GPIO0: Select / Go-To / Reset. Right-click or hold to mark WP."
              >
                <CheckCircle className="w-4 h-4 text-black group-scale-105" />
                <span className="text-[10px] font-mono mt-1">SELECT</span>
                <span className="text-[8px] text-amber-950 font-mono">GPIO0</span>
              </button>

              {/* Button NEXT (GPIO8) */}
              <button
                onClick={handleBtnNext}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-950 text-zinc-200 border border-zinc-600 shadow-md transition-all cursor-pointer group"
                title="GPIO8: Next window or Zoom In on Map"
              >
                <ArrowDown className="w-4 h-4 text-cyan-400 group-hover:translate-y-0.5 transition-transform" />
                <span className="text-[10px] font-mono font-bold mt-1">NEXT</span>
                <span className="text-[8px] text-zinc-500 font-mono">GPIO8</span>
              </button>
            </div>
          </div>

          {/* Quick Screen Selector Pills */}
          <div className="w-full mt-3 pt-2 border-t border-zinc-800 flex justify-between gap-1">
            {windowNames.map((win) => (
              <button
                key={win.id}
                onClick={() => setCurrentWindow(win.id)}
                className={`flex-1 py-1 px-1 rounded text-[9px] font-mono text-center transition-colors ${
                  currentWindow === win.id
                    ? 'bg-cyan-500 text-black font-bold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {win.tag}
              </button>
            ))}
          </div>
        </div>

        {/* =====================================================================
            Prominent GPS Actions & Controls Bar (Directly below physical device)
            ===================================================================== */}
        <div className="w-full max-w-[340px] mt-3 flex flex-col gap-2.5">
          {/* Main Primary Waypoint Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleFixCurrentWaypoint()}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 cursor-pointer transition-all border border-amber-300 active:scale-95"
              title="Fix current simulated GPS position into FIX1 or FIX2 and set as destination"
            >
              <MapPin className="w-4 h-4 text-black" />
              <span>Fix Pos (FIX1/2)</span>
            </button>

            <button
              onClick={() => {
                const nextIdx = (selectedWpIndex + 1) % waypoints.length;
                setSelectedWpIndex(nextIdx);
                const wp = waypoints[nextIdx];
                if (wp) {
                  setActiveTarget(wp);
                  showNotification(`Destination: ${wp.name}`);
                }
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer transition-all border border-cyan-300 active:scale-95"
              title="Cycle destination through WP1, WP2, FIX1, FIX2"
            >
              <Crosshair className="w-4 h-4 text-black" />
              <span>Cycle Dest WP</span>
            </button>
          </div>

          {/* Quick Select Destination Buttons for WP1, WP2, FIX1, FIX2 */}
          <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="text-zinc-200 font-semibold">Destinations:</span>
                <span className="text-zinc-500 text-[10px]">2 Predefined + 2 Fixed</span>
              </span>
              <span className="text-emerald-400 font-bold">
                Target: {activeTarget?.name || 'NONE'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {waypoints.slice(0, 4).map((wp, idx) => {
                const isActive = activeTarget?.name === wp.name;
                const isFix = wp.name.startsWith('FIX');
                const isFixed = wp.isFixed ?? (wp.lat !== 0 && wp.lon !== 0);
                return (
                  <button
                    key={wp.name}
                    onClick={() => {
                      if (isFix && !isFixed) {
                        handleFixCurrentWaypoint(wp.name as 'FIX1' | 'FIX2');
                      } else {
                        setSelectedWpIndex(idx);
                        setActiveTarget(wp);
                        showNotification(`Destination set to ${wp.name}`);
                      }
                    }}
                    title={
                      isFix && !isFixed
                        ? `Click to fix current GPS position into ${wp.name}`
                        : `Set ${wp.name} as destination`
                    }
                    className={`py-1.5 px-1.5 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer text-center ${
                      isActive
                        ? 'bg-emerald-500 text-black border-emerald-300 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-300'
                        : isFix
                        ? isFixed
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border-cyan-800/60'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-dashed border-zinc-700'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                    }`}
                  >
                    {isActive ? `▶ ${wp.name}` : isFix && !isFixed ? `${wp.name} [FIX]` : wp.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Backlight & GPX Export Controls */}
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between text-xs text-zinc-400 font-mono shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-300">Backlight:</span>
              <input
                type="range"
                min="20"
                max="100"
                value={brightnessPercent}
                onChange={(e) => setBrightnessPercent(Number(e.target.value))}
                className="w-16 accent-cyan-400 cursor-pointer"
              />
              <span className="text-zinc-200 text-[10px]">{brightnessPercent}%</span>
            </div>

            <button
              onClick={handleExportGPX}
              className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200 font-bold cursor-pointer bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-lg border border-zinc-700 transition-colors shadow-sm"
              title="Download recorded route as standard GPX 1.1 file"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>GPX Route</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          RIGHT: Real-time GPS Simulation Controls & Telemetry Dashboard
          ===================================================================== */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Simulation Route Scenario Selector */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-zinc-100">
                GT-U7 GPS NMEA Stream Engine
              </span>
            </div>

            {/* Play / Pause / Reset */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-600 hover:bg-amber-500 text-black'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Resume'}</span>
              </button>

              <button
                onClick={() => {
                  setBreadcrumbs([]);
                  setNav((p) => ({ ...p, tripDistanceM: 0, movingTimeSec: 0, stoppedTimeSec: 0 }));
                  showNotification('Trip distance & breadcrumbs reset.');
                }}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Reset Trip Distance & Breadcrumbs"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Route Scenarios */}
          <div className="mt-3">
            <label className="text-[11px] font-mono text-zinc-400 block mb-1.5 uppercase">
              Select Driving / Walking Route Profile:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {[
                { id: 'highway', name: 'Highway Drive', desc: '55-80 km/h speed' },
                { id: 'hike', name: 'Mountain Hike', desc: '3-5 km/h climb' },
                { id: 'city', name: 'City Grid', desc: '90° corner turns' },
                { id: 'stationary', name: 'Stationary', desc: 'Jitter filtering' },
                { id: 'lost_signal', name: 'Signal Drop', desc: 'Tunnel dropout' },
              ].map((route) => (
                <button
                  key={route.id}
                  onClick={() => setRouteType(route.id as any)}
                  className={`p-2 rounded-lg text-left transition-all border cursor-pointer ${
                    routeType === route.id
                      ? 'bg-amber-500/15 border-amber-500 text-amber-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="font-semibold block">{route.name}</span>
                  <span className="text-[10px] text-zinc-400 block">{route.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Speed Multiplier */}
          <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>Simulation Clock Speed:</span>
            <div className="flex gap-2">
              {[0.5, 1.0, 2.0, 5.0].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeedFactor(spd)}
                  className={`px-2 py-0.5 rounded text-[11px] ${
                    simSpeedFactor === spd
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Telemetry KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" /> Ground Speed
            </span>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              {gps.speedKmh.toFixed(1)}{' '}
              <span className="text-xs font-normal text-zinc-500">km/h</span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">
              Max: {nav.maxSpeedKmh.toFixed(1)} km/h
            </span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
              <Compass className="w-3 h-3 text-amber-400" /> Course / Heading
            </span>
            <div className="text-xl font-bold font-mono text-amber-400 mt-1">
              {Math.round(gps.courseDeg)}°{' '}
              <span className="text-xs font-normal text-zinc-500">COG</span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">
              Target BRG: {Math.round(nav.bearingToTargetDeg)}°
            </span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-400" /> Distance to WP
            </span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {(nav.distanceToTargetM / 1000).toFixed(2)}{' '}
              <span className="text-xs font-normal text-zinc-500">km</span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-0.5 block truncate">
              To: {activeTarget ? activeTarget.name : 'NONE'}
            </span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-400" /> Estimated Arrival
            </span>
            <div className="text-xl font-bold font-mono text-purple-400 mt-1">
              {Math.floor(nav.etaSeconds / 60)}m {nav.etaSeconds % 60}s
            </div>
            <span className="text-[10px] text-zinc-400 mt-0.5 block">
              VMG: {nav.vmgKmh.toFixed(1)} km/h
            </span>
          </div>
        </div>

        {/* =====================================================================
            WAYPOINT MANAGER & DIRECT-TO TARGET NAVIGATOR (Dedicated Dashboard Panel)
            ===================================================================== */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-zinc-100">
                Waypoints & Direct-To Navigator
              </span>
              <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/80 px-2 py-0.5 rounded-full font-mono">
                {waypoints.length} Saved
              </span>
            </div>

            {/* Quick Actions to Add Custom Waypoint & Reset */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetWaypoints}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-xs border border-zinc-700 cursor-pointer transition-all"
                title="Reset to 2 Predefined (WP1, WP2) and 2 Empty Fixed slots (FIX1, FIX2)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">Reset WP</span>
              </button>

              <button
                onClick={() => setShowAddWpModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-md shadow-cyan-500/20 cursor-pointer transition-all"
                title="Enter custom Name, Latitude, and Longitude"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Custom WP</span>
              </button>

              <button
                onClick={handleMarkCurrentWaypoint}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 font-medium text-xs border border-zinc-700 cursor-pointer transition-all"
                title="Save current GPS position as a waypoint"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Fix Pos</span>
              </button>
            </div>
          </div>

          {/* Active Navigation Target Banner */}
          {activeTarget && (
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-emerald-300 font-bold uppercase font-mono">
                  ACTIVE DIRECT-TO:
                </span>
                <span className="text-white font-mono font-bold bg-zinc-900 px-2 py-0.5 rounded border border-emerald-500/50">
                  {activeTarget.name}
                </span>
                <span className="text-zinc-400 text-[11px] hidden sm:inline">
                  ({activeTarget.lat.toFixed(4)}, {activeTarget.lon.toFixed(4)})
                </span>
              </div>
              <div className="font-mono text-emerald-400 font-bold text-[11px]">
                {(nav.distanceToTargetM / 1000).toFixed(2)} km &bull; {Math.round(nav.bearingToTargetDeg)}° BRG
              </div>
            </div>
          )}

          {/* Waypoints Table / List */}
          <div className="mt-3 divide-y divide-zinc-800/80 border border-zinc-800/60 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
            {waypoints.map((wp, idx) => {
              const isActive = activeTarget?.name === wp.name;
              const isPredefined = wp.name === 'WP1' || wp.name === 'WP2';
              const isFix = wp.name.startsWith('FIX');
              const isFixed = wp.isFixed ?? (wp.lat !== 0 && wp.lon !== 0);
              const dist = calculateDistance(gps.latitude, gps.longitude, wp.lat, wp.lon);
              const brg = calculateBearing(gps.latitude, gps.longitude, wp.lat, wp.lon);

              return (
                <div
                  key={`${wp.name}-${idx}`}
                  className={`p-2.5 flex items-center justify-between text-xs transition-colors ${
                    isActive ? 'bg-cyan-950/25 border-l-4 border-cyan-400' : 'bg-zinc-900/40 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (isFix && !isFixed) {
                          handleFixCurrentWaypoint(wp.name as 'FIX1' | 'FIX2');
                        } else {
                          setSelectedWpIndex(idx);
                          setActiveTarget(wp);
                          showNotification(`Active target set to ${wp.name}`);
                        }
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-500 text-black'
                          : isFix && !isFixed
                          ? 'bg-zinc-800 border border-dashed border-zinc-600 text-zinc-400'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                      title={isActive ? 'Active Target' : isFix && !isFixed ? 'Click to Fix Current Position' : 'Click to Set as Active Direct-To'}
                    >
                      {isActive ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white tracking-wide">
                          {wp.name}
                        </span>
                        {isActive && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono">
                            DIRECT-TO
                          </span>
                        )}
                        {isPredefined && (
                          <span className="text-[9px] bg-purple-950/60 text-purple-300 border border-purple-800/50 px-1.5 py-0.2 rounded font-mono">
                            PREDEFINED
                          </span>
                        )}
                        {isFix && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono border ${
                              isFixed
                                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
                                : 'bg-amber-950/50 text-amber-300 border-amber-800/50'
                            }`}
                          >
                            {isFixed ? 'FIXED POSITION' : 'EMPTY FIXED SLOT'}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-400">
                          {wp.desc || 'Waypoint'}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                        {isFix && !isFixed
                          ? 'Coordinates unassigned — Click "Fix Pos" to record'
                          : `${wp.lat.toFixed(4)}°, ${wp.lon.toFixed(4)}°`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    <div className="text-right">
                      <div className="text-zinc-200 font-bold">
                        {isFix && !isFixed ? (
                          <span className="text-zinc-500 font-normal">--.- km</span>
                        ) : (
                          `${(dist / 1000).toFixed(2)} km`
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {isFix && !isFixed ? 'BRG: ---°' : `BRG: ${Math.round(brg)}°`}
                      </div>
                    </div>

                    {isFix && !isFixed ? (
                      <button
                        onClick={() => handleFixCurrentWaypoint(wp.name as 'FIX1' | 'FIX2')}
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/40 text-[11px] font-bold transition-colors cursor-pointer"
                        title="Fix current GPS location to this slot"
                      >
                        Fix Pos
                      </button>
                    ) : !isActive ? (
                      <button
                        onClick={() => {
                          setSelectedWpIndex(idx);
                          setActiveTarget(wp);
                          showNotification(`Active target set to ${wp.name}`);
                        }}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-cyan-600 hover:text-black text-cyan-400 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Go-To
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold font-mono">
                        Active
                      </span>
                    )}

                    {!isPredefined && !isFix && waypoints.length > 1 && (
                      <button
                        onClick={() => handleDeleteWaypoint(idx)}
                        className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete Waypoint"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Raw NMEA Serial UART Stream Monitor */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col flex-1">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-mono font-bold text-zinc-200">
                UART1 Raw NMEA-0183 Stream (GPIO20 / 9600 baud)
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">
              $GNRMC & $GNGGA Sentences
            </span>
          </div>

          <div className="flex-1 bg-black/80 rounded-lg p-3 font-mono text-[11px] leading-relaxed text-emerald-400/90 overflow-y-auto max-h-48 border border-zinc-800 shadow-inner">
            {nmeaLog.map((line, idx) => (
              <div key={idx} className="whitespace-nowrap hover:text-white transition-colors">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================================
          HIGH-VISIBILITY MODAL: Add Custom Waypoint
          ===================================================================== */}
      {showAddWpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-zinc-900 border-2 border-cyan-500/70 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-cyan-500/20 flex flex-col gap-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Custom Waypoint</h3>
                  <p className="text-xs text-zinc-400">
                    Create a custom coordinate target for Direct-To navigation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWpModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Fill / Presets */}
            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-400 uppercase">
                  Quick Coordinate Autofill:
                </span>
                <button
                  type="button"
                  onClick={fillCurrentGpsCoords}
                  className="text-xs font-mono font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Use Live GPS Position</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { name: 'PORT', lat: 25.7617, lon: -80.1918, desc: 'Miami Marina' },
                  { name: 'BAY', lat: 25.7830, lon: -80.1450, desc: 'Anchorage' },
                  { name: 'CAMP', lat: 37.7833, lon: -122.4167, desc: 'Mountain Ridge' },
                  { name: 'REEF', lat: 25.7200, lon: -80.1100, desc: 'Fishing Reef' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset.name, preset.lat, preset.lon, preset.desc)}
                    className="text-[10px] font-mono bg-zinc-800 hover:bg-cyan-900/50 hover:text-cyan-300 hover:border-cyan-500/50 text-zinc-300 px-2 py-1 rounded border border-zinc-700 cursor-pointer transition-colors"
                  >
                    + {preset.name} ({preset.desc})
                  </button>
                ))}
              </div>
            </div>

            {/* Waypoint Form */}
            <form onSubmit={handleAddCustomWaypoint} className="flex flex-col gap-3 font-mono">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  Waypoint Name (Max 8 Chars):
                </label>
                <input
                  type="text"
                  value={customWpName}
                  onChange={(e) => setCustomWpName(e.target.value.toUpperCase())}
                  placeholder="e.g. PORT, DOCK, CAMP, FISH1"
                  maxLength={8}
                  required
                  autoFocus
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-bold uppercase focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">
                    Latitude (&deg;):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customWpLat}
                    onChange={(e) => setCustomWpLat(e.target.value)}
                    placeholder="e.g. 25.7617"
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">
                    Longitude (&deg;):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={customWpLon}
                    onChange={(e) => setCustomWpLon(e.target.value)}
                    placeholder="e.g. -80.1918"
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Description / Label (Optional):
                </label>
                <input
                  type="text"
                  value={customWpDesc}
                  onChange={(e) => setCustomWpDesc(e.target.value)}
                  placeholder="e.g. Marina dock / trailhead"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddWpModal(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer transition-all active:scale-95"
                >
                  Save &amp; Navigate Direct-To
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-black px-4 py-2 rounded-xl font-bold font-mono text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4">
          <Check className="w-4 h-4 text-black stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
