/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Navigation,
  FolderTree,
  Cpu,
  Terminal,
  Download,
  Compass,
  Radio,
  Tv,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DeviceSimulator } from './components/DeviceSimulator';
import { ProjectBrowser } from './components/ProjectBrowser';
import { HardwareWiring } from './components/HardwareWiring';
import { FlashingGuide } from './components/FlashingGuide';
import { PROJECT_ROOT } from './projectFiles';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'wiring' | 'flashing'>('simulator');

  return (
    <div className="min-h-screen bg-[#090d16] text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Application Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-cyan-400 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Navigation className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white">
                  ESP32-C3 MicroPython GPS Navigator
                </h1>
                <span className="hidden sm:inline-block text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono">
                  v1.2.7
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                GT-U7 GPS &bull; ESP32-C3 SuperMini &bull; 1.8" TFT ST7735R SPI
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs font-medium">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-amber-500 text-black font-semibold shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>1.8" TFT Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'code'
                  ? 'bg-amber-500 text-black font-semibold shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              <span>Project Files (5 Folders)</span>
            </button>

            <button
              onClick={() => setActiveTab('wiring')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'wiring'
                  ? 'bg-amber-500 text-black font-semibold shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Wiring & Pinout</span>
            </button>

            <button
              onClick={() => setActiveTab('flashing')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'flashing'
                  ? 'bg-amber-500 text-black font-semibold shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Flashing Guide</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'simulator' && <DeviceSimulator />}
        {activeTab === 'code' && <ProjectBrowser />}
        {activeTab === 'wiring' && <HardwareWiring />}
        {activeTab === 'flashing' && <FlashingGuide />}
      </main>

      {/* Project Status Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Target Local Directory:</span>
            <code className="text-zinc-400 font-mono text-[11px] bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {PROJECT_ROOT}
            </code>
          </div>
          <div className="flex items-center gap-4 text-zinc-400 text-[11px]">
            <span>1.- Codes</span>
            <span>2.- Docs</span>
            <span>3.- HMI</span>
            <span>4.- md</span>
            <span>5.- History</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
