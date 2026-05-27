import { Injectable } from '@angular/core';
import { Player } from '../models/player.model';
import { FileHandleStorageService } from './file-handle-storage.service';

declare const pako: any;

export const OFFSET_MAP: Record<string, number> = {
  skin: 88, skin_tone: 82, hair_type: 86, hair: 84,
  beard_type: 87, head_type: 81, estatura: 89, peso: 90,
  pos: 91, boots: 92, mangas: 93, foot: 94, nat: 83,
  ACC: 95, SPD: 96, STA: 97, STR: 98, TAC: 99, CON: 100,
  SHO: 101, CRO: 102, FK: 103, PAS: 104, HEA: 105,
  GKS: 106, GKH: 107, GKP: 108, guantes: 85
};

const STAT_ORDER = ['STR', 'STA', 'SPD', 'ACC', 'CON', 'PAS', 'CRO', 'SHO', 'HEA', 'TAC', 'FK', 'GKS', 'GKH', 'GKP'] as const;
type Stat = typeof STAT_ORDER[number];

const GK_WEIGHTS = [1, 1, 3, 2, 2, 1, 0, 0, 0, 1, 1, 10, 10, 10];
const DEF_WEIGHTS = [5, 2, 6, 2, 5, 4, 1, 1, 9, 9, 0, 0, 0, 0];
const MID_WEIGHTS = [4, 2, 3, 2, 4, 8, 7, 3, 3, 4, 0, 0, 0, 0];
const ATT_WEIGHTS = [4, 2, 6, 2, 6, 4, 2, 10, 6, 2, 0, 0, 0, 0];

const GK_BONUS = 6;
const DEF_BONUS = 6;
const MID_BONUS = 10;
const ATT_BONUS = 6;

const RATING_MULTIPLIER = 0x3f866666;

function ieee754ToFloat(bits: number): number {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, bits, false);
  return new DataView(buf).getFloat32(0, false);
}

const IN_R1 = ieee754ToFloat(RATING_MULTIPLIER);

function getWeightsAndBonus(posCategory: number): { weights: number[]; bonus: number } {
  switch (posCategory) {
    case 0:
      return { weights: GK_WEIGHTS, bonus: GK_BONUS };
    case 1:
      return { weights: DEF_WEIGHTS, bonus: DEF_BONUS };
    case 2:
      return { weights: MID_WEIGHTS, bonus: MID_BONUS };
    default:
      return { weights: ATT_WEIGHTS, bonus: ATT_BONUS };
  }
}

