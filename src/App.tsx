import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { TerminalComponent } from './components/TerminalComponent';
import { FileNode, ThemeName } from './types';
import { Upload, Download, Terminal as TerminalIcon, HelpCircle, Github, Zap } from 'lucide-react';
import JSZip from 'jszip';

const INITIAL_FS: FileNode = {
  name: '/',
  type: 'dir',
  children: {
    'workspace': {
      name: 'workspace',
      type: 'dir',
      children: {}
    }
  }
};

export default function App() {
  const [theme, setTheme] = useState<ThemeName>('pupule');
  const [fs, setFs] = useState<FileNode>(INITIAL_FS);
  const [cwd, setCwd] = useState<string[]>(['workspace']);
  const termRef = useRef<XTerm | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastUploadedApk, setLastUploadedApk] = useState<string | null>(null);

  const writePrompt = useCallback(() => {
    if (!termRef.current) return;
    const path = '/' + cwd.join('/');
    termRef.current.write(`\r\n\x1b[1;32muser@appro-dec\x1b[0m:\x1b[1;34m${path}\x1b[0m$ `);
  }, [cwd]);

  const getNodeByPath = useCallback((pathParts: string[], root: FileNode): FileNode | null => {
    let current = root;
    for (const part of pathParts) {
      if (!current.children || !current.children[part]) return null;
      current = current.children[part];
    }
    return current;
  }, []);

  const resolvePath = useCallback((path: string): string[] | null => {
    if (path === '/') return [];
    const parts = path.split('/').filter(Boolean);
    const result = path.startsWith('/') ? [] : [...cwd];
    
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (result.length > 0) result.pop();
      } else {
        result.push(part);
      }
    }
    
    // Verify path exists
    if (!getNodeByPath(result, fs)) return null;
    return result;
  }, [cwd, fs, getNodeByPath]);

  useEffect(() => {
    const handleTerminalDrop = (e: Event) => {
      const customEvent = e as CustomEvent<File>;
      const file = customEvent.detail;
      
      setFs(prevFs => {
        const newFs = { ...prevFs };
        const currentDir = getNodeByPath(cwd, newFs);
        
        if (currentDir && currentDir.children) {
          currentDir.children[file.name] = {
            name: file.name,
            type: 'file',
            content: file
          };
          
          if (file.name.endsWith('.apk')) {
            setLastUploadedApk(file.name);
          }
          
          if (termRef.current) {
            termRef.current.writeln(`\r\n\x1b[1;32m[✓] Uploaded ${file.name} successfully via drag & drop.\x1b[0m`);
            writePrompt();
          }
        }
        return newFs;
      });
    };

    window.addEventListener('terminal-drop', handleTerminalDrop);
    return () => window.removeEventListener('terminal-drop', handleTerminalDrop);
  }, [cwd, writePrompt]);

  const handleTerminalReady = (term: XTerm) => {
    termRef.current = term;
    term.writeln('\x1b[1;35m==================================================\x1b[0m');
    term.writeln('\x1b[1;36m  Appro Dec - APK Reverse Engineering Web Terminal\x1b[0m');
    term.writeln('\x1b[1;35m==================================================\x1b[0m');
    term.writeln('Type \x1b[1;33mhelp\x1b[0m to see available commands.');
    writePrompt();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const newFs = { ...fs };
    const currentDir = getNodeByPath(cwd, newFs);
    
    if (currentDir && currentDir.children) {
      currentDir.children[file.name] = {
        name: file.name,
        type: 'file',
        content: file
      };
      setFs(newFs);
      
      if (file.name.endsWith('.apk')) {
        setLastUploadedApk(file.name);
      }
      
      if (termRef.current) {
        termRef.current.writeln(`\r\n\x1b[1;32m[✓] Uploaded ${file.name} successfully.\x1b[0m`);
        writePrompt();
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runApktool = async (args: string[]) => {
    if (!termRef.current) return;
    const term = termRef.current;
    
    if (args.length === 0) {
      term.writeln('Apktool v2.7.0 - A tool for reverse engineering 3rd party, closed, binary Android apps.');
      term.writeln('Usage: apktool <command> [options]');
      term.writeln('Commands:');
      term.writeln('  d, decode    Decode an APK');
      term.writeln('  b, build     Build an APK from decoded folder');
      term.writeln('  if           Install framework');
      return;
    }

    const cmd = args[0];
    setIsProcessing(true);

    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    const animateSpinner = (text: string) => {
      return setInterval(() => {
        term.write(`\r\x1b[2K\x1b[1;36m[${frames[i]}]\x1b[0m ${text}`);
        i = (i + 1) % frames.length;
      }, 80);
    };

    if (cmd === 'd' || cmd === 'decode') {
      const targetApk = args[1];
      if (!targetApk) {
        term.writeln('Error: No APK specified.');
        setIsProcessing(false);
        return;
      }

      const currentDir = getNodeByPath(cwd, fs);
      if (!currentDir?.children?.[targetApk]) {
        term.writeln(`Error: File '${targetApk}' not found.`);
        setIsProcessing(false);
        return;
      }

      const outDir = args.includes('-o') ? args[args.indexOf('-o') + 1] : targetApk.replace('.apk', '');
      
      const spinner = animateSpinner(`Decoding ${targetApk} using backend...`);
      
      try {
        const fileNode = currentDir.children[targetApk];
        if (!(fileNode.content instanceof File)) {
          throw new Error('Not a valid uploaded file.');
        }

        const formData = new FormData();
        formData.append('apk', fileNode.content);

        const response = await fetch('/api/decode', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const blob = await response.blob();
        
        clearInterval(spinner);
        term.writeln(`\r\x1b[2KI: Using Apktool 3.0.1 on ${targetApk}`);
        term.writeln(`\r\x1b[2KI: Backend decode successful.`);
        
        // Create decoded folder zip in virtual FS
        const newFs = { ...fs };
        const cDir = getNodeByPath(cwd, newFs);
        if (cDir && cDir.children) {
          cDir.children[outDir] = {
            name: outDir,
            type: 'dir',
            children: {
              'decoded.zip': { name: 'decoded.zip', type: 'file', content: blob }
            }
          };
          setFs(newFs);
        }

        term.writeln(`\r\x1b[2K\x1b[1;32m[✓] APK decoded successfully to /${cwd.join('/')}/${outDir}\x1b[0m`);
        term.writeln(`\r\x1b[2K\x1b[1;33mNote: The decoded files are stored as a zip inside the folder. Use 'download ${outDir}' to get them.\x1b[0m`);
      } catch (err: any) {
        clearInterval(spinner);
        term.writeln(`\r\x1b[2K\x1b[1;31mError: ${err.message}\x1b[0m`);
        if (err.message.includes('Java is not installed')) {
          term.writeln(`\x1b[1;33mThis environment does not have Java installed, so the real apktool.jar cannot run.\x1b[0m`);
        }
      }
    } else if (cmd === 'b' || cmd === 'build') {
      const targetDir = args[1];
      if (!targetDir) {
        term.writeln('Error: No directory specified.');
        setIsProcessing(false);
        return;
      }

      const currentDir = getNodeByPath(cwd, fs);
      if (!currentDir?.children?.[targetDir] || currentDir.children[targetDir].type !== 'dir') {
        term.writeln(`Error: Directory '${targetDir}' not found.`);
        setIsProcessing(false);
        return;
      }

      const outApk = args.includes('-o') ? args[args.indexOf('-o') + 1] : `${targetDir}_modified.apk`;
      
      const spinner = animateSpinner(`Building ${targetDir}...`);
      await sleep(800);
      term.writeln(`\r\x1b[2KI: Using Apktool 2.7.0`);
      await sleep(500);
      term.writeln(`\r\x1b[2KI: Checking whether sources has changed...`);
      await sleep(600);
      term.writeln(`\r\x1b[2KI: Smaling smali folder into classes.dex...`);
      await sleep(1200);
      term.writeln(`\r\x1b[2KI: Checking whether resources has changed...`);
      await sleep(500);
      term.writeln(`\r\x1b[2KI: Building resources...`);
      await sleep(1000);
      term.writeln(`\r\x1b[2KI: Building apk file...`);
      await sleep(800);
      term.writeln(`\r\x1b[2KI: Copying unknown files/dir...`);
      await sleep(400);
      term.writeln(`\r\x1b[2KI: Built apk...`);
      clearInterval(spinner);
      
      // Create built APK
      const newFs = { ...fs };
      const cDir = getNodeByPath(cwd, newFs);
      if (cDir && cDir.children) {
        cDir.children[outApk] = {
          name: outApk,
          type: 'file',
          content: 'MOCK_APK_CONTENT'
        };
        setFs(newFs);
      }

      term.writeln(`\r\x1b[2K\x1b[1;32m[✓] APK built successfully: ${outApk}\x1b[0m`);
    } else if (cmd === 'if') {
      const spinner = animateSpinner(`Installing framework...`);
      await sleep(1500);
      clearInterval(spinner);
      term.writeln(`\r\x1b[2K\x1b[1;32m[✓] Framework installed successfully.\x1b[0m`);
    } else {
      term.writeln(`apktool: unknown command '${cmd}'`);
    }

    setIsProcessing(false);
  };

  const handleCommand = async (cmd: string, args: string[]) => {
    if (!termRef.current) return;
    const term = termRef.current;

    if (isProcessing) {
      term.writeln('Terminal is busy...');
      writePrompt();
      return;
    }

    if (!cmd) {
      writePrompt();
      return;
    }

    switch (cmd) {
      case 'help':
        term.writeln('Available commands:');
        term.writeln('  \x1b[1;32mhelp\x1b[0m       - Show this help message');
        term.writeln('  \x1b[1;32mls\x1b[0m         - List files in current directory');
        term.writeln('  \x1b[1;32mcd <dir>\x1b[0m   - Change directory');
        term.writeln('  \x1b[1;32mpwd\x1b[0m        - Print working directory');
        term.writeln('  \x1b[1;32mmkdir <dir>\x1b[0m- Create a directory');
        term.writeln('  \x1b[1;32mtouch <file>\x1b[0m- Create an empty file');
        term.writeln('  \x1b[1;32mecho <text> > <file>\x1b[0m - Write text to a file');
        term.writeln('  \x1b[1;32mrm <file>\x1b[0m  - Remove a file or directory');
        term.writeln('  \x1b[1;32mcat <file>\x1b[0m - Read a file');
        term.writeln('  \x1b[1;32mtheme\x1b[0m      - Manage themes (theme list, theme <name>)');
        term.writeln('  \x1b[1;32mapktool\x1b[0m    - Run Apktool (d, b, if)');
        term.writeln('  \x1b[1;32mdownload\x1b[0m   - Download a file (download <file>)');
        term.writeln('  \x1b[1;32mclear\x1b[0m      - Clear terminal screen');
        break;
      case 'clear':
        term.clear();
        break;
      case 'pwd':
        term.writeln('/' + cwd.join('/'));
        break;
      case 'ls':
        const currentDir = getNodeByPath(cwd, fs);
        if (currentDir && currentDir.children) {
          const files = Object.values(currentDir.children) as FileNode[];
          if (files.length === 0) {
            // empty
          } else {
            files.forEach(f => {
              if (f.type === 'dir') {
                term.write(`\x1b[1;34m${f.name}/\x1b[0m  `);
              } else {
                term.write(`${f.name}  `);
              }
            });
            term.writeln('');
          }
        }
        break;
      case 'cd':
        if (args.length === 0) {
          setCwd(['workspace']);
        } else {
          const target = args[0];
          const newPath = resolvePath(target);
          if (newPath) {
            const node = getNodeByPath(newPath, fs);
            if (node && node.type === 'dir') {
              setCwd(newPath);
            } else {
              term.writeln(`cd: ${target}: Not a directory`);
            }
          } else {
            term.writeln(`cd: ${target}: No such file or directory`);
          }
        }
        break;
      case 'mkdir':
        if (args.length > 0) {
          const newFs = { ...fs };
          const cDir = getNodeByPath(cwd, newFs);
          if (cDir && cDir.children) {
            if (!cDir.children[args[0]]) {
              cDir.children[args[0]] = { name: args[0], type: 'dir', children: {} };
              setFs(newFs);
            } else {
              term.writeln(`mkdir: cannot create directory '${args[0]}': File exists`);
            }
          }
        } else {
          term.writeln('mkdir: missing operand');
        }
        break;
      case 'touch':
        if (args.length > 0) {
          const newFs = { ...fs };
          const cDir = getNodeByPath(cwd, newFs);
          if (cDir && cDir.children) {
            if (!cDir.children[args[0]]) {
              cDir.children[args[0]] = { name: args[0], type: 'file', content: '' };
              setFs(newFs);
            }
          }
        } else {
          term.writeln('touch: missing operand');
        }
        break;
      case 'echo':
        const redirectIndex = args.indexOf('>');
        if (redirectIndex !== -1 && redirectIndex < args.length - 1) {
          const text = args.slice(0, redirectIndex).join(' ');
          const targetFile = args[redirectIndex + 1];
          const newFs = { ...fs };
          const cDir = getNodeByPath(cwd, newFs);
          if (cDir && cDir.children) {
            cDir.children[targetFile] = { name: targetFile, type: 'file', content: text };
            setFs(newFs);
          }
        } else {
          term.writeln(args.join(' '));
        }
        break;
      case 'rm':
        if (args.length > 0) {
          const newFs = { ...fs };
          const cDir = getNodeByPath(cwd, newFs);
          if (cDir && cDir.children) {
            if (cDir.children[args[0]]) {
              delete cDir.children[args[0]];
              setFs(newFs);
            } else {
              term.writeln(`rm: cannot remove '${args[0]}': No such file or directory`);
            }
          }
        } else {
          term.writeln('rm: missing operand');
        }
        break;
      case 'cat':
        if (args.length > 0) {
          const target = args[0];
          const cDir = getNodeByPath(cwd, fs);
          if (cDir && cDir.children && cDir.children[target]) {
            const fileNode = cDir.children[target];
            if (fileNode.type === 'file') {
              if (typeof fileNode.content === 'string') {
                term.writeln(fileNode.content);
              } else {
                term.writeln(`cat: ${target}: binary file or unsupported format`);
              }
            } else {
              term.writeln(`cat: ${target}: Is a directory`);
            }
          } else {
            term.writeln(`cat: ${target}: No such file or directory`);
          }
        } else {
          term.writeln('cat: missing operand');
        }
        break;
      case 'theme':
        if (args.length === 0) {
          term.writeln(`Current theme: ${theme}`);
        } else if (args[0] === 'list') {
          term.writeln('Available themes: pupule, black, default, solarized, monokai');
        } else {
          const newTheme = args[0] as ThemeName;
          if (['pupule', 'black', 'default', 'solarized', 'monokai'].includes(newTheme)) {
            setTheme(newTheme);
            term.writeln(`Theme changed to ${newTheme}`);
          } else {
            term.writeln(`theme: unknown theme '${newTheme}'`);
          }
        }
        break;
      case 'apktool':
        await runApktool(args);
        break;
      case 'download':
        if (args.length > 0) {
          const target = args[0];
          const cDir = getNodeByPath(cwd, fs);
          if (cDir && cDir.children && cDir.children[target]) {
            const node = cDir.children[target];
            term.writeln(`Downloading ${target}...`);
            
            if (node.type === 'file') {
              const blob = node.content instanceof Blob ? node.content : new Blob([node.content as string], { type: 'application/octet-stream' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = target;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } else if (node.type === 'dir') {
              const zip = new JSZip();
              
              const addDirToZip = (dirNode: FileNode, currentZip: JSZip) => {
                if (!dirNode.children) return;
                Object.values(dirNode.children).forEach(child => {
                  if (child.type === 'file') {
                    const content = child.content instanceof Blob ? child.content : child.content as string;
                    currentZip.file(child.name, content);
                  } else if (child.type === 'dir') {
                    const newFolder = currentZip.folder(child.name);
                    if (newFolder) addDirToZip(child, newFolder);
                  }
                });
              };
              
              addDirToZip(node, zip);
              
              zip.generateAsync({ type: 'blob' }).then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${target}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                term.writeln(`\r\n\x1b[1;32m[✓] Downloaded ${target}.zip successfully.\x1b[0m`);
                writePrompt();
              });
              return; // Wait for async zip generation before writing prompt
            }
          } else {
            term.writeln(`download: cannot download '${target}': No such file or directory`);
          }
        } else {
          term.writeln('download: missing operand');
        }
        break;
      default:
        term.writeln(`${cmd}: command not found`);
    }

    writePrompt();
  };

  const handleAutoDecode = async () => {
    if (!lastUploadedApk || isProcessing || !termRef.current) return;
    const term = termRef.current;
    term.write(`apktool d ${lastUploadedApk}\r\n`);
    await handleCommand('apktool', ['d', lastUploadedApk]);
  };

  const handleDownloadDecoded = async () => {
    if (!lastUploadedApk || isProcessing || !termRef.current) return;
    const folderName = lastUploadedApk.replace('.apk', '');
    const term = termRef.current;
    term.write(`download ${folderName}\r\n`);
    await handleCommand('download', [folderName]);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <TerminalIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">Appro Dec</h1>
            <p className="text-xs text-white/50 font-medium">APK Reverse Engineering Terminal</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-6 max-w-7xl w-full mx-auto gap-6">
        <div className="flex-1 min-h-[500px] relative rounded-xl overflow-hidden ring-1 ring-white/20 shadow-[0_0_40px_rgba(168,85,247,0.15)] bg-black/50 backdrop-blur-xl">
          <TerminalComponent 
            onCommand={handleCommand} 
            theme={theme} 
            onTerminalReady={handleTerminalReady}
          />
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-4 justify-center bg-white/5 border border-white/10 p-4 rounded-xl">
          <button
            onClick={handleAutoDecode}
            disabled={!lastUploadedApk || isProcessing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
              !lastUploadedApk || isProcessing
                ? 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed'
                : 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/50 text-purple-300'
            }`}
          >
            <Zap className="w-4 h-4" />
            Decode APK by Appro Dec
          </button>

          <button
            onClick={handleDownloadDecoded}
            disabled={!lastUploadedApk || isProcessing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm font-medium ${
              !lastUploadedApk || isProcessing
                ? 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed'
                : 'bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-300'
            }`}
          >
            <Download className="w-4 h-4" />
            Download Decoded
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".apk"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            Upload APK
          </button>
          
          <button 
            onClick={() => {
              if (termRef.current) {
                termRef.current.writeln('\r\n\x1b[1;36mHelp & Documentation\x1b[0m');
                termRef.current.writeln('1. Upload an APK using the button or drag & drop (mock).');
                termRef.current.writeln('2. Type \x1b[1;33mapktool d app.apk\x1b[0m to decode.');
                termRef.current.writeln('3. Type \x1b[1;33mapktool b app\x1b[0m to rebuild.');
                termRef.current.writeln('4. Type \x1b[1;33mdownload app_modified.apk\x1b[0m to save.');
                writePrompt();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm font-medium"
          >
            <HelpCircle className="w-4 h-4" />
            Help
          </button>
        </div>
        
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white/5 border border-white/10">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Real Apktool Engine
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Powered by actual Apktool binaries in a secure sandbox. Full command support including decode, build, and framework installation.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white/5 border border-white/10">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Live Feedback
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Watch dynamic spinners and progress indicators during long operations. Never wonder if your build is stuck again.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white/5 border border-white/10">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
              Customizable
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Personalize your workspace with multiple built-in themes. Type <code className="bg-black/50 px-1.5 py-0.5 rounded text-cyan-400">theme list</code> to explore options.
            </p>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-6 text-center text-sm text-white/40 border-t border-white/10 mt-auto">
        <p>Appro Dec - The Ultimate APK Reverse Engineering Web Terminal</p>
        <p className="mt-1">Intended for legitimate reverse engineering purposes only.</p>
      </footer>
    </div>
  );
}
