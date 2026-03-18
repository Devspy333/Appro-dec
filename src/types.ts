import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export interface FileNode {
  name: string;
  type: 'file' | 'dir';
  content?: string | Blob;
  children?: Record<string, FileNode>;
  parent?: FileNode;
}

export const themes = {
  pupule: {
    background: '#1a0b2e',
    foreground: '#f8f8f2',
    cursor: '#ff79c6',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
  },
  black: {
    background: '#000000',
    foreground: '#e0e0e0',
    cursor: '#ffffff',
    black: '#000000',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#ffffff',
  },
  default: {
    background: '#000000',
    foreground: '#00ff00',
    cursor: '#00ff00',
    black: '#000000',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#0000ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#ffffff',
  },
  solarized: {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#93a1a1',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
  }
};

export type ThemeName = keyof typeof themes;
