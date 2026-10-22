import React, { useState } from 'react';
import { Cpu, Radio, Tv, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Info, ArrowLeftRight } from 'lucide-react';

interface WireConnection {
  pinNumber: number;
  tftPin: string;
  espPin: string;
  targetDevice: 'ST7735R TFT' | 'GT-U7 GPS';
  wireColor: string;
  hexColor: string;
  functionName: string;
  description: string;
  busType: 'SPI' | 'UART' | 'POWER' | 'GPIO';
}

const TFT_CONNECTIONS: WireConnection[] = [
  {
    pinNumber: 1,
    tftPin: 'GND',
    espPin: 'GND',
    targetDevice: 'ST7735R TFT',
    wireColor: 'Black',
    hexColor: '#64748b',
    functionName: 'Power Ground',
    description: 'Connect to common ESP32-C3 GND',
    busType: 'POWER',
  },
  {
    pinNumber: 2,
    tftPin: 'BL',
    espPin: '3V3 or 5V (or GPIO3)',
    targetDevice: 'ST7735R TFT',
    wireColor: 'Purple',
    hexColor: '#a855f7',
    functionName: 'Backlight LED',
    description: 'Connect directly to 3V3 or 5V to illuminate the backlight LEDs (or GPIO3 for software PWM)',
    busType: 'POWER',
  },
  {
    pinNumber: 3,
    tftPin: 'VCC',
    espPin: '5V (or 3V3)',
    targetDevice: 'ST7735R TFT',
    wireColor: 'Red',
    hexColor: '#ef4444',
    functionName: 'Module Power',
    description: 'Connect to 5V! The red module has an onboard 3.3V LDO regulator; 5V ensures full backlight brightness',
    busType: 'POWER',
  },
  {
    pinNumber: 4,
    tftPin: 'CLK',
    espPin: 'GPIO4',
    targetDevice: 'ST7735R TFT',
    wireColor: 'Orange',
    hexColor: '#f97316',
    functionName: 'SPI Clock (SCK)',
    description: 'Hardware SPI Clock running at 20 MHz',
    busType: 'SPI',
  },
  {
    pinNumber: 5,
    tftPin: 'DIN',
    espPin: 'GPIO6',
    targetDevice: 'ST7735R TFT',
    wireColor: 'Green',
    hexColor: '#22c55e',
    functionName: 'SPI Data In (MOSI)',
    description: 'Master Out Slave In - writes pixels to ST7735 controller',
    busType: 'SPI',
  },
  {
    pinNumber: 6,
    tftPin: 'D/C',
    espPin: 'GPIO2',
    targetDevice: 'ST7735R TFT',
    wireColor: 'Blue',
    hexColor: '#3b82f6',
    functionName: 'Data / Command (A0)',
    description: 'Selects whether incoming byte is data (1) or command (0)',
    busType: 'SPI',
  },
  {
    pinNumber: 7,
    tftPin: 'CS',
    espPin: 'GPIO7',
    targetDevice: 'ST7735R TFT',
    wireColor: 'Yellow',
    hexColor: '#eab308',
    functionName: 'Chip Select',
    description: 'Active LOW SPI select pin to enable display communication',
    busType: 'SPI',
  },
  {
    pinNumber: 8,
    tftPin: 'RST',
    espPin: 'GPIO1',
    targetDevice: 'ST7735R TFT',
    wireColor: 'White',
    hexColor: '#e2e8f0',
    functionName: 'Hardware Reset',
    description: 'Pulsed LOW during initialization to reset display hardware',
    busType: 'GPIO',
  },
];

interface GpsConnection {
  pinNumber: number;
  gpsPin: string;
  espPin: string;
  wireColor: string;
  hexColor: string;
  busType: 'POWER' | 'UART' | 'GPIO';
  crossoverNote: string;
  description: string;
}

