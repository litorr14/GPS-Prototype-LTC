# Standalone GT-U7 GPS Serial Test Script
# Run this directly in Thonny to view incoming NMEA data stream

import time
from machine import Pin, UART

print("========================================")
print("TESTING GT-U7 GPS SERIAL UART STREAM...")
print("Wiring: GPS Pin 3 (RXD) -> ESP32 GPIO21 (TX)")
print("        GPS Pin 4 (TXD) -> ESP32 GPIO20 (RX)")
print("========================================")

# UART1: TX=GPIO21, RX=GPIO20 at 9600 baud
uart = UART(1, baudrate=9600, tx=Pin(21), rx=Pin(20), timeout=200)

print("Listening for NMEA sentences ($GNRMC, $GNGGA)...")
print("Press Ctrl+C to stop.\n")

try:
    while True:
        if uart.any():
            raw = uart.readline()
            if raw:
                try:
                    line = raw.decode('utf-8', 'ignore').strip()
                    if line.startswith('$'):
                        print("[GPS]", line)
                except Exception:
                    print("[RAW]", raw)
        time.sleep_ms(20)
except KeyboardInterrupt:
    print("\nGPS test stopped.")
