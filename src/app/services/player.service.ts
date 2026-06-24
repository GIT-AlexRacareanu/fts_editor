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

export type OvrCategory = 'gk' | 'def' | 'mid' | 'att';

interface OvrProfile {
  weights: number[];
  bonus: number;
  multiplier: number;
}

export interface ReplacePlayersOptions {
  templatePlayerIndex?: number;
}

export function calculatePlayerOvr(player: Player): number {
  const posCategory = getPositionCategory(player.pos);
  const profile = getDefaultProfileByPositionCategory(posCategory);
  const { weights, bonus, multiplier } = profile;

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

  const raw = Math.floor((bonus * maxStat + weightedSum) * multiplier / denominator);

  return Math.max(0, Math.min(100, raw));
}

const RATING_MULTIPLIER_BITS = 0x3f866666;
const DEFAULT_MULTIPLIER = ieee754ToFloat(RATING_MULTIPLIER_BITS);

const DEFAULT_PROFILES: Record<OvrCategory, OvrProfile> = {
  gk: { weights: [2, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 12, 12, 12], bonus: 0, multiplier: DEFAULT_MULTIPLIER},
  def: { weights: [10, 4, 2, 2, 4, 4, 0, 0, 10, 15, 0, 0, 0, 0], bonus: 0, multiplier: DEFAULT_MULTIPLIER },
  mid: { weights: [5, 10, 2, 2, 15, 15, 6, 0, 2, 6, 0, 0, 0, 0], bonus: 0, multiplier: DEFAULT_MULTIPLIER},
  att: { weights: [4, 2, 4, 4, 20, 6, 2, 20, 2, 0, 0, 0, 0, 0], bonus: 0, multiplier: DEFAULT_MULTIPLIER }
};

function ieee754ToFloat(bits: number): number {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, bits, false);
  return new DataView(buf).getFloat32(0, false);
}

function getPositionCategory(position: number): number {
  if (position === 0) {
    return 0;
  }

  if (position === 8) {
    return 2;
  }

  if (position >= 1 && position <= 10) {
    return 1;
  }

  if (position >= 11 && position <= 18) {
    return 2;
  }

  return 3;
}

