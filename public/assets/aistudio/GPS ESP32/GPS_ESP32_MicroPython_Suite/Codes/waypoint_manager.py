"""
Waypoint storage and Direct-To management for MicroPython.
Stores user coordinates into /flash/waypoints.json on ESP32-C3.
Store in: Codes/waypoint_manager.py
"""

import json

DEFAULT_WAYPOINTS = [
    {"name": "WP1",  "lat": 37.7749, "lon": -122.4194, "desc": "Predefined WP 1", "is_fixed": True},
    {"name": "WP2",  "lat": 37.7850, "lon": -122.4080, "desc": "Predefined WP 2", "is_fixed": True},
    {"name": "FIX1", "lat": 0.0,     "lon": 0.0,       "desc": "Fixed Slot 1 (Hold to fix)", "is_fixed": False},
    {"name": "FIX2", "lat": 0.0,     "lon": 0.0,       "desc": "Fixed Slot 2 (Hold to fix)", "is_fixed": False}
]

class WaypointManager:
    def __init__(self, filepath="waypoints.json"):
        self.filepath = filepath
        self.waypoints = []
        self.active_target_idx = 0
        self.load()

    def load(self):
        loaded = False
        # Try primary path, then root-prefixed path
        for path in [self.filepath, "/" + self.filepath.lstrip("/")]:
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                    names = [w.get("name") for w in data if isinstance(w, dict)]
                    # Verify file has WP1 and WP2, and not the old 5 legacy waypoints (BASE, SUMMIT, etc.)
                    if "WP1" in names and "WP2" in names and not ("BASE" in names or "SUMMIT" in names):
                        self.waypoints = data
                        self.filepath = path
                        loaded = True
                        break
                    else:
                        print("Notice: Legacy waypoints found. Upgrading to 2 Predefined + 2 Fixed slots.")
            except Exception:
                pass

        if not loaded:
            self.waypoints = [dict(w) for w in DEFAULT_WAYPOINTS]
            self.save()

    def save(self):
        # Try saving to current path or root path
        last_err = None
        for path in [self.filepath, "/" + self.filepath.lstrip("/")]:
            try:
                with open(path, "w") as f:
                    json.dump(self.waypoints, f)
                self.filepath = path
                return
            except Exception as e:
                last_err = e
        # If flash filesystem is in a read-only or special state in Thonny, warn gracefully
        print("Note: Waypoints stored in memory (flash write notice:", last_err, ")")

    def fix_current_position(self, lat, lon):
        """Fixes current GPS coordinates into FIX1 or FIX2 and persists to flash."""
        fix1_idx = None
        fix2_idx = None
        for i, wp in enumerate(self.waypoints):
            if wp.get('name') == 'FIX1':
                fix1_idx = i
            elif wp.get('name') == 'FIX2':
                fix2_idx = i

        target_idx = None
        if fix1_idx is not None and not self.waypoints[fix1_idx].get('is_fixed', False):
            target_idx = fix1_idx
        elif fix2_idx is not None and not self.waypoints[fix2_idx].get('is_fixed', False):
            target_idx = fix2_idx
        elif fix1_idx is not None and fix2_idx is not None:
            last = getattr(self, '_last_fixed', 'FIX2')
            target_idx = fix1_idx if last == 'FIX2' else fix2_idx
        elif fix1_idx is not None:
            target_idx = fix1_idx
        elif fix2_idx is not None:
            target_idx = fix2_idx
        else:
            self.waypoints.append({"name": "FIX1", "lat": lat, "lon": lon, "desc": "Fixed Slot 1", "is_fixed": True})
            self.save()
            return "FIX1"

        name = self.waypoints[target_idx]['name']
        self.waypoints[target_idx]['lat'] = lat
        self.waypoints[target_idx]['lon'] = lon
        self.waypoints[target_idx]['desc'] = f"Fixed at ({lat:.4f}, {lon:.4f})"
        self.waypoints[target_idx]['is_fixed'] = True
        self._last_fixed = name
        self.active_target_idx = target_idx
        self.save()
        return name

    def add_waypoint(self, name, lat, lon, desc=""):
        wp = {"name": name.upper(), "lat": lat, "lon": lon, "desc": desc}
        self.waypoints.append(wp)
        self.save()

    def set_active_target(self, idx):
        if len(self.waypoints) > 0:
            self.active_target_idx = idx % len(self.waypoints)

    def get_active_target(self):
        if 0 <= self.active_target_idx < len(self.waypoints):
            return self.waypoints[self.active_target_idx]
        return None
