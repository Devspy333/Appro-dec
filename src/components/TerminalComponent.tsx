import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { FileNode, ThemeName, themes } from '../types';

interface TerminalProps {
  onCommand: (cmd: string, args: string[]) => Promise<void>;
  theme: ThemeName;
  onTerminalReady: (term: XTerm) => void;
}

export const TerminalComponent: React.FC<TerminalProps> = ({ onCommand, theme, onTerminalReady }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputBufferRef = useRef('');
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: themes[theme],
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    onTerminalReady(term);

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    const disposable = term.onData((data) => {
      const code = data.charCodeAt(0);
      if (code === 13) { // Enter
        term.write('\r\n');
        const cmdString = inputBufferRef.current.trim();
        inputBufferRef.current = '';
        
        const parts = cmdString.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const cmd = parts[0] || '';
        const args = parts.slice(1).map(p => p.replace(/^"(.*)"$/, '$1'));
        
        onCommandRef.current(cmd, args);
      } else if (code === 127) { // Backspace
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          term.write('\b \b');
        }
      } else if (code >= 32 && code <= 126) { // Printable chars
        inputBufferRef.current += data;
        term.write(data);
      }
    });

    return () => {
      disposable.dispose();
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []); // Empty dependency array for initialization

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = themes[theme];
    }
  }, [theme]);

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const event = new CustomEvent('terminal-drop', { detail: file });
      window.dispatchEvent(event);
    }
  };

  return (
    <div 
      className={`w-full h-full p-4 overflow-hidden transition-colors duration-200 ${isDragging ? 'bg-white/10 ring-2 ring-inset ring-purple-500' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
};