function getDefaultProfileByPositionCategory(posCategory: number): OvrProfile {
  switch (posCategory) {
    case 0:
      return DEFAULT_PROFILES.gk;
    case 1:
      return DEFAULT_PROFILES.def;
    case 2:
      return DEFAULT_PROFILES.mid;
    default:
      return DEFAULT_PROFILES.att;
  }
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly storageKey = 'players-dat';
  private readonly playerIdOffset = 0x0c;
  private readonly excludedFromExhibitionOffset = 0x6d;
  private readonly hiddenFromTransferMarketOffset = 0x6e;
  private readonly isIconLegendOffset = 0x6f;
  private readonly birthDayOffset = 0x70;
  private readonly birthMonthOffset = 0x74;
  private readonly playerStride = 112;
  private readonly yearOffset = 120;
  private readonly totalPlayersOffset = 8;
  private readonly playerNameOffset = 48;
  private readonly playerNameByteLength = 32;
  private readonly playerNameDecoder = new TextDecoder('utf-16le');

  binaryData: Uint8Array | null = null;
  fileHandle: any = null;

  constructor(private readonly fileHandleStorage: FileHandleStorageService) {}

  formatPlayerId(index: number): string {
    return this.getStoredPlayerId(index).toString(16).toUpperCase().padStart(4, '0');
  }

  findPlayerIndexByName(name: string): number {
    const normalizedName = this.normalizePlayerName(name);

    if (!normalizedName) {
      return -1;
    }

    const compactName = normalizedName.replace(/\s+/g, '');
    const total = this.totalPlayers;

    for (let index = 0; index < total; index += 1) {
      const playerName = this.normalizePlayerName(this.getPlayerNameByIndex(index) ?? '');

      if (!playerName) {
        continue;
      }

      if (playerName === normalizedName || playerName.replace(/\s+/g, '') === compactName) {
        return index;
      }
    }

    const normalizedTokens = normalizedName.split(' ').filter((token) => token.length > 0);

    if (normalizedTokens.length === 1) {
      let matchedIndex = -1;

      for (let index = 0; index < total; index += 1) {
        const playerName = this.normalizePlayerName(this.getPlayerNameByIndex(index) ?? '');

        if (!playerName) {
          continue;
        }

        const playerTokens = playerName.split(' ').filter((token) => token.length > 0);

        if (!playerTokens.includes(normalizedTokens[0])) {
          continue;
        }

        if (matchedIndex !== -1) {
          return -1;
        }

        matchedIndex = index;
      }

      return matchedIndex;
    }

    if (normalizedTokens.length < 2) {
      return -1;
    }

    const targetLastToken = normalizedTokens[normalizedTokens.length - 1];
    const targetInitial = normalizedTokens[0][0];

    let surnameOnlyMatch = -1;

    for (let index = 0; index < total; index += 1) {
      const playerName = this.normalizePlayerName(this.getPlayerNameByIndex(index) ?? '');

      if (!playerName) {
        continue;
      }

      if (playerName !== targetLastToken) {
        continue;
      }

      if (surnameOnlyMatch !== -1) {
        surnameOnlyMatch = -1;
        break;
      }

      surnameOnlyMatch = index;
    }

    if (surnameOnlyMatch !== -1) {
      return surnameOnlyMatch;
    }

    for (let index = 0; index < total; index += 1) {
      const playerName = this.normalizePlayerName(this.getPlayerNameByIndex(index) ?? '');

      if (!playerName) {
        continue;
      }

      const playerTokens = playerName.split(' ').filter((token) => token.length > 0);

      if (playerTokens.length < 2) {
        continue;
      }

      if (playerTokens[playerTokens.length - 1] === targetLastToken && playerTokens[0][0] === targetInitial) {
        return index;
      }
    }

    return -1;
  }

  parsePlayerId(value: string): number {
    const parsed = Number.parseInt(value.trim(), 16);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 0xffff) {
      return -1;
    }

    return this.findPlayerIndexByStoredId(parsed);
  }

  findPlayerIndexByStoredId(storedId: number): number {
    if (!Number.isFinite(storedId) || storedId < 0 || storedId > 0xffff) {
      return -1;
    }

    const total = this.totalPlayers;

    for (let index = 0; index < total; index += 1) {
      if (this.getStoredPlayerId(index) === storedId) {
        return index;
      }
    }

    return -1;
  }

  private normalizePlayerName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
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
    if (!this.binaryData) {
      return 0;
    }

    const headerTotal = new DataView(this.binaryData.buffer).getUint16(this.totalPlayersOffset, true);
    const derivedTotal = this.getDerivedPlayerCount(this.binaryData.byteLength);

    // Prefer the derived count to avoid trusting corrupted headers that can cause out-of-bounds access.
    if (derivedTotal > 0) {
      return derivedTotal;
    }

    return headerTotal;
  }

  private getDerivedPlayerCount(byteLength: number): number {
    if (!Number.isFinite(byteLength) || byteLength < this.yearOffset + 2) {
      return 0;
    }

    return Math.floor((byteLength - (this.yearOffset + 2)) / this.playerStride) + 1;
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

    this.fileHandle = nextHandle;
    const file = await nextHandle.getFile();
    this.applyLoadedBytes(new Uint8Array(await file.arrayBuffer()));

    await this.fileHandleStorage.saveFileHandle(this.storageKey, nextHandle);

    return file.name;
  }

  loadFromBytes(bytes: Uint8Array, fileName = 'PLAYERS.DAT'): string {
    this.fileHandle = null;
    this.applyLoadedBytes(bytes);
    return fileName;
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
    await writable.write(this.getSerializedData());
    await writable.close();
  }

  async saveCurrentToSameFile(): Promise<void> {
    if (!this.fileHandle || !this.binaryData) {
      throw new Error('No file loaded');
    }

    const writable = await this.fileHandle.createWritable();
    await writable.write(this.getSerializedData());
    await writable.close();
  }

  exportCurrentFileBytes(): Uint8Array {
    return this.getSerializedData();
  }

  exportUncompressedFile(fileName = 'players_raw.dat'): void {
    if (!this.binaryData) {
      return;
    }

    const bytes = new Uint8Array(this.binaryData.byteLength);
    bytes.set(this.binaryData);

    const blob = new Blob([bytes.buffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async downloadFile(): Promise<void> {
    if (!this.binaryData) return;
    const serialized = this.getSerializedData();
    const downloadBytes = new Uint8Array(serialized.byteLength);
    downloadBytes.set(serialized);
    const blob = new Blob([
      downloadBytes.buffer
    ], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'players.dat';
    a.click();
  }

  private applyLoadedBytes(bytes: Uint8Array): void {
    this.binaryData = new Uint8Array(pako.inflate(bytes));
    this.syncTotalPlayersHeaderWithDerivedCount();
  }

  private getSerializedData(): Uint8Array {
    if (!this.binaryData) {
      throw new Error('No file loaded');
    }

    this.syncTotalPlayersHeaderWithDerivedCount();

    return new Uint8Array(pako.deflate(this.binaryData));
  }

  private syncTotalPlayersHeaderWithDerivedCount(): void {
    if (!this.binaryData) {
      return;
    }

    const derivedTotal = this.getDerivedPlayerCount(this.binaryData.byteLength);

    if (derivedTotal <= 0) {
      return;
    }

    new DataView(this.binaryData.buffer).setUint16(this.totalPlayersOffset, derivedTotal, true);
  }

  readPlayer(idx: number): Player {
    const view = new DataView(this.binaryData!.buffer);
    const base = idx * 112;
    const name = this.readPlayerName(base);
    const excludedFromExhibition = view.getUint8(base + this.excludedFromExhibitionOffset);
    const hiddenFromTransferMarket = view.getUint8(base + this.hiddenFromTransferMarketOffset);
    const isIconLegend = view.getUint8(base + this.isIconLegendOffset);
    const canReadBirthFields = this.birthMonthOffset + 4 <= this.playerStride;
    const birthDay = canReadBirthFields ? view.getUint32(base + this.birthDayOffset, true) : 1;
    const birthMonth = canReadBirthFields ? view.getUint32(base + this.birthMonthOffset, true) : 1;
    const year = view.getUint16(base + 120, true);
    const player: any = { name, excludedFromExhibition, hiddenFromTransferMarket, isIconLegend, birthDay, birthMonth, year };
    for (const key of Object.keys(OFFSET_MAP)) {
      player[key] = view.getUint8(base + OFFSET_MAP[key]);
    }
    return player as Player;
  }

  writePlayer(idx: number, player: Player): void {
    const view = new DataView(this.binaryData!.buffer);
    const base = idx * 112;
    const truncatedName = player.name.slice(0, 16);

    player.name = truncatedName;

    for (let i = 0; i < 16; i++) {
      view.setUint16(base + 48 + i * 2, i < truncatedName.length ? truncatedName.charCodeAt(i) : 0, true);
    }
    view.setUint16(base + this.playerIdOffset, idx, true);
    view.setUint8(base + this.excludedFromExhibitionOffset, player.excludedFromExhibition ?? 0);
    view.setUint8(base + this.hiddenFromTransferMarketOffset, player.hiddenFromTransferMarket ?? 0);
    view.setUint8(base + this.isIconLegendOffset, player.isIconLegend ?? 0);
    const canWriteBirthFields = this.birthMonthOffset + 4 <= this.playerStride;

    if (canWriteBirthFields) {
      view.setUint32(base + this.birthDayOffset, player.birthDay, true);
      view.setUint32(base + this.birthMonthOffset, player.birthMonth, true);
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
      const name = this.readPlayerName(i * this.playerStride).toLowerCase();
      const playerId = this.formatPlayerId(i).toLowerCase();
      if (name.includes(q) || playerId.includes(q)) return i;
    }
    return -1;
  }

  calculateOVR(player: Player): number {
    const posCategory = getPositionCategory(player.pos);
    const { weights, bonus, multiplier } = getDefaultProfileByPositionCategory(posCategory);

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

    const raw = Math.floor((bonus * maxStat + weightedSum) * multiplier / denominator);

    return Math.max(0, Math.min(100, raw));
  }

  private readPlayerName(base: number): string {
    const nameBytes = this.binaryData!.subarray(base + this.playerNameOffset, base + this.playerNameOffset + this.playerNameByteLength);
    return this.playerNameDecoder.decode(nameBytes).replace(/\0/g, '').trim();
  }

  appendPlayers(players: Player[]): number[] {
    if (!this.binaryData || players.length === 0) {
      return [];
    }

    const prevTotal = this.totalPlayers;
    const count = Math.min(players.length, Math.max(0, 0xffff - prevTotal));

    if (count === 0) {
      return [];
    }

    const nextTotal = prevTotal + count;
    const requiredLength = (nextTotal - 1) * this.playerStride + this.yearOffset + 2;
    const nextBinaryData = new Uint8Array(requiredLength);
    nextBinaryData.set(this.binaryData.subarray(0, Math.min(this.binaryData.byteLength, requiredLength)));
    this.binaryData = nextBinaryData;

    const view = new DataView(this.binaryData.buffer);
    view.setUint16(this.totalPlayersOffset, nextTotal, true);

    const templateRecord = prevTotal > 0 ? this.captureTemplateRecord(0, prevTotal) : null;
    const newIndices: number[] = [];

    for (let i = 0; i < count; i++) {
      const index = prevTotal + i;

      if (templateRecord) {
        this.seedPlayerRecord(index, templateRecord);
      }

      this.writePlayer(index, players[i]);
      newIndices.push(index);
    }

    return newIndices;
  }

  private async hasReadPermission(fileHandle: any): Promise<boolean> {
    if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
      return false;
    }

    return (await fileHandle.queryPermission({ mode: 'read' })) === 'granted';
  }
}