const GPS_CONNECTIONS: GpsConnection[] = [
  {
    pinNumber: 1,
    gpsPin: 'VCC',
    espPin: '3V3 or 5V',
    wireColor: 'Red',
    hexColor: '#ef4444',
    busType: 'POWER',
    crossoverNote: 'Direct Power',
    description: 'Power input. Connect to ESP32-C3 3V3 pin or 5V (module has internal 3.3V LDO).',
  },
  {
    pinNumber: 2,
    gpsPin: 'GND',
    espPin: 'GND',
    wireColor: 'Black',
    hexColor: '#64748b',
    busType: 'POWER',
    crossoverNote: 'Direct Ground',
    description: 'Common System Ground. Connect to ESP32-C3 GND.',
  },
  {
    pinNumber: 3,
    gpsPin: 'RXD',
    espPin: 'GPIO21 (TX1)',
    wireColor: 'Cyan',
    hexColor: '#06b6d4',
    busType: 'UART',
    crossoverNote: 'GPS RX ← ESP32 TX',
    description: 'Receiver Input on GT-U7. Connect to ESP32-C3 TX1 (GPIO21) so ESP32 can send commands.',
  },
  {
    pinNumber: 4,
    gpsPin: 'TXD',
    espPin: 'GPIO20 (RX1)',
    wireColor: 'Emerald',
    hexColor: '#10b981',
    busType: 'UART',
    crossoverNote: 'GPS TX → ESP32 RX',
    description: 'Transmitter Output on GT-U7. Connect to ESP32-C3 RX1 (GPIO20) so ESP32 receives NMEA stream.',
  },
  {
    pinNumber: 5,
    gpsPin: 'PPS',
    espPin: 'GPIO10',
    wireColor: 'Amber',
    hexColor: '#f59e0b',
    busType: 'GPIO',
    crossoverNote: 'Direct Pulse',
    description: 'Pulse-Per-Second output. Flashes at 1Hz when fix is locked; triggers time sync interrupt.',
  },
];

