"""
ST7735 / ST7735R 1.8" 128x160 SPI TFT Display Driver for MicroPython on ESP32-C3.
Optimized for high refresh rate using machine.SPI and framebuf.
Store in: Codes/st7735.py
"""

import time
from machine import Pin, SPI, PWM
import framebuf

# ST7735 System Commands
SWRESET = 0x01
SLPOUT  = 0x11
NORON   = 0x13
INVOFF  = 0x20
INVON   = 0x21
DISPOFF = 0x28
DISPON  = 0x29
CASET   = 0x2A
RASET   = 0x2B
RAMWR   = 0x2C
MADCTL  = 0x36
COLMOD  = 0x3A

# ST7735 Specific Commands
FRMCTR1 = 0xB1
FRMCTR2 = 0xB2
FRMCTR3 = 0xB3
INVCTR  = 0xB4
PWCTR1  = 0xC0
PWCTR2  = 0xC1
PWCTR3  = 0xC2
PWCTR4  = 0xC3
PWCTR5  = 0xC4
VMCTR1  = 0xC5
GMCTRP1 = 0xE0
GMCTRN1 = 0xE1

class ST7735:
    def __init__(self, spi, cs_pin, dc_pin, rst_pin=None, bl_pin=None,
                 width=128, height=160, rotation=0):
        self.spi = spi
        self.cs = Pin(cs_pin, Pin.OUT, value=1)
        self.dc = Pin(dc_pin, Pin.OUT, value=0)
        self.rst = Pin(rst_pin, Pin.OUT, value=1) if rst_pin is not None else None
        self.bl = None
        self.bl_pwm = None
        if bl_pin is not None:
            # Force backlight pin HIGH immediately to light up the display
            self.bl = Pin(bl_pin, Pin.OUT, value=1)
            try:
                self.bl_pwm = PWM(self.bl, freq=1000)
                self.set_brightness(100)
            except Exception:
                self.bl_pwm = None

        self.width = width
        self.height = height
        self.rotation = rotation

        # 128x160 16-bit RGB565 Framebuffer (128 * 160 * 2 = 40,960 bytes)
        self.buffer = bytearray(self.width * self.height * 2)
        self.fb = framebuf.FrameBuffer(self.buffer, self.width, self.height, framebuf.RGB565)

        self.col_offset = 0
        self.row_offset = 0

        self.reset()
        self.init_display()
        self.set_rotation(self.rotation)

    def write_cmd(self, cmd):
        self.dc.value(0)
        self.cs.value(0)
        self.spi.write(bytearray([cmd]))
        self.cs.value(1)

    def write_data(self, data):
        self.dc.value(1)
        self.cs.value(0)
        if isinstance(data, int):
            self.spi.write(bytearray([data]))
        else:
            self.spi.write(data)
        self.cs.value(1)

    def reset(self):
        if self.rst:
            self.rst.value(0)
            time.sleep_ms(50)
            self.rst.value(1)
            time.sleep_ms(50)

    def set_brightness(self, percent):
        """Set backlight duty cycle 0-100%"""
        if self.bl_pwm is not None:
            try:
                # Modern MicroPython duty_u16 (0-65535)
                duty = int((percent / 100.0) * 65535)
                self.bl_pwm.duty_u16(duty)
            except Exception:
                duty = int((percent / 100.0) * 1023)
                self.bl_pwm.duty(duty)
        elif self.bl is not None:
            self.bl.value(1 if percent > 0 else 0)

    def init_display(self):
        self.write_cmd(SWRESET)
        time.sleep_ms(150)
        self.write_cmd(SLPOUT)
        time.sleep_ms(255)

        # Frame rate control: 0x01, 0x2C, 0x2D
        self.write_cmd(FRMCTR1)
        self.write_data(bytearray([0x01, 0x2C, 0x2D]))
        self.write_cmd(FRMCTR2)
        self.write_data(bytearray([0x01, 0x2C, 0x2D]))
        self.write_cmd(FRMCTR3)
        self.write_data(bytearray([0x01, 0x2C, 0x2D, 0x01, 0x2C, 0x2D]))

        self.write_cmd(INVCTR)
        self.write_data(0x07)

        # Power sequence
        self.write_cmd(PWCTR1)
        self.write_data(bytearray([0xA2, 0x02, 0x84]))
        self.write_cmd(PWCTR2)
        self.write_data(0xC5)
        self.write_cmd(PWCTR3)
        self.write_data(bytearray([0x0A, 0x00]))
        self.write_cmd(PWCTR4)
        self.write_data(bytearray([0x8A, 0x2A]))
        self.write_cmd(PWCTR5)
        self.write_data(bytearray([0x8A, 0xEE]))

        # VCOM
        self.write_cmd(VMCTR1)
        self.write_data(0x0E)

        self.write_cmd(INVOFF)

        # 16-bit / pixel (RGB565)
        self.write_cmd(COLMOD)
        self.write_data(0x05)

        # Gamma sequence
        self.write_cmd(GMCTRP1)
        self.write_data(bytearray([0x02, 0x1C, 0x07, 0x12, 0x37, 0x32, 0x29, 0x2D,
                                  0x29, 0x25, 0x2B, 0x39, 0x00, 0x01, 0x03, 0x10]))
        self.write_cmd(GMCTRN1)
        self.write_data(bytearray([0x03, 0x1D, 0x07, 0x06, 0x2E, 0x2C, 0x29, 0x2D,
                                  0x2E, 0x2E, 0x37, 0x3F, 0x00, 0x00, 0x02, 0x10]))

        self.write_cmd(NORON)
        time.sleep_ms(10)
        self.write_cmd(DISPON)
        time.sleep_ms(100)

    def set_rotation(self, rot):
        self.rotation = rot % 4
        self.write_cmd(MADCTL)
        if self.rotation == 0:    # Portrait
            self.write_data(0xC8) # BGR order
            self.col_offset = 0
            self.row_offset = 0
        elif self.rotation == 1:  # Landscape
            self.write_data(0xA8)
            self.col_offset = 0
            self.row_offset = 0
        elif self.rotation == 2:  # Inverted Portrait
            self.write_data(0x08)
            self.col_offset = 0
            self.row_offset = 0
        elif self.rotation == 3:  # Inverted Landscape
            self.write_data(0x68)
            self.col_offset = 0
            self.row_offset = 0

    def set_window(self, x0, y0, x1, y1):
        x0 += self.col_offset
        x1 += self.col_offset
        y0 += self.row_offset
        y1 += self.row_offset

        self.write_cmd(CASET)
        self.write_data(bytearray([x0 >> 8, x0 & 0xFF, x1 >> 8, x1 & 0xFF]))
        self.write_cmd(RASET)
        self.write_data(bytearray([y0 >> 8, y0 & 0xFF, y1 >> 8, y1 & 0xFF]))
        self.write_cmd(RAMWR)

    def show(self):
        """Push internal framebuffer to display over SPI DMA/block transfer"""
        self.set_window(0, 0, self.width - 1, self.height - 1)
        self.dc.value(1)
        self.cs.value(0)
        # Transmit framebuffer in 4KB chunks for optimal memory transfer
        chunk_size = 4096
        for i in range(0, len(self.buffer), chunk_size):
            self.spi.write(self.buffer[i:i + chunk_size])
        self.cs.value(1)

    # Drawing helpers mapping to FrameBuffer
    def fill(self, color):
        # Swap bytes for endianness in RGB565
        c = ((color & 0xFF) << 8) | ((color >> 8) & 0xFF)
        self.fb.fill(c)

    def pixel(self, x, y, color):
        c = ((color & 0xFF) << 8) | ((color >> 8) & 0xFF)
        self.fb.pixel(x, y, c)

    def line(self, x1, y1, x2, y2, color):
        c = ((color & 0xFF) << 8) | ((color >> 8) & 0xFF)
        self.fb.line(x1, y1, x2, y2, c)

    def rect(self, x, y, w, h, color):
        c = ((color & 0xFF) << 8) | ((color >> 8) & 0xFF)
        self.fb.rect(x, y, w, h, c)

    def fill_rect(self, x, y, w, h, color):
        c = ((color & 0xFF) << 8) | ((color >> 8) & 0xFF)
        self.fb.fill_rect(x, y, w, h, c)

    def text(self, string, x, y, color):
        c = ((color & 0xFF) << 8) | ((color >> 8) & 0xFF)
        self.fb.text(string, x, y, c)
