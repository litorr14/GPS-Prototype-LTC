"""
Navigation engine and geodesic math for MicroPython on ESP32-C3.
Provides:
  - Haversine distance (Great Circle)
  - Initial forward bearing / azimuth
  - Cross-Track Error (XTE)
  - Velocity Made Good (VMG) and Estimated Time of Arrival (ETA)
  - Trip statistics: Odometer, Max Speed, Moving/Stopped Time
Store in: Codes/nav_engine.py
"""

import math
import time

EARTH_RADIUS_METERS = 6371000.0

class NavEngine:
    def __init__(self):
        # Current Target Waypoint
        self.target_name = "NONE"
        self.target_lat = 0.0
        self.target_lon = 0.0
        self.origin_lat = 0.0
        self.origin_lon = 0.0

        # Calculated Navigation Metrics
        self.distance_to_target_m = 0.0
        self.bearing_to_target_deg = 0.0
        self.relative_bearing_deg = 0.0   # Difference between heading and bearing
        self.cross_track_error_m = 0.0   # Distance off track (+ right, - left)
        self.eta_seconds = 0             # Seconds remaining to destination
        self.vmg_kmh = 0.0               # Velocity Made Good toward destination

        # Trip Computer State
        self.trip_distance_m = 0.0
        self.odometer_total_m = 0.0
        self.max_speed_kmh = 0.0
        self.avg_moving_speed_kmh = 0.0
        self.moving_time_sec = 0
        self.stopped_time_sec = 0
        self.start_timestamp = time.time()
        self.last_update_time = time.time()

        self._last_lat = None
        self._last_lon = None

    def set_target(self, name, target_lat, target_lon, current_lat=None, current_lon=None):
        """Sets active destination waypoint. Defines baseline leg for XTE."""
        self.target_name = name
        self.target_lat = target_lat
        self.target_lon = target_lon
        if current_lat is not None and current_lon is not None:
            self.origin_lat = current_lat
            self.origin_lon = current_lon
        else:
            self.origin_lat = target_lat
            self.origin_lon = target_lon

    def update(self, current_lat, current_lon, current_speed_kmh, current_course_deg, valid_fix):
        now = time.time()
        dt = now - self.last_update_time
        if dt < 0.1:
            dt = 0.1
        self.last_update_time = now

        if not valid_fix:
            return

        # 1. Update Trip Odometer
        if self._last_lat is not None and self._last_lon is not None:
            step_dist = self.calculate_distance(self._last_lat, self._last_lon, current_lat, current_lon)
            # Filter GPS jitter: only count distance if moved > 2m or speed > 1.2 km/h
            if step_dist > 2.0 or current_speed_kmh > 1.2:
                self.trip_distance_m += step_dist
                self.odometer_total_m += step_dist

        self._last_lat = current_lat
        self._last_lon = current_lon

        # 2. Update Speed & Times
        if current_speed_kmh > self.max_speed_kmh:
            self.max_speed_kmh = current_speed_kmh

        if current_speed_kmh > 1.5:
            self.moving_time_sec += int(dt)
        else:
            self.stopped_time_sec += int(dt)

        if self.moving_time_sec > 0:
            # Average moving speed in km/h = (distance_m / 1000) / (hours)
            self.avg_moving_speed_kmh = (self.trip_distance_m / 1000.0) / (self.moving_time_sec / 3600.0)

        # 3. Calculate Target Geodesics
        if self.target_name != "NONE":
            self.distance_to_target_m = self.calculate_distance(
                current_lat, current_lon, self.target_lat, self.target_lon
            )
            self.bearing_to_target_deg = self.calculate_bearing(
                current_lat, current_lon, self.target_lat, self.target_lon
            )

            # Relative Bearing (-180 to +180)
            diff = self.bearing_to_target_deg - current_course_deg
            while diff > 180.0:
                diff -= 360.0
            while diff < -180.0:
                diff += 360.0
            self.relative_bearing_deg = diff

            # Cross-Track Error
            self.cross_track_error_m = self.calculate_xte(
                self.origin_lat, self.origin_lon,
                self.target_lat, self.target_lon,
                current_lat, current_lon
            )

            # Velocity Made Good & ETA
            # VMG = speed * cos(relative_bearing)
            rad_rel = math.radians(diff)
            self.vmg_kmh = max(0.0, current_speed_kmh * math.cos(rad_rel))

            speed_mps = (current_speed_kmh / 3.6)
            if speed_mps > 0.8:
                self.eta_seconds = int(self.distance_to_target_m / speed_mps)
            else:
                self.eta_seconds = 0

    @staticmethod
    def calculate_distance(lat1, lon1, lat2, lon2):
        """Haversine formula for Great Circle distance in meters."""
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return EARTH_RADIUS_METERS * c

    @staticmethod
    def calculate_bearing(lat1, lon1, lat2, lon2):
        """Calculates initial forward azimuth (bearing) from Point 1 to Point 2 in degrees (0-359.9)."""
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_lambda = math.radians(lon2 - lon1)

        y = math.sin(delta_lambda) * math.cos(phi2)
        x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
        theta = math.atan2(y, x)
        bearing = (math.degrees(theta) + 360.0) % 360.0
        return bearing

    @staticmethod
    def calculate_xte(lat_start, lon_start, lat_end, lon_end, lat_cur, lon_cur):
        """Cross-Track Error (XTE) in meters off the Great Circle path."""
        d13 = NavEngine.calculate_distance(lat_start, lon_start, lat_cur, lon_cur) / EARTH_RADIUS_METERS
        theta13 = math.radians(NavEngine.calculate_bearing(lat_start, lon_start, lat_cur, lon_cur))
        theta12 = math.radians(NavEngine.calculate_bearing(lat_start, lon_start, lat_end, lon_end))

        # Cross-track angular distance
        dxt = math.asin(math.sin(d13) * math.sin(theta13 - theta12))
        return dxt * EARTH_RADIUS_METERS

    def reset_trip(self):
        self.trip_distance_m = 0.0
        self.max_speed_kmh = 0.0
        self.avg_moving_speed_kmh = 0.0
        self.moving_time_sec = 0
        self.stopped_time_sec = 0
