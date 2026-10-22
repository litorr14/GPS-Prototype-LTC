"""
Hardware button driver for ESP32-C3 SuperMini.
Supports debouncing, short click, and long press (e.g. hold to mark waypoint).
Store in: Codes/buttons.py
"""

import time
from machine import Pin

class Button:
    """
    Robust state-machine debouncer for mechanical tactile push buttons.
    Filters contact chatter on both press and release transitions.
    """
    def __init__(self, pin_num, name="BTN", debounce_ms=180, long_press_ms=800):
        self.pin = Pin(pin_num, Pin.IN, Pin.PULL_UP)
        self.name = name
        self.debounce_ms = debounce_ms
        self.long_press_ms = long_press_ms
        self.state = 1               # Debounced state (1=idle/released, 0=pressed)
        self.last_raw = 1            # Last instantaneous reading
        self.last_change_time = 0    # Timestamp when raw pin changed
        self.press_start_time = 0
        self.long_fired = False

    def update(self):
        raw = self.pin.value()
        now = time.ticks_ms()
        event = None

        # Detect raw transition and start settling timer
        if raw != self.last_raw:
            self.last_raw = raw
            self.last_change_time = now

        # Only accept state transition after raw signal remains stable for >= 25ms
        if time.ticks_diff(now, self.last_change_time) >= 25:
            if raw != self.state:
                if raw == 0 and self.state == 1:
                    # Valid transition to PRESSED (with debounce lockout)
                    if time.ticks_diff(now, self.press_start_time) > self.debounce_ms:
                        self.state = 0
                        self.press_start_time = now
                        self.long_fired = False
                        event = "CLICK"
                elif raw == 1 and self.state == 0:
                    # Valid transition to RELEASED (cleans up any release bounce)
                    self.state = 1
                    self.long_fired = False

        # Long press detection while held down
        if self.state == 0 and not self.long_fired:
            if time.ticks_diff(now, self.press_start_time) >= self.long_press_ms:
                self.long_fired = True
                event = "LONG_PRESS"

        return event

class ButtonController:
    def __init__(self, pin_next=8, pin_prev=9, pin_sel=0):
        self.btn_next = Button(pin_next, "NEXT")
        self.btn_prev = Button(pin_prev, "PREV")
        self.btn_sel  = Button(pin_sel,  "SELECT")

    def poll(self):
        """Returns dict of events: {'next': evt, 'prev': evt, 'sel': evt}"""
        return {
            'next': self.btn_next.update(),
            'prev': self.btn_prev.update(),
            'sel':  self.btn_sel.update(),
        }
