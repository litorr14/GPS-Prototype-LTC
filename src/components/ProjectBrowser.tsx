import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  Folder,
  FileCode,
  FileText,
  Download,
  Copy,
  Check,
  Package,
  Layers,
  ChevronRight,
  ExternalLink,
  Terminal,
} from 'lucide-react';
import { PROJECT_FILES, PROJECT_ROOT, ProjectFile } from '../projectFiles';

export const ProjectBrowser: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<string>('Codes');
  const [selectedFile, setSelectedFile] = useState<ProjectFile>(PROJECT_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const folders = ['Codes', 'Docs', 'HMI', 'md', 'History'] as const;

  const currentFolderFiles = PROJECT_FILES.filter((f) => f.folder === selectedFolder);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = selectedFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();

      // Create folder structure inside zip
      folders.forEach((folder) => {
        const folderZip = zip.folder(folder);
        const filesInFolder = PROJECT_FILES.filter((f) => f.folder === folder);
        filesInFolder.forEach((file) => {
          folderZip?.file(file.name, file.content);
        });
      });

      // Add a root README.txt for immediate reference
      zip.file(
        'README.txt',
        `ESP32-C3 SuperMini + GT-U7 GPS + ST7735R 1.8" TFT Navigation Suite\r\n` +
          `Target Directory: ${PROJECT_ROOT}\r\n\r\n` +
          `Folders included:\r\n` +
          `1.- Codes/    -> MicroPython firmware (main.py, config.py, st7735.py, etc.)\r\n` +
          `2.- Docs/     -> Pinout schematics, wiring, BOM, battery guide, troubleshooting\r\n` +
          `3.- HMI/      -> Screen wireframes, RGB565 palette, 8x8 bitmap icons\r\n` +
          `4.- md/       -> Technical architecture, flashing instructions, geodesic math\r\n` +
          `5.- History/  -> Changelog and field test benchmarks\r\n\r\n` +
          `Quick Upload with mpremote:\r\n` +
          `  mpremote connect COM3 cp Codes/* :\r\n`
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'GPS_ESP32_MicroPython_Suite.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Top Banner: Directory Target Info & Export Button */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="text-zinc-400 block font-sans">Target Local Directory:</span>
            <code className="text-amber-300 font-mono text-[11px] select-all bg-black/40 px-2 py-0.5 rounded border border-amber-500/20">
              {PROJECT_ROOT}
            </code>
          </div>
        </div>

        <button
          onClick={handleExportZip}
          disabled={isExporting}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs shadow-lg shadow-emerald-950/40 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Package className="w-4 h-4" />
          {isExporting ? 'Packaging ZIP...' : 'Download Complete Project (.ZIP)'}
        </button>
      </div>

      {/* Main Split View: Folder/File List on Left, Code Viewer on Right */}
      <div className="flex-1 flex flex-col md:flex-row min-h-[520px]">
        {/* Left Column: Folder Navigation & File Tree */}
        <div className="w-full md:w-64 bg-zinc-900/50 border-r border-zinc-800 flex flex-col shrink-0">
          {/* 5 Folders Selector Tabs */}
          <div className="p-2 border-b border-zinc-800 grid grid-cols-5 gap-1 text-[11px] font-mono">
            {folders.map((folder, idx) => (
              <button
                key={folder}
                onClick={() => {
                  setSelectedFolder(folder);
                  const first = PROJECT_FILES.find((f) => f.folder === folder);
                  if (first) setSelectedFile(first);
                }}
                className={`py-1.5 px-1 rounded flex flex-col items-center transition-colors ${
                  selectedFolder === folder
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                }`}
              >
                <span className="text-[10px] text-zinc-500">{idx + 1}.</span>
                <span>{folder}</span>
              </button>
            ))}
          </div>

          {/* Files List in Active Folder */}
          <div className="p-2 flex-1 overflow-y-auto space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono uppercase text-zinc-500 tracking-wider flex items-center justify-between">
              <span>{selectedFolder}/</span>
              <span className="text-zinc-600">{currentFolderFiles.length} files</span>
            </div>

            {currentFolderFiles.map((file) => {
              const isSelected = selectedFile.path === file.path;
              const isPy = file.name.endsWith('.py');
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/40 font-medium shadow-sm'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                  }`}
                >
                  {isPy ? (
                    <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  )}
                  <span className="truncate font-mono">{file.name}</span>
                </button>
              );
            })}
          </div>

          {/* Folder Summary Note */}
          <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5 text-zinc-300 font-semibold mb-1">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Folder Purpose:</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              {selectedFolder === 'Codes' && 'All MicroPython scripts to upload directly to ESP32-C3 flash root.'}
              {selectedFolder === 'Docs' && 'Hardware schematics, pinout mapping, BOM, and power budget.'}
              {selectedFolder === 'HMI' && 'Screen layout specs, 16-bit RGB565 colors, and monochrome icon arrays.'}
              {selectedFolder === 'md' && 'Architecture details, flashing commands, and geodesic math formulas.'}
              {selectedFolder === 'History' && 'Version history, changes, and physical vehicle/hiking field test logs.'}
            </p>
          </div>
        </div>

        {/* Right Column: Code / Markdown Viewer */}
        <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
          {/* File Header Bar */}
          <div className="bg-zinc-900/60 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <ChevronRight className="w-4 h-4 text-zinc-500" />
              <span className="font-mono text-xs text-amber-400 font-medium truncate">
                {selectedFile.path}
              </span>
              <span className="hidden sm:inline-block text-[11px] text-zinc-400 truncate max-w-xs">
                — {selectedFile.description}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors cursor-pointer"
                title="Copy code to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                onClick={handleDownloadFile}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors cursor-pointer"
                title="Download this file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save</span>
              </button>
            </div>
          </div>

          {/* Code Body with Line Numbers */}
          <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed bg-[#0d1117] text-zinc-200">
            <pre className="table w-full">
              {selectedFile.content.split('\n').map((line, idx) => (
                <div key={idx} className="table-row hover:bg-white/[0.03]">
                  <span className="table-cell select-none pr-4 text-right text-zinc-600 text-[11px] w-8">
                    {idx + 1}
                  </span>
                  <span className="table-cell whitespace-pre font-mono text-zinc-200">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
