# Standalone 1.8in ST7735R SPI Display Test Script
# Run this directly in Thonny to test screen illumination and colors

import time
from machine import Pin, SPI
from st7735 import ST7735

print("========================================")
print("TESTING ST7735R 1.8in SPI DISPLAY...")
print("If screen stays dark, connect Pin 2 (BL)")
print("directly to ESP32-C3 3V3!")
print("========================================")

# 1. Drive Backlight pin HIGH immediately (Pin 2 BL -> GPIO3)
bl = Pin(3, Pin.OUT, value=1)
print("Backlight on GPIO3 set to HIGH.")

# 2. Hardware SPI (Pin 4 CLK -> GPIO4, Pin 5 DIN -> GPIO6)
spi = SPI(1, baudrate=20000000, polarity=0, phase=0, sck=Pin(4), mosi=Pin(6))

# 3. Initialize ST7735 (Pin 7 CS -> GPIO7, Pin 6 D/C -> GPIO2, Pin 8 RST -> GPIO1)
tft = ST7735(spi, cs_pin=7, dc_pin=2, rst_pin=1, bl_pin=3)

# 4. Fill screen with test colors
print("1/3 Filling RED...")
tft.fill(0xF800)
tft.show()
time.sleep(1)

print("2/3 Filling GREEN...")
tft.fill(0x07E0)
tft.show()
time.sleep(1)

print("3/3 Filling BLUE with text...")
tft.fill(0x001F)
tft.text("ST7735R 1.8in", 16, 40, 0xFFFF)
tft.text("ESP32-C3 OK!", 18, 65, 0xFFE0)
tft.text("DISPLAY READY", 14, 90, 0x07FF)
tft.show()

print("Display test completed successfully!")