function getPositionCategory(position: number): number {
  if (position === 0) {
    return 0;
  }

  if (position >= 1 && position <= 7) {
    return 1;
  }

  if ((position >= 8 && position <= 15) || position === 18) {
    return 2;
  }

  return 3;
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly storageKey = 'players-dat';

  binaryData: Uint8Array | null = null;
  fileHandle: any = null;

  constructor(private readonly fileHandleStorage: FileHandleStorageService) {}

  formatPlayerId(index: number): string {
    return index.toString(16).toUpperCase().padStart(4, '0');
  }

  parsePlayerId(value: string): number {
    const parsed = Number.parseInt(value.trim(), 16);
    if (Number.isNaN(parsed) || parsed < 0 || parsed >= this.totalPlayers) {
      return -1;
    }

    return parsed;
  }

  getPlayerNameByIndex(index: number): string | null {
    if (!this.binaryData || index < 0 || index >= this.totalPlayers) {
      return null;
    }

    return this.readPlayer(index).name || null;
  }

  get totalPlayers(): number {
    if (!this.binaryData) return 0;
    return new DataView(this.binaryData.buffer).getUint16(8, true);
  }

  async loadFile(fileHandle?: any): Promise<string> {
    if (!(window as any).showOpenFilePicker) {
      throw new Error('Your browser does not support File System Access API. Use Chrome.');
    }

    let nextHandle = fileHandle;

    if (!nextHandle) {
      const handles = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [{ description: 'DAT Files', accept: { 'application/octet-stream': ['.dat'] } }]
      });
      nextHandle = handles[0];
    }

    const file = await nextHandle.getFile();
    const buffer = await file.arrayBuffer();
    this.fileHandle = nextHandle;
    this.binaryData = new Uint8Array(pako.inflate(new Uint8Array(buffer)));

    await this.fileHandleStorage.saveFileHandle(this.storageKey, nextHandle);

    return file.name;
  }

  async tryRestoreLastFile(): Promise<string | null> {
    const storedHandle = await this.fileHandleStorage.getFileHandle<any>(this.storageKey);

    if (!storedHandle || !(await this.hasReadPermission(storedHandle))) {
      return null;
    }

    try {
      return await this.loadFile(storedHandle);
    } catch {
      this.binaryData = null;
      this.fileHandle = null;
      await this.fileHandleStorage.deleteFileHandle(this.storageKey);
      return null;
    }
  }

  async saveToSameFile(player: Player, idx: number): Promise<void> {
    if (!this.fileHandle || !this.binaryData) throw new Error('No file loaded');
    this.writePlayer(idx, player);
    const writable = await this.fileHandle.createWritable();
    await writable.write(pako.deflate(this.binaryData));
    await writable.close();
  }

  async saveCurrentToSameFile(): Promise<void> {
    if (!this.fileHandle || !this.binaryData) {
      throw new Error('No file loaded');
    }

    const writable = await this.fileHandle.createWritable();
    await writable.write(pako.deflate(this.binaryData));
    await writable.close();
  }

  async downloadFile(): Promise<void> {
    if (!this.binaryData) return;
    const blob = new Blob([pako.deflate(this.binaryData)], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'players.dat';
    a.click();
  }

  readPlayer(idx: number): Player {
    const view = new DataView(this.binaryData!.buffer);
    const base = idx * 112;
    const nameArr = new Uint8Array(this.binaryData!.buffer.slice(base + 48, base + 80));
    const name = new TextDecoder('utf-16').decode(nameArr).replace(/\0/g, '').trim();
    const year = view.getUint16(base + 120, true);
    const player: any = { name, year };
    for (const key of Object.keys(OFFSET_MAP)) {
      player[key] = view.getUint8(base + OFFSET_MAP[key]);
    }
    return player as Player;
  }

  writePlayer(idx: number, player: Player): void {
    const view = new DataView(this.binaryData!.buffer);
    const base = idx * 112;
    for (let i = 0; i < 16; i++) {
      view.setUint16(base + 48 + i * 2, i < player.name.length ? player.name.charCodeAt(i) : 0, true);
    }
    for (const key of Object.keys(OFFSET_MAP)) {
      view.setUint8(base + OFFSET_MAP[key], (player as any)[key]);
    }
    view.setUint16(base + 120, player.year, true);
  }

  searchPlayer(query: string): number {
    const q = query.trim().toLowerCase();
    if (!q) {
      return -1;
    }

    const total = this.totalPlayers;
    for (let i = 0; i < total; i++) {
      const nameArr = new Uint8Array(this.binaryData!.buffer.slice(i * 112 + 48, i * 112 + 80));
      const name = new TextDecoder('utf-16').decode(nameArr).toLowerCase();
      const playerId = this.formatPlayerId(i).toLowerCase();
      if (name.includes(q) || playerId.includes(q)) return i;
    }
    return -1;
  }

  calculateOVR(player: Player): number {
    const posCategory = getPositionCategory(player.pos);
    const { weights, bonus } = getWeightsAndBonus(posCategory);

    let weightedSum = 0;
    let totalWeight = 0;
    let maxStat = 0;

    for (let i = 0; i < STAT_ORDER.length; i++) {
      const stat = player[STAT_ORDER[i] as Stat];
      weightedSum += weights[i] * stat;
      totalWeight += weights[i];
      if (stat > maxStat) {
        maxStat = stat;
      }
    }

    const raw = Math.floor((bonus * maxStat + weightedSum) * IN_R1 / (bonus + totalWeight));

    return Math.max(0, Math.min(100, raw));
  }

  private async hasReadPermission(fileHandle: any): Promise<boolean> {
    if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
      return false;
    }

    return (await fileHandle.queryPermission({ mode: 'read' })) === 'granted';
  }
}