export const HardwareWiring: React.FC = () => {
  const [filterBus, setFilterBus] = useState<string>('ALL');
  const [hoveredTftPin, setHoveredTftPin] = useState<string | null>(null);
  const [hoveredGpsPin, setHoveredGpsPin] = useState<string | null>(null);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-zinc-800 gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            Hardware Architecture & Wiring Interconnect
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Calibrated to your exact pin sequences: TFT (<span className="font-mono text-cyan-300">GND, BL, VCC, CLK, DIN, D/C, CS, RST</span>) &amp; GT-U7 (<span className="font-mono text-emerald-300">VCC, GND, RXD, TXD, PPS</span>)
          </p>
        </div>

        {/* Bus Filter Chips */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {['ALL', 'SPI', 'UART', 'POWER', 'GPIO'].map((bus) => (
            <button
              key={bus}
              onClick={() => setFilterBus(bus)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                filterBus === bus
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {bus}
            </button>
          ))}
        </div>
      </div>

      {/* UART Crossover Alert Box */}
      <div className="mt-4 p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl shadow-lg">
        <div className="flex items-start gap-2.5">
          <ArrowLeftRight className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-300 leading-relaxed">
            <span className="font-bold text-emerald-300 block mb-1 text-sm flex items-center gap-1.5">
              <span>GT-U7 GPS Pin Sequence &amp; UART Crossover Rule:</span>
            </span>
            Looking on the back side of your GT-U7 module with the micro-USB facing away, the pins from right to left are:
            <span className="font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded border border-zinc-700 ml-1">
              [ 1: VCC | 2: GND | 3: RXD | 4: TXD | 5: PPS ]
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5 font-mono text-[11px]">
              <div className="bg-black/60 p-2.5 rounded-lg border border-cyan-500/30">
                <span className="text-zinc-400 block text-[10px]">GPS Pin 3 (RXD - next to GND):</span>
                <span className="text-cyan-300 font-bold">GT-U7 RXD</span> &rarr; <span className="text-amber-300 font-bold">ESP32-C3 GPIO21 (TX1)</span>
                <p className="text-[10px] text-zinc-400 mt-0.5">ESP32 transmits commands/config into GPS receiver.</p>
              </div>

              <div className="bg-black/60 p-2.5 rounded-lg border border-emerald-500/30">
                <span className="text-zinc-400 block text-[10px]">GPS Pin 4 (TXD - next to PPS):</span>
                <span className="text-emerald-300 font-bold">GT-U7 TXD</span> &rarr; <span className="text-amber-300 font-bold">ESP32-C3 GPIO20 (RX1)</span>
                <p className="text-[10px] text-zinc-400 mt-0.5">GPS transmits NMEA serial data into ESP32 receiver.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GT-U7 Physical 5-Pin Header Visual */}
      <div className="my-5 p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl">
        <div className="text-xs font-mono text-zinc-400 mb-2 flex items-center justify-between">
          <span className="font-bold text-zinc-200">
            GT-U7 GPS Physical 5-Pin Header (Back view, USB facing away)
          </span>
          <span className="text-emerald-400">Sequence: VCC, GND, RXD, TXD, PPS</span>
        </div>

        <div className="grid grid-cols-5 gap-2 p-2.5 bg-black rounded-lg border border-zinc-800">
          {GPS_CONNECTIONS.map((conn) => {
            const isHovered = hoveredGpsPin === conn.gpsPin;
            return (
              <div
                key={conn.gpsPin}
                onMouseEnter={() => setHoveredGpsPin(conn.gpsPin)}
                onMouseLeave={() => setHoveredGpsPin(null)}
                className={`flex flex-col items-center justify-center p-2.5 rounded transition-all cursor-pointer border ${
                  isHovered
                    ? 'bg-emerald-500/20 border-emerald-400 text-white scale-105 shadow-lg'
                    : 'bg-zinc-900 border-zinc-700/80 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <span className="text-[10px] text-zinc-500 font-mono">Pin #{conn.pinNumber}</span>
                <span className="text-sm font-mono font-bold text-emerald-300">{conn.gpsPin}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1.5 shadow-sm"
                  style={{ backgroundColor: conn.hexColor }}
                />
                <span className="text-[10px] font-mono text-amber-300 mt-1 truncate max-w-full font-semibold">
                  {conn.espPin}
                </span>
                <span className="text-[8px] font-mono text-zinc-400 mt-0.5">
                  {conn.crossoverNote}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* GT-U7 GPS Connections Table */}
      <div className="mb-6">
        <h3 className="text-xs font-mono font-bold uppercase text-zinc-400 mb-2 flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-emerald-400" />
          GT-U7 GPS Module (5 Pins) &rarr; ESP32-C3 SuperMini Hookup Table
        </h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-3">Pin #</th>
                <th className="py-2.5 px-3">GT-U7 Silkscreen</th>
                <th className="py-2.5 px-3">ESP32-C3 Pin</th>
                <th className="py-2.5 px-3">Wire Color</th>
                <th className="py-2.5 px-3">Signal Flow</th>
                <th className="py-2.5 px-3">Bus Type</th>
                <th className="py-2.5 px-3">Functional Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {GPS_CONNECTIONS.filter((c) => filterBus === 'ALL' || c.busType === filterBus).map(
                (conn) => {
                  const isHovered = hoveredGpsPin === conn.gpsPin;
                  return (
                    <tr
                      key={conn.gpsPin}
                      onMouseEnter={() => setHoveredGpsPin(conn.gpsPin)}
                      onMouseLeave={() => setHoveredGpsPin(null)}
                      className={`transition-colors ${
                        isHovered ? 'bg-emerald-500/10' : 'hover:bg-zinc-900/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-zinc-500 font-bold">{conn.pinNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-300 text-sm">
                        {conn.gpsPin}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-cyan-300">{conn.espPin}</td>
                      <td className="py-2.5 px-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-zinc-700 shadow-sm"
                            style={{ backgroundColor: conn.hexColor }}
                          />
                          <span className="text-zinc-300">{conn.wireColor}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-amber-300 font-semibold">{conn.crossoverNote}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            conn.busType === 'UART'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : conn.busType === 'POWER'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {conn.busType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 text-[11px]">{conn.description}</td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ST7735R Physical 8-Pin Header Visual */}
      <div className="my-5 p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl">
        <div className="text-xs font-mono text-zinc-400 mb-2 flex items-center justify-between">
          <span className="font-bold text-zinc-200">
            ST7735R 1.8" Physical 8-Pin Header (Left-to-Right Silkscreen)
          </span>
          <span className="text-cyan-400">Sequence: GND, BL, VCC, CLK, DIN, D/C, CS, RST</span>
        </div>

        <div className="grid grid-cols-8 gap-1.5 p-2 bg-black rounded-lg border border-zinc-800">
          {TFT_CONNECTIONS.map((conn) => {
            const isHovered = hoveredTftPin === conn.tftPin;
            return (
              <div
                key={conn.tftPin}
                onMouseEnter={() => setHoveredTftPin(conn.tftPin)}
                onMouseLeave={() => setHoveredTftPin(null)}
                className={`flex flex-col items-center justify-center p-2 rounded transition-all cursor-pointer border ${
                  isHovered
                    ? 'bg-amber-500/20 border-amber-400 text-white scale-105 shadow-lg'
                    : 'bg-zinc-900 border-zinc-700/80 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <span className="text-[10px] text-zinc-500 font-mono">#{conn.pinNumber}</span>
                <span className="text-xs font-mono font-bold text-amber-300">{conn.tftPin}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1.5 shadow-sm"
                  style={{ backgroundColor: conn.hexColor }}
                />
                <span className="text-[9px] font-mono text-cyan-300 mt-1 truncate max-w-full">
                  {conn.espPin}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Pin Connection Table for TFT */}
      <div>
        <h3 className="text-xs font-mono font-bold uppercase text-zinc-400 mb-2 flex items-center gap-1.5">
          <Tv className="w-4 h-4 text-cyan-400" />
          1.8" TFT ST7735R (8 Pins) &rarr; ESP32-C3 SuperMini Hookup Table
        </h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-3">Pin #</th>
                <th className="py-2.5 px-3">TFT Label</th>
                <th className="py-2.5 px-3">ESP32-C3 Pin</th>
                <th className="py-2.5 px-3">Wire Color</th>
                <th className="py-2.5 px-3">Function</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Wiring Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {TFT_CONNECTIONS.filter((c) => filterBus === 'ALL' || c.busType === filterBus).map(
                (conn) => {
                  const isHovered = hoveredTftPin === conn.tftPin;
                  return (
                    <tr
                      key={conn.tftPin}
                      onMouseEnter={() => setHoveredTftPin(conn.tftPin)}
                      onMouseLeave={() => setHoveredTftPin(null)}
                      className={`transition-colors ${
                        isHovered ? 'bg-amber-500/10' : 'hover:bg-zinc-900/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-zinc-500 font-bold">{conn.pinNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-amber-300 text-sm">
                        {conn.tftPin}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-cyan-300">{conn.espPin}</td>
                      <td className="py-2.5 px-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-zinc-700 shadow-sm"
                            style={{ backgroundColor: conn.hexColor }}
                          />
                          <span className="text-zinc-300">{conn.wireColor}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-200">{conn.functionName}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                            conn.busType === 'SPI'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : conn.busType === 'POWER'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {conn.busType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 text-[11px]">{conn.description}</td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical Hardware Engineering Guidelines */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-3.5 bg-amber-950/20 border border-amber-800/40 rounded-lg text-amber-200/90 leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-amber-300 mb-0.5">GPS Peak Current Spike</span>
            The GT-U7 module requires up to 67mA during initial cold start satellite acquisition. Ensure a 100µF capacitor is installed across VCC and GND near the GPS module to prevent brownout reboots of the ESP32-C3!
          </div>
        </div>

        <div className="p-3.5 bg-cyan-950/20 border border-cyan-800/40 rounded-lg text-cyan-200/90 leading-relaxed flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-cyan-300 mb-0.5">High Speed SPI Clock (CLK)</span>
            The MicroPython SPI clock is configured for 20 MHz (`PIN_TFT_CLK = 4`). Wire `CLK` and `DIN` with short, direct jumper wires (&lt;10 cm) to minimize signal ringing and ensure crisp 10-15 FPS display updates.
          </div>
        </div>
      </div>
    </div>
  );
};
