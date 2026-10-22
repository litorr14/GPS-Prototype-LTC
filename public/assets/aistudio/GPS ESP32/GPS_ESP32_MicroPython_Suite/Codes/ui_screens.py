"""
HMI Window Manager and Graphical Screen Renderers for 1.8" 128x160 TFT.
Includes 6 dedicated navigation windows:
  0: HUD / Compass Cockpit
  1: Vector Breadcrumb Map
  2: Trip Computer & Odometer
  3: Satellite Constellation & Signal Diagnostic
  4: Waypoint Manager & Direct-To Navigator
  5: System Settings & Calibration
Store in: Codes/ui_screens.py
"""

import math
from config import (
    COLOR_BLACK, COLOR_WHITE, COLOR_NAVY, COLOR_DARK_BLUE, COLOR_CYAN,
    COLOR_DARK_CYAN, COLOR_GREEN, COLOR_NEON_GREEN, COLOR_YELLOW,
    COLOR_AMBER, COLOR_ORANGE, COLOR_RED, COLOR_GRAY, COLOR_DARK_GRAY,
    COLOR_PANEL_BG
)

class UIManager:
    TOTAL_WINDOWS = 7

    def __init__(self, display, gps, nav, map_engine, wp_manager):
        self.tft = display
        self.gps = gps
        self.nav = nav
        self.map_engine = map_engine
        self.wp_manager = wp_manager
        self.current_window = 0
        self.selected_wp_idx = 0

    def next_window(self):
        self.current_window = (self.current_window + 1) % self.TOTAL_WINDOWS

    def prev_window(self):
        self.current_window = (self.current_window - 1 + self.TOTAL_WINDOWS) % self.TOTAL_WINDOWS

    def render_current_window(self):
        self.render_status_bar()

        if self.current_window == 0:
            self.draw_hud_window()
        elif self.current_window == 1:
            self.draw_map_window()
        elif self.current_window == 2:
            self.draw_trip_window()
        elif self.current_window == 3:
            self.draw_satellite_window()
        elif self.current_window == 4:
            self.draw_waypoint_window()
        elif self.current_window == 5:
            self.draw_settings_window()
        elif self.current_window == 6:
            self.draw_marine_window()

        self.tft.show()

    def render_status_bar(self):
        """Top 14px status bar: Window title, Fix indicator, Satellites, Time with seconds."""
        self.tft.fill_rect(0, 0, 128, 14, COLOR_DARK_BLUE)
        self.tft.line(0, 14, 127, 14, COLOR_CYAN)

        # Fix Status indicator (3x6 dot)
        fix_col = COLOR_NEON_GREEN if self.gps.valid_fix else COLOR_RED
        self.tft.fill_rect(2, 4, 3, 6, fix_col)

        # Title abbreviation (7 windows)
        short_titles = ["HUD", "MAP", "TRP", "SAT", "WPT", "SET", "SEA"]
        self.tft.text(short_titles[self.current_window], 7, 3, COLOR_WHITE)

        # Satellite count (e.g. "9S" or "10S")
        sat_txt = f"{self.gps.satellites_in_use}S"
        self.tft.text(sat_txt, 34, 3, COLOR_CYAN)

        # Local Time with seconds (HH:MM:SS)
        time_str = f"{self.gps.utc_hour:02d}:{self.gps.utc_min:02d}:{self.gps.utc_sec:02d}"
        self.tft.text(time_str, 62, 3, COLOR_AMBER)

    # --------------------------------------------------------------------------
    # WINDOW 0: NAVIGATION HUD & COMPASS
    # --------------------------------------------------------------------------
    def draw_hud_window(self):
        self.tft.fill_rect(0, 15, 128, 145, COLOR_BLACK)

        # 1. Top Panel: Dual Speed (KM/H and Knots) - Time moved to Header!
        self.tft.fill_rect(4, 17, 120, 28, COLOR_PANEL_BG)
        self.tft.rect(4, 17, 120, 28, COLOR_DARK_BLUE)
        spd_kmh = max(0.0, self.gps.speed_kmh)
        spd_kn = max(0.0, self.gps.speed_knots)
        self.tft.text(f"SPD: {spd_kmh:04.1f} KM/H", 8, 19, COLOR_WHITE)
        self.tft.text(f"     {spd_kn:04.1f} KNOT", 8, 30, COLOR_CYAN)

        # 2. Compass Rose Dial
        cx = 64
        cy = 73
        radius = 23
        self.tft.rect(cx - radius, cy - radius, radius * 2, radius * 2, COLOR_DARK_GRAY)
        self.tft.text("N", cx - 3, cy - radius + 2, COLOR_RED)
        self.tft.text("S", cx - 3, cy + radius - 9, COLOR_GRAY)
        self.tft.text("W", cx - radius + 2, cy - 4, COLOR_GRAY)
        self.tft.text("E", cx + radius - 8, cy - 4, COLOR_GRAY)

        # Actual Course Pointer Arrow (Heading in Cyan)
        course_rad = math.radians(self.gps.course_deg)
        hx = int(cx + (radius - 5) * math.sin(course_rad))
        hy = int(cy - (radius - 5) * math.cos(course_rad))
        self.tft.line(cx, cy, hx, hy, COLOR_CYAN)

        # Bearing Pointer Arrow to Destination Waypoint (Green)
        if self.nav.target_name != "NONE":
            brg_rad = math.radians(self.nav.bearing_to_target_deg)
            bx = int(cx + (radius - 5) * math.sin(brg_rad))
            by = int(cy - (radius - 5) * math.cos(brg_rad))
            self.tft.line(cx, cy, bx, by, COLOR_NEON_GREEN)

        # 3. Target Waypoint & Bearing/Course Info Box (Separate lines, NO overlap!)
        self.tft.fill_rect(4, 103, 120, 54, COLOR_PANEL_BG)
        self.tft.rect(4, 103, 120, 54, COLOR_DARK_BLUE)

        wp_name = self.nav.target_name[:7]
        dist_km = max(0.0, self.nav.distance_to_target_m / 1000.0)
        dist_str = f"{dist_km:05.1f} km"

        self.tft.text(f"WP : {wp_name}", 8, 107, COLOR_YELLOW)
        self.tft.text(f"DST: {dist_str}", 8, 119, COLOR_NEON_GREEN)
        self.tft.text(f"BRG: {int(self.nav.bearing_to_target_deg):03d} deg", 8, 131, COLOR_NEON_GREEN)
        self.tft.text(f"CRS: {int(self.gps.course_deg):03d} deg", 8, 143, COLOR_CYAN)

    # --------------------------------------------------------------------------
    # WINDOW 1: VECTOR MAP & BREADCRUMBS
    # --------------------------------------------------------------------------
    def draw_map_window(self):
        target = self.wp_manager.get_active_target()
        self.map_engine.render(
            self.gps.latitude, self.gps.longitude,
            self.gps.course_deg,
            self.wp_manager.waypoints,
            target
        )

    # --------------------------------------------------------------------------
    # WINDOW 2: TRIP COMPUTER (MKS UNITS, NO OVERLAPPING)
    # --------------------------------------------------------------------------
    def draw_trip_window(self):
        self.tft.fill_rect(0, 15, 128, 145, COLOR_BLACK)

        # 1. Moving and Stopped times with hours (HH:MM:SS)
        mov_s = self.nav.moving_time_sec
        mov_h = mov_s // 3600
        mov_m = (mov_s % 3600) // 60
        mov_sec = mov_s % 60
        mov_str = f"{mov_h:02d}:{mov_m:02d}:{mov_sec:02d}"

        stp_s = self.nav.stopped_time_sec
        stp_h = stp_s // 3600
        stp_m = (stp_s % 3600) // 60
        stp_sec = stp_s % 60
        stp_str = f"{stp_h:02d}:{stp_m:02d}:{stp_sec:02d}"

        # 2. Speed: 2 integer digits + 1 decimal (e.g. 00.0kph)
        spd_val = max(0.0, self.nav.avg_moving_speed_kmh)
        spd_str = f"{spd_val:04.1f}kph"

        # 3. Altitude: 4 integer digits + 1 decimal (e.g. 0000.0 m)
        alt_val = max(0.0, self.gps.altitude_m)
        alt_str = f"{alt_val:06.1f} m"

        # 4. Distance: at least 3 integer digits + 1 decimal (e.g. 000.0 km)
        odo_km = max(0.0, self.nav.odometer_total_m / 1000.0)
        odo_str = f"{odo_km:05.1f} km"

        rem_km = max(0.0, self.nav.distance_to_target_m / 1000.0)
        rem_str = f"{rem_km:05.1f} km"

        crs_str = f"{int(self.gps.course_deg):03d} deg"
        brg_str = f"{int(self.nav.bearing_to_target_deg):03d} deg"

        # Exact 8 items, cleanly spaced vertically (16px pitch) to avoid overlap
        items = [
            ("AVG SPD", spd_str, COLOR_NEON_GREEN),
            ("MOV TM", mov_str, COLOR_WHITE),
            ("STP TM", stp_str, COLOR_GRAY),
            ("ALT", alt_str, COLOR_AMBER),
            ("ODO", odo_str, COLOR_YELLOW),
            ("COURSE", crs_str, COLOR_CYAN),
            ("REM DST", rem_str, COLOR_NEON_GREEN),
            ("BEARING", brg_str, COLOR_YELLOW),
        ]

        y = 18
        for title, val, col in items:
            self.tft.text(title[:8], 2, y, COLOR_GRAY)
            self.tft.text(val, 62, y, col)
            y += 16
            if y > 150:
                break

    # --------------------------------------------------------------------------
    # WINDOW 3: SATELLITE CONSTELLATION & SNR
    # --------------------------------------------------------------------------
    def draw_satellite_window(self):
        self.tft.fill_rect(0, 15, 128, 145, COLOR_BLACK)

        # Skyplot Polar Circle
        cx = 36
        cy = 56
        r = 30
        self.tft.rect(cx - r, cy - r, r * 2, r * 2, COLOR_DARK_GRAY)
        self.tft.line(cx - r, cy, cx + r, cy, COLOR_DARK_GRAY)
        self.tft.line(cx, cy - r, cx, cy + r, COLOR_DARK_GRAY)

        # Draw Satellite positions on Skyplot
        for sat in self.gps.satellites[:12]:
            elev = sat.get('elev', 45)
            azim = sat.get('azim', 0)
            snr = sat.get('snr', 0)
            col = COLOR_NEON_GREEN if snr > 30 else (COLOR_YELLOW if snr > 15 else COLOR_RED)

            r_dist = int(r * (90 - elev) / 90.0)
            rad = math.radians(azim)
            sx = int(cx + r_dist * math.sin(rad))
            sy = int(cy - r_dist * math.cos(rad))
            self.tft.fill_rect(sx - 1, sy - 1, 3, 3, col)

        # GNSS Metrics Panel
        self.tft.text(f"FIX:{self.gps.fix_mode}D", 76, 20, COLOR_NEON_GREEN if self.gps.valid_fix else COLOR_RED)
        self.tft.text(f"SAT:{len(self.gps.satellites)}", 76, 32, COLOR_CYAN)
        self.tft.text(f"USE:{self.gps.satellites_in_use}", 76, 44, COLOR_WHITE)
        self.tft.text(f"HDOP:{self.gps.hdop:.1f}", 76, 56, COLOR_AMBER)
        self.tft.text(f"ALT:{int(max(0.0, self.gps.altitude_m)):04d}m", 76, 68, COLOR_WHITE)

        # SNR Bar Graphs (Bottom Section)
        self.tft.fill_rect(4, 94, 120, 1, COLOR_DARK_BLUE)
        self.tft.text("SNR (dB-Hz)", 6, 98, COLOR_GRAY)

        bx = 6
        for sat in self.gps.satellites[:10]:
            snr = min(50, sat.get('snr', 0))
            bar_h = int((snr / 50.0) * 36)
            col = COLOR_NEON_GREEN if snr > 28 else (COLOR_YELLOW if snr > 15 else COLOR_RED)
            self.tft.fill_rect(bx, 150 - bar_h, 8, bar_h, col)
            bx += 12

    # --------------------------------------------------------------------------
    # WINDOW 4: WAYPOINT MANAGER
    # --------------------------------------------------------------------------
    def draw_waypoint_window(self):
        self.tft.fill_rect(0, 15, 128, 145, COLOR_BLACK)
        self.tft.text("WAYPOINTS (SEL=GO)", 6, 18, COLOR_YELLOW)

        wps = self.wp_manager.waypoints
        y = 32
        for i, wp in enumerate(wps[:4]):
            is_sel = (i == self.selected_wp_idx)
            is_active = (wp['name'] == self.nav.target_name)

            if is_sel:
                self.tft.fill_rect(4, y - 2, 120, 18, COLOR_PANEL_BG)
                self.tft.rect(4, y - 2, 120, 18, COLOR_CYAN)

            prefix = ">" if is_active else " "
            is_unfixed = ("FIX" in wp['name'] and (not wp.get('is_fixed', True) or (wp['lat'] == 0.0 and wp['lon'] == 0.0)))
            if is_active:
                name_col = COLOR_NEON_GREEN
            elif "FIX" in wp['name']:
                name_col = COLOR_CYAN if not is_unfixed else COLOR_GRAY
            else:
                name_col = COLOR_WHITE
            self.tft.text(f"{prefix}{wp['name'][:6]}", 8, y + 2, name_col)

            if is_unfixed:
                self.tft.text("--.-k", 72, y + 2, COLOR_DARK_GRAY)
            else:
                dist_m = self.nav.calculate_distance(
                    self.gps.latitude, self.gps.longitude, wp['lat'], wp['lon']
                )
                dist_km = max(0.0, dist_m / 1000.0)
                dist_str = f"{dist_km:05.1f}k"
                self.tft.text(dist_str, 72, y + 2, COLOR_CYAN if is_active else COLOR_WHITE)
            y += 20

        self.tft.text("[SEL] Cycle / Select", 4, 134, COLOR_GRAY)
        self.tft.text("[HOLD] Fix Cur Pos", 4, 146, COLOR_AMBER)

    # --------------------------------------------------------------------------
    # WINDOW 5: SYSTEM SETTINGS (UNITS ELIMINATED)
    # --------------------------------------------------------------------------
    def draw_settings_window(self):
        self.tft.fill_rect(0, 15, 128, 145, COLOR_BLACK)
        self.tft.text("SYS SETTINGS", 6, 18, COLOR_WHITE)

        self.tft.text("MCU: ESP32-C3", 6, 36, COLOR_CYAN)
        self.tft.text("GPS: GT-U7 9600", 6, 54, COLOR_CYAN)
        self.tft.text("TFT: ST7735R 1.8", 6, 72, COLOR_CYAN)
        self.tft.text("RATE: 1Hz NMEA", 6, 90, COLOR_GREEN)
        self.tft.text("TZ: UTC-5 (EST)", 6, 108, COLOR_AMBER)
        self.tft.text("LOG: /route.gpx", 6, 126, COLOR_NEON_GREEN)
        self.tft.text("MEM: Free 214KB", 6, 144, COLOR_WHITE)

    # --------------------------------------------------------------------------
    # WINDOW 6: MARINE / SEA NAVIGATION (KNOTS, NAUTICAL MILES, DMS POSITION)
    # --------------------------------------------------------------------------
    def draw_marine_window(self):
        self.tft.fill_rect(0, 15, 128, 145, COLOR_BLACK)

        # Conversions: 1 NM = 1852 meters
        speed_kn = self.gps.speed_knots
        odo_nm = self.nav.odometer_total_m / 1852.0
        rem_nm = self.nav.distance_to_target_m / 1852.0
        vmg_kn = self.nav.vmg_kmh / 1.852

        # Average speed in knots
        avg_kn = (odo_nm / (self.nav.moving_time_sec / 3600.0)) if self.nav.moving_time_sec > 0 else 0.0

        # Marine Data Rows - SPEED->SPD, DIST->DST, 2 integer digits for speed, 3 for distance
        self.tft.text("SPD", 2, 18, COLOR_GRAY)
        self.tft.text(f"{max(0.0, speed_kn):04.1f} kn", 62, 18, COLOR_WHITE)

        self.tft.text("AVG SPD", 2, 32, COLOR_GRAY)
        self.tft.text(f"{max(0.0, avg_kn):04.1f} kn", 62, 32, COLOR_NEON_GREEN)

        self.tft.text("ODO DST", 2, 46, COLOR_GRAY)
        self.tft.text(f"{max(0.0, odo_nm):05.1f} NM", 62, 46, COLOR_YELLOW)

        self.tft.text("REM DST", 2, 60, COLOR_GRAY)
        self.tft.text(f"{max(0.0, rem_nm):05.1f} NM", 62, 60, COLOR_CYAN)

        self.tft.text("BRG/CRS", 2, 74, COLOR_GRAY)
        self.tft.text(f"{int(self.nav.bearing_to_target_deg):03d}/{int(self.gps.course_deg):03d}d", 62, 74, COLOR_WHITE)

        # Coordinate DMS Section
        self.tft.line(4, 88, 124, 88, COLOR_DARK_BLUE)
        self.tft.text("POSITION (DMS)", 2, 93, COLOR_CYAN)

        lat_dms = self._format_dms(self.gps.latitude, True)
        lon_dms = self._format_dms(self.gps.longitude, False)

        self.tft.text(f"LAT:{lat_dms}", 2, 107, COLOR_AMBER)
        self.tft.text(f"LON:{lon_dms}", 2, 121, COLOR_AMBER)

        # VMG SPD Section (WP eliminated, SPEED -> SPD, 2 int + 1 dec)
        self.tft.line(4, 133, 124, 133, COLOR_DARK_BLUE)
        self.tft.text("VMG SPD", 2, 139, COLOR_GRAY)
        self.tft.text(f"{max(0.0, vmg_kn):04.1f} kn", 62, 139, COLOR_NEON_GREEN)

    @staticmethod
    def _format_dms(deg_float, is_lat):
        """Converts decimal degrees into DD*MM'SS\"N or DDD*MM'SS\"W string"""
        q1 = chr(39)  # '
        q2 = chr(34)  # "
        if deg_float == 0.0:
            return ("00*00%s00%sN" if is_lat else "000*00%s00%sE") % (q1, q2)
        direction = ('N' if deg_float >= 0 else 'S') if is_lat else ('E' if deg_float >= 0 else 'W')
        d_abs = abs(deg_float)
        deg = int(d_abs)
        min_float = (d_abs - deg) * 60.0
        minutes = int(min_float)
        sec = int((min_float - minutes) * 60.0)
        deg_str = ("%02d" if is_lat else "%03d") % deg
        return "%s*%02d%s%02d%s%s" % (deg_str, minutes, q1, sec, q2, direction)


