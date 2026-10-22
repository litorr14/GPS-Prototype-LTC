"""
GPX Route Recorder for ESP32-C3 MicroPython.
Writes standard GPX 1.1 XML trackpoints to /route.gpx.
Compatible with Google Earth, Google Maps (My Maps), Strava, and Garmin BaseCamp.
Store in: Codes/gpx_logger.py
"""

import time
import math

class GPXLogger:
    def __init__(self, filepath="/route.gpx", min_interval_sec=2, min_distance_m=4.0):
        self.filepath = filepath
        self.min_interval_sec = min_interval_sec
        self.min_distance_m = min_distance_m
        self.recording = True
        self.points_logged = 0
        self.last_lat = None
        self.last_lon = None
        self.last_time = 0
        self._init_file()

    def _init_file(self):
        try:
            with open(self.filepath, "w") as f:
                f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
                f.write('<gpx version="1.1" creator="ESP32-C3 GPS Navigator" xmlns="http://www.topografix.com/GPX/1/1">\n')
                f.write('  <trk>\n')
                f.write('    <name>ESP32 GPS Route Track</name>\n')
                f.write('    <trkseg>\n')
        except Exception as e:
            pass

    def log_point(self, lat, lon, ele, hour, minute, sec, day=1, month=1, year=2026):
        if not self.recording or (lat == 0.0 and lon == 0.0):
            return

        now = time.time()
        if now - self.last_time < self.min_interval_sec:
            return

        if self.last_lat is not None and self.last_lon is not None:
            dy = (lat - self.last_lat) * 111320.0
            dx = (lon - self.last_lon) * 111320.0 * math.cos(math.radians(lat))
            dist = math.sqrt(dx * dx + dy * dy)
            if dist < self.min_distance_m:
                return

        self.last_lat = lat
        self.last_lon = lon
        self.last_time = now

        iso_time = f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:{sec:02d}Z"
        entry = (
            f'      <trkpt lat="{lat:.6f}" lon="{lon:.6f}">\n'
            f'        <ele>{ele:.1f}</ele>\n'
            f'        <time>{iso_time}</time>\n'
            f'      </trkpt>\n'
        )
        try:
            with open(self.filepath, "a") as f:
                f.write(entry)
            self.points_logged += 1
        except Exception:
            pass

    def close(self):
        try:
            with open(self.filepath, "a") as f:
                f.write('    </trkseg>\n')
                f.write('  </trk>\n')
                f.write('</gpx>\n')
        except Exception:
            pass
