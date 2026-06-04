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

type OvrCategory = 'gk' | 'def' | 'mid' | 'att';

interface OvrProfile {
  weights: number[];
  bonus: number;
}

export interface ReplacePlayersOptions {
  templatePlayerIndex?: number;
}

const DEFAULT_PROFILES: Record<OvrCategory, OvrProfile> = {
  gk: { weights: [2, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10], bonus: 10 },
  def: { weights: [5, 0, 2, 0, 3, 2, 1, 1, 5, 8, 0, 0, 0, 0], bonus: 15 },
  mid: { weights: [5, 8, 2, 6, 15, 20, 15, 5, 0, 8, 0, 0, 0, 0], bonus: 10 },
  att: { weights: [5, 1, 6, 2, 10, 4, 6, 20, 5, 0, 0, 0, 0, 0], bonus: 10 }
};

const RATING_MULTIPLIER_BITS = 0x3f833333;

function ieee754ToFloat(bits: number): number {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, bits, false);
  return new DataView(buf).getFloat32(0, false);
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
  private readonly playerIdOffset = 0x0c;
  private readonly hiddenFromTransferMarketOffset = 0x6e;
  private readonly isIconLegendOffset = 0x6f;
  private readonly birthDayOffset = 0x70;
  private readonly birthMonthOffset = 0x74;
  private readonly playerStride = 112;
  private readonly yearOffset = 120;
  private readonly totalPlayersOffset = 8;

  binaryData: Uint8Array | null = null;
  fileHandle: any = null;

  private readonly profiles: Record<OvrCategory, OvrProfile> = DEFAULT_PROFILES;
  private readonly ratingMultiplier = ieee754ToFloat(RATING_MULTIPLIER_BITS);

  constructor(private readonly fileHandleStorage: FileHandleStorageService) {}

  formatPlayerId(index: number): string {
    return this.getStoredPlayerId(index).toString(16).toUpperCase().padStart(4, '0');
  }

  parsePlayerId(value: string): number {
    const parsed = Number.parseInt(value.trim(), 16);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 0xffff) {
      return -1;
    }

    const total = this.totalPlayers;

    for (let index = 0; index < total; index += 1) {
      if (this.getStoredPlayerId(index) === parsed) {
        return index;
      }
    }

    return -1;
  }

  getPlayerNameByIndex(index: number): string | null {
    if (!this.binaryData || index < 0 || index >= this.totalPlayers) {
      return null;
    }

    return this.readPlayer(index).name || null;
  }

  getStoredPlayerId(index: number): number {
    if (!this.binaryData || index < 0 || index >= this.totalPlayers) {
      return index;
    }

    const view = new DataView(this.binaryData.buffer);
    const base = index * this.playerStride;
    return view.getUint16(base + this.playerIdOffset, true);
  }

  get totalPlayers(): number {
    if (!this.binaryData) return 0;

    const headerTotal = new DataView(this.binaryData.buffer).getUint16(this.totalPlayersOffset, true);

    if (this.binaryData.byteLength < this.yearOffset + 2) {
      return headerTotal;
    }

    const derivedTotal = Math.floor((this.binaryData.byteLength - (this.yearOffset + 2)) / this.playerStride) + 1;

    return Math.max(headerTotal, derivedTotal);
  }

  replacePlayers(
    players: Player[],
    options: ReplacePlayersOptions = {}
  ): { replaced: number; previousTotal: number; nextTotal: number } {
    if (!this.binaryData) {
      throw new Error('No file loaded');
    }

    const previousTotal = this.totalPlayers;
    const templateRecord = this.captureTemplateRecord(options.templatePlayerIndex, previousTotal);
    const replaced = Math.min(players.length, 0xffff);
    const nextTotal = replaced;
    const requiredLength = nextTotal > 0
      ? (nextTotal - 1) * this.playerStride + this.yearOffset + 2
      : this.totalPlayersOffset + 2;

    if (this.binaryData.byteLength !== requiredLength) {
      const nextBinaryData = new Uint8Array(requiredLength);
      const copyLength = Math.min(this.binaryData.byteLength, requiredLength);
      nextBinaryData.set(this.binaryData.subarray(0, copyLength));
      this.binaryData = nextBinaryData;
    }

    const headerView = new DataView(this.binaryData.buffer);
    headerView.setUint16(this.totalPlayersOffset, nextTotal, true);

    if (templateRecord) {
      for (let index = 0; index < replaced; index++) {
        this.seedPlayerRecord(index, templateRecord);
      }
    }

    for (let index = 0; index < replaced; index++) {
      this.writePlayer(index, players[index]);
    }

    return { replaced, previousTotal, nextTotal };
  }

  private captureTemplateRecord(templatePlayerIndex: number | undefined, previousTotal: number): Uint8Array | null {
    if (templatePlayerIndex === undefined || templatePlayerIndex < 0 || templatePlayerIndex >= previousTotal || !this.binaryData) {
      return null;
    }

    const templateBase = templatePlayerIndex * this.playerStride;
    return new Uint8Array(this.binaryData.slice(templateBase, templateBase + this.playerStride));
  }

  private seedPlayerRecord(index: number, templateRecord: Uint8Array): void {
    if (!this.binaryData) {
      return;
    }

    const targetBase = index * this.playerStride;
    this.binaryData.set(templateRecord, targetBase);
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
    const hiddenFromTransferMarket = view.getUint8(base + this.hiddenFromTransferMarketOffset);
    const isIconLegend = view.getUint8(base + this.isIconLegendOffset);
    const birthDay = view.getUint32(base + this.birthDayOffset, true);
    const birthMonth = view.getUint32(base + this.birthMonthOffset, true);
    const year = view.getUint16(base + 120, true);
    const player: any = { name, hiddenFromTransferMarket, isIconLegend, birthDay, birthMonth, year };
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
    view.setUint16(base + this.playerIdOffset, idx, true);
    view.setUint8(base + this.hiddenFromTransferMarketOffset, player.hiddenFromTransferMarket ?? 0);
    view.setUint8(base + this.isIconLegendOffset, player.isIconLegend ?? 0);
    view.setUint32(base + this.birthDayOffset, player.birthDay, true);
    view.setUint32(base + this.birthMonthOffset, player.birthMonth, true);
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
    const { weights, bonus } = this.getProfileByPositionCategory(posCategory);

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

    const denominator = bonus + totalWeight;

    if (denominator <= 0) {
      return 0;
    }

    const raw = Math.floor((bonus * maxStat + weightedSum) * this.ratingMultiplier / denominator);

    return Math.max(0, Math.min(100, raw));
  }

  private getProfileByPositionCategory(posCategory: number): OvrProfile {
    switch (posCategory) {
      case 0:
        return this.profiles.gk;
      case 1:
        return this.profiles.def;
      case 2:
        return this.profiles.mid;
      default:
        return this.profiles.att;
    }
  }

  private async hasReadPermission(fileHandle: any): Promise<boolean> {
    if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
      return false;
    }

    return (await fileHandle.queryPermission({ mode: 'read' })) === 'granted';
  }
}
