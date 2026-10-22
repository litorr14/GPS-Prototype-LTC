"""
Vector map and breadcrumb track renderer for ST7735 128x160 display.
Optimized for low RAM footprint on ESP32-C3.
Store in: Codes/offline_map.py
"""

import math
from config import (
    COLOR_BLACK, COLOR_CYAN, COLOR_YELLOW, COLOR_NEON_GREEN,
    COLOR_AMBER, COLOR_RED, COLOR_DARK_GRAY, COLOR_WHITE, COLOR_PANEL_BG
)

class OfflineMap:
    def __init__(self, display, width=128, height=136, y_offset=16):
        self.tft = display
        self.width = width
        self.height = height
        self.y_offset = y_offset # Space below top status bar

        # Zoom levels: meters represented per screen height (e.g. 200m, 500m, 1km, 5km, 20km)
        self.zoom_levels = [200, 500, 1000, 2500, 5000, 15000]
        self.zoom_idx = 1 # Default 500m view

        # Breadcrumb Track Buffer (circular buffer of (lat, lon))
        self.track_points = []
        self.max_points = 250
        self.last_recorded_lat = None
        self.last_recorded_lon = None

    def zoom_in(self):
        """Zoom in closer step-by-step; after 200m, wrap back around to 15k"""
        if self.zoom_idx > 0:
            self.zoom_idx -= 1
        else:
            self.zoom_idx = len(self.zoom_levels) - 1  # Wrap back to 15000m (15k)

    def zoom_out(self):
        """Zoom out wider; after 15k, wrap back around to 200m"""
        if self.zoom_idx < len(self.zoom_levels) - 1:
            self.zoom_idx += 1
        else:
            self.zoom_idx = 0  # Wrap back to 200m

    def get_zoom_meters(self):
        return self.zoom_levels[self.zoom_idx]

    def add_breadcrumb(self, lat, lon):
        """Appends current position to the trail if moved > 5 meters."""
        if self.last_recorded_lat is not None:
            # MicroPython math module does not implement math.hypot; use math.sqrt
            d_lat = (lat - self.last_recorded_lat) * 111320.0
            d_lon = (lon - self.last_recorded_lon) * 111320.0 * math.cos(math.radians(lat))
            d = math.sqrt(d_lat * d_lat + d_lon * d_lon)
            if d < 5.0:
                return

        self.last_recorded_lat = lat
        self.last_recorded_lon = lon

        if len(self.track_points) >= self.max_points:
            self.track_points.pop(0)
        self.track_points.append((lat, lon))

    def latlon_to_screen(self, center_lat, center_lon, lat, lon):
        """Converts latitude/longitude to 2D pixel coordinates relative to center position."""
        meters_span = self.get_zoom_meters()
        meters_per_pixel = meters_span / float(self.height)

        # Delta in meters (equirectangular approximation)
        dy = (lat - center_lat) * 111320.0
        dx = (lon - center_lon) * 111320.0 * math.cos(math.radians(center_lat))

        screen_x = int(self.width / 2.0 + (dx / meters_per_pixel))
        screen_y = int(self.y_offset + (self.height / 2.0) - (dy / meters_per_pixel))
        return screen_x, screen_y

    def render(self, cur_lat, cur_lon, course_deg, waypoints, target_wp=None):
        # 1. Fill Map Canvas Background
        self.tft.fill_rect(0, self.y_offset, self.width, self.height, COLOR_BLACK)

        # 2. Render Distance Range Circles / Crosshairs
        cx = self.width // 2
        cy = self.y_offset + (self.height // 2)

        # Grid lines
        self.tft.line(cx - 10, cy, cx + 10, cy, COLOR_DARK_GRAY)
        self.tft.line(cx, cy - 10, cx, cy + 10, COLOR_DARK_GRAY)

        # Range ring (represents half zoom radius)
        r = self.height // 4
        self.tft.rect(cx - r, cy - r, r * 2, r * 2, COLOR_DARK_GRAY)

        # North Reference Indicator Line (from center toward True North)
        north_y = max(self.y_offset + 5, cy - 36)
        self.tft.line(cx, cy, cx, north_y, COLOR_RED)
        self.tft.text("N", cx - 3, north_y - 3, COLOR_RED)

        # 3. Draw Breadcrumb Trail
        if len(self.track_points) > 1:
            prev_pt = None
            for pt in self.track_points:
                sx, sy = self.latlon_to_screen(cur_lat, cur_lon, pt[0], pt[1])
                if prev_pt is not None:
                    px, py = prev_pt
                    # Clip to map boundaries
                    if 0 <= sx < self.width and self.y_offset <= sy < self.y_offset + self.height:
                        if 0 <= px < self.width and self.y_offset <= py < self.y_offset + self.height:
                            self.tft.line(px, py, sx, sy, COLOR_CYAN)
                prev_pt = (sx, sy)

        # 4. Draw Waypoints (skip unfixed slots)
        for wp in waypoints:
            if wp.get('is_fixed', True) is False or (wp.get('lat') == 0.0 and wp.get('lon') == 0.0):
                continue
            wx, wy = self.latlon_to_screen(cur_lat, cur_lon, wp['lat'], wp['lon'])
            if -10 <= wx < self.width + 10 and self.y_offset - 10 <= wy < self.y_offset + self.height + 10:
                is_target = (target_wp and wp['name'] == target_wp.get('name'))
                color = COLOR_YELLOW if is_target else COLOR_AMBER

                # Draw diamond marker
                self.tft.fill_rect(wx - 2, wy - 2, 5, 5, color)
                # Label
                self.tft.text(wp['name'][:4], wx + 4, wy - 3, color)

                # If active destination, draw dashed vector line to it
                if is_target:
                    self.tft.line(cx, cy, wx, wy, COLOR_NEON_GREEN)

        # 5. Draw Self Position Heading Arrow (Carrot)
        self._draw_heading_arrow(cx, cy, course_deg, COLOR_RED)

        # 6. Draw Map HUD Overlay: Scale ruler & Zoom level
        zoom_m = self.get_zoom_meters()
        scale_txt = f"{zoom_m}m" if zoom_m < 1000 else f"{zoom_m // 1000}km"
        self.tft.fill_rect(2, self.y_offset + self.height - 12, 48, 10, COLOR_PANEL_BG)
        self.tft.text(scale_txt, 4, self.y_offset + self.height - 11, COLOR_WHITE)

    def _draw_heading_arrow(self, cx, cy, angle_deg, color):
        """Draws directional triangle oriented toward current course."""
        rad = math.radians(angle_deg)
        size = 6

        # Tip
        x0 = int(cx + size * math.sin(rad))
        y0 = int(cy - size * math.cos(rad))

        # Left wing
        rad_left = rad + 2.4
        x1 = int(cx + size * math.sin(rad_left))
        y1 = int(cy - size * math.cos(rad_left))

        # Right wing
        rad_right = rad - 2.4
        x2 = int(cx + size * math.sin(rad_right))
        y2 = int(cy - size * math.cos(rad_right))

        self.tft.line(x0, y0, x1, y1, color)
        self.tft.line(x1, y1, cx, cy, color)
        self.tft.line(cx, cy, x2, y2, color)
        self.tft.line(x2, y2, x0, y0, color)
