"""
Streaming NMEA 0183 parser optimized for ESP32-C3 MicroPython.
Parses $GNRMC, $GNGGA, $GNGSA, and $GPGSV sentences from GT-U7 GPS.
Store in: Codes/gps_parser.py
"""

class GPSParser:
    def __init__(self):
        # Position & Motion
        self.valid_fix = False
        self.latitude = 0.0      # Decimal degrees (+ North, - South)
        self.longitude = 0.0     # Decimal degrees (+ East, - West)
        self.altitude_m = 0.0    # Meters above sea level
        self.speed_kmh = 0.0     # Speed in km/h
        self.speed_knots = 0.0   # Speed in knots
        self.course_deg = 0.0    # Course over ground in degrees (0-359.9)

        # Time & Date (UTC)
        self.utc_hour = 0
        self.utc_min = 0
        self.utc_sec = 0
        self.utc_day = 1
        self.utc_month = 1
        self.utc_year = 2026

        # Quality & Satellites
        self.satellites_in_use = 0
        self.satellites_in_view = 0
        self.fix_quality = 0      # 0=Invalid, 1=GPS, 2=DGPS
        self.fix_mode = '1'       # 1=No fix, 2=2D, 3=3D
        self.hdop = 99.99         # Horizontal dilution of precision
        self.pdop = 99.99

        # Detailed satellite tracker: list of dicts: {'id': 12, 'elev': 45, 'azimuth': 130, 'snr': 38}
        self.satellites = []
        self._temp_sats = []

        # Internal line buffer
        self._buf = ""

    def update(self, char_or_string):
        """Feeds raw characters from UART into the parser."""
        new_sentence = False
        for c in char_or_string:
            if c == '$':
                self._buf = "$"
            elif c in ('\r', '\n'):
                if self._buf.startswith('$'):
                    self._parse_sentence(self._buf)
                    new_sentence = True
                self._buf = ""
            else:
                if len(self._buf) < 120:
                    self._buf += c
        return new_sentence

    def _verify_checksum(self, sentence):
        if '*' not in sentence:
            return True
        body, chk = sentence[1:].split('*', 1)
        calc_chk = 0
        for b in body:
            calc_chk ^= ord(b)
        try:
            return calc_chk == int(chk[:2], 16)
        except ValueError:
            return False

    def _parse_sentence(self, sentence):
        if not self._verify_checksum(sentence):
            return

        # Strip checksum
        core = sentence[1:].split('*')[0]
        tokens = core.split(',')
        talker_type = tokens[0]

        # Match last 3 letters: RMC, GGA, GSA, GSV
        cmd = talker_type[-3:]

        if cmd == 'RMC':
            self._parse_rmc(tokens)
        elif cmd == 'GGA':
            self._parse_gga(tokens)
        elif cmd == 'GSA':
            self._parse_gsa(tokens)
        elif cmd == 'GSV':
            self._parse_gsv(tokens)

    def _parse_rmc(self, tokens):
        # Format: $GNRMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,,,a*hh
        if len(tokens) < 10:
            return

        # Status: A=active (valid), V=void (warning)
        self.valid_fix = (tokens[2] == 'A')

        # UTC Time
        if tokens[1] and len(tokens[1]) >= 6:
            try:
                self.utc_hour = int(tokens[1][0:2])
                self.utc_min = int(tokens[1][2:4])
                self.utc_sec = int(tokens[1][4:6])
            except ValueError:
                pass

        # Latitude & Longitude
        if self.valid_fix and tokens[3] and tokens[5]:
            self.latitude = self._convert_coord(tokens[3], tokens[4])
            self.longitude = self._convert_coord(tokens[5], tokens[6])

        # Speed (knots to km/h)
        if tokens[7]:
            try:
                self.speed_knots = float(tokens[7])
                self.speed_kmh = self.speed_knots * 1.852
            except ValueError:
                pass

        # Course over ground
        if tokens[8]:
            try:
                self.course_deg = float(tokens[8])
            except ValueError:
                pass

        # Date
        if tokens[9] and len(tokens[9]) >= 6:
            try:
                self.utc_day = int(tokens[9][0:2])
                self.utc_month = int(tokens[9][2:4])
                self.utc_year = 2000 + int(tokens[9][4:6])
            except ValueError:
                pass

    def _parse_gga(self, tokens):
        # Format: $GNGGA,hhmmss.ss,llll.ll,a,yyyyy.yy,a,x,xx,x.x,x.x,M,x.x,M,,*hh
        if len(tokens) < 10:
            return

        if tokens[6]:
            try:
                self.fix_quality = int(tokens[6])
                self.valid_fix = (self.fix_quality > 0)
            except ValueError:
                pass

        if tokens[7]:
            try:
                self.satellites_in_use = int(tokens[7])
            except ValueError:
                pass

        if tokens[8]:
            try:
                self.hdop = float(tokens[8])
            except ValueError:
                pass

        if tokens[9]:
            try:
                self.altitude_m = float(tokens[9])
            except ValueError:
                pass

    def _parse_gsa(self, tokens):
        # Format: $GNGSA,a,x,xx,xx,...,x.x,x.x,x.x*hh
        if len(tokens) >= 3:
            self.fix_mode = tokens[2] # 1=No fix, 2=2D fix, 3=3D fix
        if len(tokens) >= 17 and tokens[16]:
            try:
                self.hdop = float(tokens[16])
            except ValueError:
                pass

    def _parse_gsv(self, tokens):
        # Format: $GPGSV,num_msgs,msg_num,total_sats,sv_prn,elev,azim,snr,...*hh
        if len(tokens) < 4:
            return
        try:
            total_msgs = int(tokens[1])
            msg_num = int(tokens[2])
            self.satellites_in_view = int(tokens[3])
        except ValueError:
            return

        if msg_num == 1:
            self._temp_sats = []

        # Read up to 4 satellites per sentence
        for i in range(4, len(tokens) - 3, 4):
            try:
                prn = int(tokens[i]) if tokens[i] else 0
                elev = int(tokens[i+1]) if tokens[i+1] else 0
                azim = int(tokens[i+2]) if tokens[i+2] else 0
                snr = int(tokens[i+3]) if tokens[i+3] else 0
                if prn > 0:
                    self._temp_sats.append({
                        'prn': prn,
                        'elev': elev,
                        'azim': azim,
                        'snr': snr
                    })
            except (ValueError, IndexError):
                pass

        if msg_num == total_msgs:
            self.satellites = self._temp_sats

    def _convert_coord(self, coord_str, direction):
        """Converts ddmm.mmmm NMEA format to decimal degrees"""
        try:
            idx = coord_str.find('.')
            if idx == -1:
                return 0.0
            deg_digits = idx - 2
            deg = float(coord_str[:deg_digits])
            minutes = float(coord_str[deg_digits:])
            decimal = deg + (minutes / 60.0)
            if direction in ('S', 'W'):
                decimal = -decimal
            return decimal
        except (ValueError, IndexError):
            return 0.0
