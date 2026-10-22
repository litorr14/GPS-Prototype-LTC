"""
Hardware configuration and user parameters for ESP32-C3 SuperMini + GT-U7 + ST7735R.
Store in: Codes/config.py
"""

# ==============================================================================
# PIN DEFINITIONS FOR ESP32-C3 SUPERMINI
# ==============================================================================
# 1.8" TFT ST7735R Display (Hardware SPI)
# Physical Display Header Pins: [1: GND, 2: BL, 3: VCC, 4: CLK, 5: DIN, 6: D/C, 7: CS, 8: RST]
PIN_TFT_CLK  = 4    # TFT Pin 4 (CLK) -> ESP32-C3 GPIO4 (Hardware SPI Clock)
PIN_TFT_DIN  = 6    # TFT Pin 5 (DIN) -> ESP32-C3 GPIO6 (Hardware SPI Data In / MOSI)
PIN_TFT_DC   = 2    # TFT Pin 6 (D/C) -> ESP32-C3 GPIO2 (Data / Command selector)
PIN_TFT_CS   = 7    # TFT Pin 7 (CS)  -> ESP32-C3 GPIO7 (Chip Select)
PIN_TFT_RST  = 1    # TFT Pin 8 (RST) -> ESP32-C3 GPIO1 (Hardware Reset)
PIN_TFT_BL   = 3    # TFT Pin 2 (BL)  -> ESP32-C3 GPIO3 (Backlight PWM Dimming)
# Note: TFT Pin 1 (GND) -> ESP32-C3 GND, TFT Pin 3 (VCC) -> ESP32-C3 3V3

# Aliases for SPI standard terminology
PIN_TFT_SCK  = PIN_TFT_CLK
PIN_TFT_MOSI = PIN_TFT_DIN
PIN_TFT_MISO = None # ST7735 is write-only display

# GT-U7 GPS Module (Hardware UART1)
# Physical GT-U7 Header Sequence (Back side, USB facing away): [1: VCC, 2: GND, 3: RXD, 4: TXD, 5: PPS]
# NOTE UART CROSSOVER CONNECTION:
#   - GT-U7 Pin 3 (RXD - next to GND) connects to ESP32-C3 TX1 (GPIO21)
#   - GT-U7 Pin 4 (TXD - next to PPS) connects to ESP32-C3 RX1 (GPIO20)
PIN_GPS_RX1  = 20   # ESP32-C3 RX1 connects to GT-U7 Pin 4 (TXD)
PIN_GPS_TX1  = 21   # ESP32-C3 TX1 connects to GT-U7 Pin 3 (RXD)
PIN_GPS_PPS  = 10   # GT-U7 Pin 5 (PPS) Pulse Per Second time sync interrupt
GPS_UART_ID  = 1    # Hardware UART 1
GPS_BAUDRATE = 9600 # GT-U7 default baudrate

# Aliases matching machine.UART parameter naming
PIN_GPS_TX = PIN_GPS_RX1 # UART RX input pin
PIN_GPS_RX = PIN_GPS_TX1 # UART TX output pin

# Navigation Buttons (Active LOW with internal pull-up)
PIN_BTN_NEXT = 8    # Next window / cycle screens
PIN_BTN_PREV = 9    # Previous window / zoom out
PIN_BTN_SEL  = 0    # Select / Mark Waypoint / Enter

# ==============================================================================
# DISPLAY CONFIGURATION (ST7735R 1.8" 128x160)
# ==============================================================================
SCREEN_WIDTH  = 128
SCREEN_HEIGHT = 160
SCREEN_ROTATION = 0  # 0: Portrait (128x160), 1: Landscape (160x128), 2: Inverted Portrait, 3: Inverted Landscape

# ST7735R Color Definitions (RGB565 16-bit format)
COLOR_BLACK       = 0x0000
COLOR_WHITE       = 0xFFFF
COLOR_NAVY        = 0x000F
COLOR_DARK_BLUE   = 0x0810
COLOR_BLUE        = 0x001F
COLOR_CYAN        = 0x07FF
COLOR_DARK_CYAN   = 0x03E8
COLOR_GREEN       = 0x07E0
COLOR_NEON_GREEN  = 0x1FE0
COLOR_DARK_GREEN  = 0x03E0
COLOR_YELLOW      = 0xFFE0
COLOR_AMBER       = 0xFDC0
COLOR_ORANGE      = 0xFD20
COLOR_RED         = 0xF800
COLOR_MAGENTA     = 0xF81F
COLOR_GRAY        = 0x7BEF
COLOR_DARK_GRAY   = 0x2104
COLOR_PANEL_BG    = 0x0861

# ==============================================================================
# NAVIGATION & UNITS CONFIGURATION
# ==============================================================================
# Speed units: 'kmh', 'mph', 'knots'
UNIT_SPEED = 'kmh'

# Distance units: 'metric' (m / km), 'imperial' (ft / mi), 'nautical' (nm)
UNIT_DISTANCE = 'metric'

# Timezone offset in hours (e.g. -5 for EST, -4 for EDT, +1 for CET)
TIMEZONE_OFFSET_HOURS = -5

# GPS Filter Thresholds
MIN_SPEED_FOR_COURSE = 1.0   # km/h threshold below which heading is not computed
WAYPOINT_ARRIVAL_RADIUS = 25 # Distance in meters to trigger arrival alert
TRACK_LOG_INTERVAL_SEC = 2   # Frequency to record breadcrumb trail
MAX_TRACK_POINTS = 300       # Memory limit for RAM breadcrumb buffer

# Storage file paths on ESP32 MicroPython flash root
PATH_WAYPOINTS = 'waypoints.json'
PATH_SETTINGS  = 'settings.json'
