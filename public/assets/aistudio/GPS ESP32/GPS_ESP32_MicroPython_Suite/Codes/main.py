# ESP32-C3 SuperMini + GT-U7 GPS + ST7735R 1.8in TFT Navigation Computer
# Main MicroPython Firmware Application
# Target Hardware: ESP32-C3 SuperMini (RISC-V)

import time
import gc
from machine import Pin, SPI, UART

from config import (
    PIN_TFT_CLK, PIN_TFT_DIN, PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_RST, PIN_TFT_BL,
    PIN_GPS_RX1, PIN_GPS_TX1, GPS_UART_ID, GPS_BAUDRATE,
    PIN_BTN_NEXT, PIN_BTN_PREV, PIN_BTN_SEL,
    SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_ROTATION
)
from st7735 import ST7735
from gps_parser import GPSParser
from nav_engine import NavEngine
from offline_map import OfflineMap
from waypoint_manager import WaypointManager
from ui_screens import UIManager
from buttons import ButtonController
from gpx_logger import GPXLogger

def main():
    print("==================================================")
    print("ESP32-C3 GPS NAVIGATOR BOOTING...")
    print("GT-U7 GPS & ST7735R 1.8in SPI TFT")
    print("==================================================")

    # 1. Initialize Hardware SPI for ST7735R
    # Pins: CLK=GPIO4, DIN=GPIO6, CS=GPIO7, D/C=GPIO2, RST=GPIO1, BL=GPIO3
    spi = SPI(1, baudrate=20000000, polarity=0, phase=0,
              sck=Pin(PIN_TFT_CLK), mosi=Pin(PIN_TFT_DIN))

    tft = ST7735(spi, cs_pin=PIN_TFT_CS, dc_pin=PIN_TFT_DC,
                 rst_pin=PIN_TFT_RST, bl_pin=PIN_TFT_BL,
                 width=SCREEN_WIDTH, height=SCREEN_HEIGHT,
                 rotation=SCREEN_ROTATION)

    # Boot splash screen
    tft.fill(0x0000)
    tft.text("ESP32-C3 GPS", 16, 50, 0x07FF) # Cyan
    tft.text("GT-U7 + ST7735", 10, 70, 0xFFE0) # Yellow
    tft.text("Booting HMI...", 16, 95, 0xFFFF) # White
    tft.show()
    time.sleep_ms(800)

    # 2. Initialize Hardware UART for GT-U7 GPS
    # Note: ESP32-C3 TX1 (GPIO21) transmits to GT-U7 RXD (Pin 3)
    #       ESP32-C3 RX1 (GPIO20) receives from GT-U7 TXD (Pin 4)
    uart = UART(GPS_UART_ID, baudrate=GPS_BAUDRATE,
                tx=Pin(PIN_GPS_TX1), rx=Pin(PIN_GPS_RX1),
                timeout=10, rxbuf=1024)

    # 3. Instantiate Navigation, Logger & Storage Subsystems
    gps = GPSParser()
    nav = NavEngine()
    wp_manager = WaypointManager()
    map_engine = OfflineMap(tft, width=128, height=145, y_offset=15)
    ui = UIManager(tft, gps, nav, map_engine, wp_manager)
    buttons = ButtonController(pin_next=PIN_BTN_NEXT, pin_prev=PIN_BTN_PREV, pin_sel=PIN_BTN_SEL)
    gpx = GPXLogger(filepath="/route.gpx")

    # Set default target waypoint if available
    active_target = wp_manager.get_active_target()
    if active_target:
        nav.set_target(active_target['name'], active_target['lat'], active_target['lon'])

    print("Subsystems initialized. 7 Navigation Windows active.")
    print("GPX Route Recording initialized -> /route.gpx")

    last_ui_refresh = time.ticks_ms()
    last_nav_update = time.ticks_ms()
    last_gc = time.ticks_ms()

    # Main Cooperative Non-Blocking Loop
    while True:
        # A. Ingest available GPS serial bytes
        if uart.any():
            raw_bytes = uart.read(128)
            if raw_bytes:
                try:
                    text = raw_bytes.decode('ascii', 'ignore')
                    gps.update(text)
                except Exception as e:
                    pass

        # B. Poll Hardware Navigation Buttons
        btn_events = buttons.poll()

        if btn_events['next'] == "CLICK":
            ui.next_window()
            print(">> Window Forward -> [", ui.current_window, "]")

        elif btn_events['prev'] == "CLICK":
            ui.prev_window()
            print("<< Window Back <- [", ui.current_window, "]")

        elif btn_events['sel'] == "CLICK":
            if ui.current_window == 1:
                # Cycle map zoom level on click (wraps 200m -> 15k)
                map_engine.zoom_in()
                print("Map Zoom changed:", map_engine.get_zoom_meters(), "m")
            elif ui.current_window == 4:
                # Cycle to next waypoint and activate Direct-To
                ui.selected_wp_idx = (ui.selected_wp_idx + 1) % len(wp_manager.waypoints)
                wp_manager.set_active_target(ui.selected_wp_idx)
                target = wp_manager.get_active_target()
                if target:
                    if "FIX" in target['name'] and not target.get('is_fixed', True) and gps.valid_fix:
                        wp_manager.fix_current_position(gps.latitude, gps.longitude)
                        target = wp_manager.get_active_target()
                    if target and target.get('is_fixed', True):
                        nav.set_target(target['name'], target['lat'], target['lon'],
                                       gps.latitude, gps.longitude)
                print("Selected Waypoint:", target['name'] if target else "None")
            elif ui.current_window in (0, 2, 6):
                # Reset trip odometer on HUD, Trip, or Marine windows
                nav.reset_trip()
                print("Trip Odometer Reset.")
            else:
                print("Action button clicked on window", ui.current_window)

        elif btn_events['sel'] == "LONG_PRESS":
            # Quick Fix Current Location into FIX1 or FIX2
            if gps.valid_fix:
                fixed_name = wp_manager.fix_current_position(gps.latitude, gps.longitude)
                print(">> Position Fixed into:", fixed_name, f"({gps.latitude:.5f}, {gps.longitude:.5f})")
                target = wp_manager.get_active_target()
                if target:
                    nav.set_target(target['name'], target['lat'], target['lon'],
                                   gps.latitude, gps.longitude)
            else:
                print("Cannot fix waypoint: Waiting for 3D GPS fix.")

        # C. Navigation, Breadcrumb & GPX Logging Update (every 500ms)
        now = time.ticks_ms()
        if time.ticks_diff(now, last_nav_update) >= 500:
            last_nav_update = now
            nav.update(gps.latitude, gps.longitude, gps.speed_kmh, gps.course_deg, gps.valid_fix)
            if gps.valid_fix:
                map_engine.add_breadcrumb(gps.latitude, gps.longitude)
                gpx.log_point(gps.latitude, gps.longitude, gps.altitude_m,
                              gps.utc_hour, gps.utc_min, gps.utc_sec,
                              gps.utc_day, gps.utc_month, gps.utc_year)

        # D. Display UI Refresh (every 100ms = 10 FPS)
        if time.ticks_diff(now, last_ui_refresh) >= 100:
            last_ui_refresh = now
            ui.render_current_window()

        # E. Periodic Garbage Collection to prevent heap fragmentation
        if time.ticks_diff(now, last_gc) >= 5000:
            last_gc = now
            gc.collect()

# Run automatically on boot or import
try:
    main()
except KeyboardInterrupt:
    print("\nProgram stopped by user.")
