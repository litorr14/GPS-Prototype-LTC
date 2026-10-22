import React, { useState } from 'react';
import { Terminal, Copy, Check, Download, ExternalLink, HelpCircle, AlertCircle } from 'lucide-react';
import { PROJECT_ROOT } from '../projectFiles';

export const FlashingGuide: React.FC = () => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const steps = [
    {
      title: 'Step 1: Install Python & esptool.py',
      desc: 'Ensure you have Python 3.8+ installed on your PC, then install esptool via pip:',
      cmd: 'pip install esptool mpremote',
    },
    {
      title: 'Step 2: Put ESP32-C3 SuperMini into Bootloader Mode',
      desc: 'Connect the USB-C cable to your PC. Hold down the physical BOOT button (GPIO9 on ESP32-C3 SuperMini), press the RESET button once, then release BOOT. Check Device Manager for your COM port (e.g. COM3 or COM4).',
      cmd: 'python -m esptool --chip esp32c3 --port COM3 chip_id',
    },
    {
      title: 'Step 3: Erase Existing Flash',
      desc: 'Wipe all previous firmware partitions before flashing clean MicroPython:',
      cmd: 'python -m esptool --chip esp32c3 --port COM3 erase_flash',
    },
    {
      title: 'Step 4: Flash MicroPython Binary',
      desc: 'Download the generic ESP32-C3 firmware from micropython.org and write to offset 0x0:',
      cmd: 'python -m esptool --chip esp32c3 --port COM3 --baud 460800 write_flash -z 0x0 ESP32_GENERIC_C3.bin',
    },
    {
      title: 'Step 5: Upload Project Codes/ to ESP32 Flash',
      desc: `From your project folder ${PROJECT_ROOT}, use mpremote to copy all MicroPython files directly into the root filesystem:`,
      cmd: 'mpremote connect COM3 cp Codes/* :',
    },
    {
      title: 'Step 6: Run & Verify in Interactive REPL',
      desc: 'Open the serial terminal at 115200 baud or launch Thonny IDE. The device will automatically run main.py on power-up!',
      cmd: 'mpremote connect COM3 repl',
    },
  ];

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-400" />
            MicroPython Flashing & Deployment Workflow
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Step-by-step instructions to get the GPS navigator running on physical ESP32-C3 hardware
          </p>
        </div>

        <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800">
          Target: ESP32_GENERIC_C3
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {steps.map((step, idx) => (
          <div key={idx} className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-amber-400">{step.title}</span>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between bg-black/80 rounded-md p-2.5 border border-zinc-800/90 font-mono text-xs">
              <span className="text-cyan-300 select-all overflow-x-auto">{step.cmd}</span>
              <button
                onClick={() => handleCopy(step.cmd, idx)}
                className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] shrink-0 transition-colors cursor-pointer"
              >
                {copiedIdx === idx ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-lg flex items-start gap-3 text-xs text-zinc-400">
        <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-zinc-200 block">Thonny IDE Instructions:</span>
          In Thonny, set the interpreter at the bottom right to{' '}
          <strong className="text-cyan-400">MicroPython (ESP32)</strong>. Open{' '}
          <code className="text-amber-300 font-mono">Codes/main.py</code> or{' '}
          <code className="text-emerald-300 font-mono">Codes/test_display.py</code> and press the green{' '}
          <strong className="text-white">Run</strong> button (F5).
        </div>
      </div>

      {/* Troubleshooting Common Errors */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 bg-red-950/20 border border-red-500/30 rounded-lg text-zinc-300">
          <span className="font-bold text-red-400 block mb-1">
            Fix: SyntaxError: invalid syntax on &lt;stdin&gt;
          </span>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            In the MicroPython shell prompt (<code className="text-cyan-300">&gt;&gt;&gt;</code>), typing{' '}
            <code className="text-amber-400">python main.py</code> or{' '}
            <code className="text-amber-400">import main.py</code> is invalid Python syntax!
            <br />
            <strong>Correct way:</strong> Type <code className="text-emerald-300 font-mono">import main</code>, or open <code className="text-emerald-300 font-mono">main.py</code> in Thonny and press <strong className="text-white">F5 (Run)</strong>.
          </p>
        </div>

        <div className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-lg text-zinc-300">
          <span className="font-bold text-amber-400 block mb-1">
            Fix: Display Backlight Not Illuminated
          </span>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            The ST7735R backlight is completely dark until Pin 2 (<strong>BL</strong>) receives 3.3V power!
            <br />
            <strong>Hardware Test:</strong> Connect TFT Pin 2 (<strong>BL</strong>) directly to ESP32-C3 <strong className="text-cyan-300 font-mono">3V3</strong>. The screen will illuminate immediately without needing any code!
            <br />
            <strong>Software Test:</strong> Run <code className="text-emerald-300 font-mono">Codes/test_display.py</code> in Thonny to test screen colors.
          </p>
        </div>
      </div>
    </div>
  );
};
