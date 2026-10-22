# Standalone Button Hardware Verification Script
# Run this in Thonny and press your buttons to confirm each pin works!

import time
from machine import Pin

print("========================================")
print("TESTING NAVIGATION BUTTONS ON ESP32-C3...")
print("Button 1: GPIO8 -> Touch to GND (NEXT WINDOW)")
print("Button 2: GPIO9 -> Touch to GND (PREV WINDOW)")
print("Button 3: GPIO0 -> Touch to GND (SELECT/ACTION)")
print("========================================")
print("Press buttons now. Output will appear below:\n")

b8 = Pin(8, Pin.IN, Pin.PULL_UP)
b9 = Pin(9, Pin.IN, Pin.PULL_UP)
b0 = Pin(0, Pin.IN, Pin.PULL_UP)

last_vals = [1, 1, 1]

try:
    while True:
        v8 = b8.value()
        v9 = b9.value()
        v0 = b0.value()

        if v8 == 0 and last_vals[0] == 1:
            print("[BUTTON 1] GPIO8 CLICKED! -> NEXT WINDOW OK")
        if v9 == 0 and last_vals[1] == 1:
            print("[BUTTON 2] GPIO9 CLICKED! -> PREV WINDOW OK")
        if v0 == 0 and last_vals[2] == 1:
            print("[BUTTON 3] GPIO0 CLICKED! -> SELECT / ACTION OK")

        last_vals = [v8, v9, v0]
        time.sleep_ms(25)
except KeyboardInterrupt:
    print("\nButton test stopped.")
