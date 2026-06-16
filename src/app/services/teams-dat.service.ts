import { Injectable } from '@angular/core';

import { TeamsDatKit, TeamsDatKitColor, TeamsDatRecord } from '../models/teams-dat.model';
import { FileHandleStorageService } from './file-handle-storage.service';

const FILE_HEADER_SIZE = 12;
const TEAM_BLOCK_SIZE = 4356;
const FORMATION_OFFSET = 0xB8;
const SPONSOR_TYPE_OFFSET = 0x100;
const KIT_MANUFACTURER_OFFSET = 0x104;
const EUROPEAN_COMPETITION_OFFSET = 0x124;
const STADIUM_NAME_OFFSET = 0x128;
const STADIUM_NAME_MAX_BYTES = TEAM_BLOCK_SIZE - STADIUM_NAME_OFFSET;
const KIT_COLOR_START_OFFSET = 0x18;
const KIT_COUNT = 4;
const COLORS_PER_KIT = 10;
const KIT_COLOR_STRIDE = 4;
const KIT_STYLE_GAP_SIZE = 4;
const KIT_STYLE_START_OFFSET = KIT_COLOR_START_OFFSET + (KIT_COUNT * COLORS_PER_KIT * KIT_COLOR_STRIDE) + KIT_STYLE_GAP_SIZE;
const KIT_STYLE_STRIDE = 4;
const KIT_LABELS = ['Home', 'Away', 'GK Home', 'GK Away'] as const;
const KIT_COLOR_LABELS = [
  'Primary',
  'Secondary',
  'Sponsor',
  'Shirt Nr',
  'Short Primary',
  'Short Secondary',
  'Short Nr',
  'Socks',
  'Manufacturer',
  'Socks Lines'
] as const;
const KIT_STYLE_LABELS = [
  'Vertical Stripes',
  'Horizontal Stripes',
  'Symmetrical',
  'Checks',
  'Plain',
  'Horizontal Band',
  'Vertical Band',
  'Side Panels',
  'Quartered',
  'Sleeves',
  'Diagonal Stripe',
  'Diagonal',
  'Upper Diagonal',
  'Gradient A',
  'Gradient B',
  'Shoulder-Chest Trapezoid'
] as const;
const SPONSOR_TYPE_LABELS = [
  'Emirates',
  'Spotify',
  'Etihad Airways',
  'T-Mobile',
  'Standard Chartered',
  'Snapdragon',
  'AIA',
  'Jeep',
  'Qatar Airways',
  'Riyadh Air',
  'Red Bull',
  'HP',
  'Betano',
  'TeamViewer',
  'MSC Cruises',
  'Visit Rwanda',
  'Mediacom',
  'Mapei',
  'Stake',
  'Standard'
] as const;
const EUROPEAN_COMPETITION_LABELS = [
  'None',
  'UCL',
  'UEL'
] as const;

@Injectable({ providedIn: 'root' })
export class TeamsDatService {
  private readonly storageKey = 'teams-dat';

  fileHandle: any = null;
  fileHeaderBytes: Uint8Array | null = null;
  teamDataBytes: Uint8Array | null = null;
  records: TeamsDatRecord[] = [];
  teamOptions: { value: number; label: string }[] = [];
  hasPendingChanges = false;
  private formationIdByTeamId = new Map<number, number>();
  private wasZlib = false;

  constructor(private readonly fileHandleStorage: FileHandleStorageService) {}

  get hasData(): boolean {
    return this.fileHeaderBytes !== null && this.teamDataBytes !== null;
  }

  get teamCount(): number {
    return this.records.length;
  }

  async loadFile(fileHandle?: any): Promise<string> {
    if (!(window as any).showOpenFilePicker) {
      throw new Error('Your browser does not support File System Access API. Use Chrome.');
    }

    let nextHandle = fileHandle;

    if (!nextHandle) {
      const handles = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [{ description: 'Teams DAT Files', accept: { 'application/octet-stream': ['.dat', '.bin'] } }]
      });

      nextHandle = handles[0];
    }

    this.fileHandle = nextHandle;
    const file = await nextHandle.getFile();
    console.log('[TeamsDat] file picked:', file.name, 'size:', file.size, 'bytes');
    this.applyLoadedBytes(new Uint8Array(await file.arrayBuffer()));

    await this.fileHandleStorage.saveFileHandle(this.storageKey, nextHandle);

    return file.name;
  }

  loadFromBytes(bytes: Uint8Array, fileName = 'TEAMS.DAT'): string {
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
      this.fileHandle = null;
      this.fileHeaderBytes = null;
      this.teamDataBytes = null;
      this.records = [];
      this.hasPendingChanges = false;
      this.formationIdByTeamId.clear();
      await this.fileHandleStorage.deleteFileHandle(this.storageKey);
      return null;
    }
  }

  async saveToSameFile(): Promise<void> {
    if (!this.fileHandle || !this.hasData) {
      throw new Error('No teams.dat loaded');
    }

    const writable = await this.fileHandle.createWritable();
    await writable.write(this.getSerializedData());
    await writable.close();
    this.hasPendingChanges = false;
  }

  exportCurrentFileBytes(): Uint8Array {
    return new Uint8Array(this.getSerializedData());
  }

  exportFile(fileName = 'teams_export.dat'): void {
    if (!this.hasData) {
      return;
    }

    const blob = new Blob([this.getSerializedData()], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  exportUncompressedFile(fileName = 'teams_raw.dat'): void {
    if (!this.fileHeaderBytes || !this.teamDataBytes) {
      return;
    }

    const merged = new Uint8Array(this.fileHeaderBytes.byteLength + this.teamDataBytes.byteLength);
    merged.set(this.fileHeaderBytes, 0);
    merged.set(this.teamDataBytes, this.fileHeaderBytes.byteLength);

    const blob = new Blob([merged.buffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  getRecord(index: number): TeamsDatRecord {
    if (!this.hasData) {
      throw new Error('No teams.dat loaded');
    }

    if (index < 0 || index >= this.records.length) {
      throw new Error('Team index out of range.');
    }

    return this.parseRecord(index);
  }

  getFormationIdByTeamId(teamId: number): number | null {
    return this.formationIdByTeamId.get(teamId) ?? null;
  }

  get kitStyleOptions(): Array<{ value: number; label: string }> {
    return KIT_STYLE_LABELS.map((label, index) => ({ value: index, label: `${index}. ${label}` }));
  }

  get sponsorTypeOptions(): Array<{ value: number; label: string }> {
    return SPONSOR_TYPE_LABELS.map((label, index) => ({ value: index, label: `${index}. ${label}` }));
  }

  get europeanCompetitionOptions(): Array<{ value: number; label: string }> {
    return EUROPEAN_COMPETITION_LABELS.map((label, index) => ({ value: index, label: `${index}. ${label}` }));
  }

  updateKitColor(index: number, kitIndex: number, colorIndex: number, hexColor: string): TeamsDatRecord {
    if (!this.hasData) {
      throw new Error('No teams.dat loaded');
    }

    const normalizedHex = this.normalizeHexColor(hexColor);

    if (!normalizedHex) {
      throw new Error(`Invalid color value: ${hexColor}`);
    }

    if (kitIndex < 0 || kitIndex >= KIT_COUNT || colorIndex < 0 || colorIndex >= COLORS_PER_KIT) {
      throw new Error('Kit color index out of range.');
    }

    const bytes = this.getTeamDataOrThrow();
    const offset = this.getKitColorOffset(this.getBlockStart(index), kitIndex, colorIndex);
    const [red, green, blue] = this.hexColorToRgb(normalizedHex);

    bytes[offset] = blue;
    bytes[offset + 1] = green;
    bytes[offset + 2] = red;

    const updatedRecord = this.parseRecord(index);
    this.records[index] = updatedRecord;
    this.hasPendingChanges = true;
    return updatedRecord;
  }

  updateKitStyle(index: number, kitIndex: number, styleId: number): TeamsDatRecord {
    if (!this.hasData) {
      throw new Error('No teams.dat loaded');
    }

    if (kitIndex < 0 || kitIndex >= KIT_COUNT) {
      throw new Error('Kit style index out of range.');
    }

    const normalizedStyleId = Number.isFinite(styleId) ? Math.trunc(styleId) : -1;

    if (normalizedStyleId < 0 || normalizedStyleId >= KIT_STYLE_LABELS.length) {
      throw new Error(`Invalid kit style id: ${styleId}`);
    }

    const view = this.getView();
    const offset = this.getKitStyleOffset(this.getBlockStart(index), kitIndex);
    view.setUint32(offset, normalizedStyleId, true);

    const updatedRecord = this.parseRecord(index);
    this.records[index] = updatedRecord;
    this.hasPendingChanges = true;
    return updatedRecord;
  }

  resetAllTeamRoles(playerId = 0): void {
    if (!this.hasData) {
      throw new Error('No teams.dat loaded');
    }

    const nextRolePlayerId = this.clamp(playerId, 0, 0xffffffff);
    const bytes = this.getTeamDataOrThrow();
    const view = this.getView(bytes);

    for (let index = 0; index < this.records.length; index += 1) {
      const blockStart = this.getBlockStart(index);
      view.setUint32(blockStart + 0xCC, nextRolePlayerId, true);
      view.setUint32(blockStart + 0xD0, nextRolePlayerId, true);
      view.setUint32(blockStart + 0xD4, nextRolePlayerId, true);
      view.setUint32(blockStart + 0xD8, nextRolePlayerId, true);
      view.setUint32(blockStart + 0xDC, nextRolePlayerId, true);
      this.records[index] = this.parseRecord(index, view, bytes);
    }

    this.hasPendingChanges = true;
  }

  updateRecord(index: number, changes: Partial<Pick<TeamsDatRecord,
    'teamId' | 'leagueId' | 'rivalId' | 'attackOvr' | 'midfieldOvr' | 'defenseOvr' |
    'formationId' | 'captainRole' | 'leftCornerRole' | 'rightCornerRole' | 'penaltyRole' |
    'freeKickRole' | 'region' | 'stadiumName' | 'sponsorType' | 'kitManufacturer' | 'europeanCompetition'
  >>): TeamsDatRecord {
    const view = this.getView();
    const blockStart = this.getBlockStart(index);

    if (changes.teamId !== undefined) {
      view.setUint32(blockStart + 0x00, this.clamp(changes.teamId, 0, 0xffffffff), true);
    }
    if (changes.leagueId !== undefined) {
      view.setUint32(blockStart + 0x04, this.clamp(changes.leagueId, 0, 0xffffffff), true);
    }
    if (changes.rivalId !== undefined) {
      view.setUint32(blockStart + 0x08, this.clamp(changes.rivalId, 0, 0xffffffff), true);
    }
    if (changes.attackOvr !== undefined) {
      view.setUint32(blockStart + 0x0C, this.clamp(changes.attackOvr, 0, 0xffffffff), true);
    }
    if (changes.midfieldOvr !== undefined) {
      view.setUint32(blockStart + 0x10, this.clamp(changes.midfieldOvr, 0, 0xffffffff), true);
    }
    if (changes.defenseOvr !== undefined) {
      view.setUint32(blockStart + 0x14, this.clamp(changes.defenseOvr, 0, 0xffffffff), true);
    }
    if (changes.formationId !== undefined) {
      view.setUint32(blockStart + FORMATION_OFFSET, this.clamp(changes.formationId, 0, 0xffffffff), true);
    }
    if (changes.captainRole !== undefined) {
      view.setUint32(blockStart + 0xCC, this.clamp(changes.captainRole, 0, 0xffffffff), true);
    }
    if (changes.leftCornerRole !== undefined) {
      view.setUint32(blockStart + 0xD0, this.clamp(changes.leftCornerRole, 0, 0xffffffff), true);
    }
    if (changes.rightCornerRole !== undefined) {
      view.setUint32(blockStart + 0xD4, this.clamp(changes.rightCornerRole, 0, 0xffffffff), true);
    }
    if (changes.penaltyRole !== undefined) {
      view.setUint32(blockStart + 0xD8, this.clamp(changes.penaltyRole, 0, 0xffffffff), true);
    }
    if (changes.freeKickRole !== undefined) {
      view.setUint32(blockStart + 0xDC, this.clamp(changes.freeKickRole, 0, 0xffffffff), true);
    }
    if (changes.sponsorType !== undefined) {
      view.setUint32(blockStart + SPONSOR_TYPE_OFFSET, this.clamp(changes.sponsorType, 0, 0xffffffff), true);
    }
    if (changes.kitManufacturer !== undefined) {
      view.setUint32(blockStart + KIT_MANUFACTURER_OFFSET, this.clamp(changes.kitManufacturer, 0, 0xffffffff), true);
    }
    if (changes.europeanCompetition !== undefined) {
      view.setUint32(blockStart + EUROPEAN_COMPETITION_OFFSET, this.clamp(changes.europeanCompetition, 0, 0xffffffff), true);
    }

    if (changes.region !== undefined) {
      const normalizedRegion = changes.region.toUpperCase().padEnd(2, ' ');
      const bytes = this.getTeamDataOrThrow();
      bytes[blockStart + 0xF8] = normalizedRegion.charCodeAt(0);
      bytes[blockStart + 0xF9] = 0x00;
      bytes[blockStart + 0xFA] = normalizedRegion.charCodeAt(1);
      bytes[blockStart + 0xFB] = 0x00;
    }

    if (changes.stadiumName !== undefined) {
      this.writeUtf16String(this.getTeamDataOrThrow(), blockStart + STADIUM_NAME_OFFSET, STADIUM_NAME_MAX_BYTES, changes.stadiumName);
    }

    const updatedRecord = this.parseRecord(index);
    this.records[index] = updatedRecord;
    this.teamOptions = this.records.map((recordItem) => ({
      value: recordItem.index,
      label: recordItem.teamLabel + (recordItem.stadiumName ? ` | ${recordItem.stadiumName}` : '')
    }));
    this.formationIdByTeamId = this.buildFormationIdMap(this.records);
    this.hasPendingChanges = true;
    return updatedRecord;
  }

  private scanRecords(bytes: Uint8Array): TeamsDatRecord[] {
    const view = this.getView(bytes);
    const totalTeams = Math.floor(bytes.byteLength / TEAM_BLOCK_SIZE);

    return Array.from({ length: totalTeams }, (_, index) => this.parseRecord(index, view, bytes));
  }

  private parseRecord(index: number, view?: DataView, bytes?: Uint8Array): TeamsDatRecord {
    const safeBytes = bytes ?? this.getTeamDataOrThrow();
    const safeView = view ?? this.getView(safeBytes);
    const blockStart = this.getBlockStart(index);

    if (blockStart + TEAM_BLOCK_SIZE > safeBytes.byteLength) {
      throw new Error(`Invalid teams.dat format. Team block ${index} is out of bounds.`);
    }

    const teamId = safeView.getUint32(blockStart + 0x00, true);

    return {
      index,
      blockStart,
      teamId,
      teamLabel: this.formatTeamLabel(teamId),
      leagueId: safeView.getUint32(blockStart + 0x04, true),
      rivalId: safeView.getUint32(blockStart + 0x08, true),
      attackOvr: safeView.getUint32(blockStart + 0x0C, true),
      midfieldOvr: safeView.getUint32(blockStart + 0x10, true),
      defenseOvr: safeView.getUint32(blockStart + 0x14, true),
      formationId: safeView.getUint32(blockStart + FORMATION_OFFSET, true),
      captainRole: safeView.getUint32(blockStart + 0xCC, true),
      leftCornerRole: safeView.getUint32(blockStart + 0xD0, true),
      rightCornerRole: safeView.getUint32(blockStart + 0xD4, true),
      penaltyRole: safeView.getUint32(blockStart + 0xD8, true),
      freeKickRole: safeView.getUint32(blockStart + 0xDC, true),
      region: this.extractUtf16String(safeBytes, blockStart + 0xF8, 4),
      stadiumName: this.extractUtf16String(safeBytes, blockStart + STADIUM_NAME_OFFSET, STADIUM_NAME_MAX_BYTES),
      sponsorType: safeView.getUint32(blockStart + SPONSOR_TYPE_OFFSET, true),
      kitManufacturer: safeView.getUint32(blockStart + KIT_MANUFACTURER_OFFSET, true),
      europeanCompetition: safeView.getUint32(blockStart + EUROPEAN_COMPETITION_OFFSET, true),
      kits: this.readKits(safeBytes, blockStart)
    };
  }

  private readKits(bytes: Uint8Array, blockStart: number): TeamsDatKit[] {
    return Array.from({ length: KIT_COUNT }, (_, kitIndex) => ({
      kitIndex,
      label: KIT_LABELS[kitIndex],
      styleId: this.readKitStyleId(bytes, blockStart, kitIndex),
      styleLabel: this.getKitStyleLabel(this.readKitStyleId(bytes, blockStart, kitIndex)),
      styleByteOffset: this.getKitStyleOffset(blockStart, kitIndex),
      styleFileOffset: FILE_HEADER_SIZE + this.getKitStyleOffset(blockStart, kitIndex),
      colors: Array.from({ length: COLORS_PER_KIT }, (_, colorIndex) => this.readKitColor(bytes, blockStart, kitIndex, colorIndex))
    }));
  }

  private readKitColor(bytes: Uint8Array, blockStart: number, kitIndex: number, colorIndex: number): TeamsDatKitColor {
    const byteOffset = this.getKitColorOffset(blockStart, kitIndex, colorIndex);
    const colorBytes = bytes.subarray(byteOffset, byteOffset + KIT_COLOR_STRIDE);
    const blue = colorBytes[0] ?? 0;
    const green = colorBytes[1] ?? 0;
    const red = colorBytes[2] ?? 0;

    return {
      colorIndex,
      label: KIT_COLOR_LABELS[colorIndex] ?? `Color ${colorIndex + 1}`,
      byteOffset,
      fileOffset: FILE_HEADER_SIZE + byteOffset,
      hex: this.rgbToHexColor(red, green, blue),
      rawHex: Array.from(colorBytes, (value) => value.toString(16).toUpperCase().padStart(2, '0')).join('')
    };
  }

  private getKitColorOffset(blockStart: number, kitIndex: number, colorIndex: number): number {
    return blockStart + KIT_COLOR_START_OFFSET + ((kitIndex * COLORS_PER_KIT) + colorIndex) * KIT_COLOR_STRIDE;
  }

  private getKitStyleOffset(blockStart: number, kitIndex: number): number {
    return blockStart + KIT_STYLE_START_OFFSET + kitIndex * KIT_STYLE_STRIDE;
  }

  private readKitStyleId(bytes: Uint8Array, blockStart: number, kitIndex: number): number {
    const view = this.getView(bytes);
    return view.getUint32(this.getKitStyleOffset(blockStart, kitIndex), true);
  }

  private getKitStyleLabel(styleId: number): string {
    return KIT_STYLE_LABELS[styleId] ?? `Unknown (${styleId})`;
  }

  private getBlockStart(index: number): number {
    return index * TEAM_BLOCK_SIZE;
  }

  private getView(bytes?: Uint8Array): DataView {
    const safeBytes = bytes ?? this.getTeamDataOrThrow();
    return new DataView(safeBytes.buffer, safeBytes.byteOffset, safeBytes.byteLength);
  }

  private getTeamDataOrThrow(): Uint8Array {
    if (!this.teamDataBytes) {
      throw new Error('No teams.dat loaded');
    }

    return this.teamDataBytes;
  }

  private extractUtf16String(bytes: Uint8Array, start: number, maxBytes: number): string {
    let output = '';

    for (let idx = 0; idx < maxBytes; idx += 2) {
      if (start + idx + 1 >= bytes.length) {
        break;
      }

      const charCode = bytes[start + idx] | (bytes[start + idx + 1] << 8);
      if (charCode === 0) {
        break;
      }

      if (charCode >= 32 && charCode <= 126) {
        output += String.fromCharCode(charCode);
      }
    }

    return output.trim();
  }

  private writeUtf16String(bytes: Uint8Array, start: number, maxBytes: number, value: string): void {
    const normalizedValue = value.slice(0, Math.floor(maxBytes / 2));

    for (let idx = 0; idx < maxBytes; idx += 2) {
      bytes[start + idx] = 0x00;
      bytes[start + idx + 1] = 0x00;
    }

    for (let idx = 0; idx < normalizedValue.length; idx += 1) {
      const charCode = normalizedValue.charCodeAt(idx);
      bytes[start + idx * 2] = charCode & 0xff;
      bytes[start + idx * 2 + 1] = (charCode >> 8) & 0xff;
    }
  }

  private formatTeamLabel(teamId: number): string {
    return `Team ${teamId}`;
  }

  private buildFormationIdMap(records: TeamsDatRecord[]): Map<number, number> {
    const map = new Map<number, number>();

    records.forEach((record) => {
      if (!map.has(record.teamId)) {
        map.set(record.teamId, record.formationId);
      }
    });

    return map;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private normalizeHexColor(value: string): string | null {
    const trimmedValue = value.trim();
    const normalizedValue = trimmedValue.startsWith('#') ? trimmedValue : `#${trimmedValue}`;

    return /^#[0-9A-Fa-f]{6}$/.test(normalizedValue) ? normalizedValue.toUpperCase() : null;
  }

  private hexColorToRgb(value: string): [number, number, number] {
    return [
      Number.parseInt(value.slice(1, 3), 16),
      Number.parseInt(value.slice(3, 5), 16),
      Number.parseInt(value.slice(5, 7), 16)
    ];
  }

  private rgbToHexColor(red: number, green: number, blue: number): string {
    return `#${red.toString(16).toUpperCase().padStart(2, '0')}${green.toString(16).toUpperCase().padStart(2, '0')}${blue.toString(16).toUpperCase().padStart(2, '0')}`;
  }

  private async hasReadPermission(fileHandle: any): Promise<boolean> {
    if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
      return false;
    }

    return (await fileHandle.queryPermission({ mode: 'read' })) === 'granted';
  }

  private applyLoadedBytes(raw: Uint8Array): void {
    console.log('[TeamsDat] raw buffer length:', raw.byteLength,
      '| first 4 bytes:', raw[0], raw[1], raw[2], raw[3]);

    const isZlib = raw.length >= 2 && raw[0] === 0x78;
    let payload: Uint8Array;

    if (isZlib) {
      console.log('[TeamsDat] zlib header detected, inflating...');
      payload = new Uint8Array((window as any).pako.inflate(raw));
      console.log('[TeamsDat] inflated size:', payload.byteLength);
    } else {
      console.log('[TeamsDat] no zlib header, reading raw');
      payload = new Uint8Array(raw);
    }

    if (payload.byteLength < FILE_HEADER_SIZE + TEAM_BLOCK_SIZE) {
      throw new Error(`Invalid teams.dat: file is too small (${payload.byteLength} bytes).`);
    }

    const nextTeamDataBytes = payload.slice(FILE_HEADER_SIZE);
    const expectedTeams = Math.floor(nextTeamDataBytes.byteLength / TEAM_BLOCK_SIZE);
    console.log('[TeamsDat] team data bytes:', nextTeamDataBytes.byteLength,
      '| expected team count:', expectedTeams);

    if (expectedTeams > 2000) {
      throw new Error(
        `Unreasonable team count (${expectedTeams}) — wrong block size or wrong file.` +
        ` Payload size=${payload.byteLength}, TEAM_BLOCK_SIZE=${TEAM_BLOCK_SIZE}.`
      );
    }

    const nextHeaderBytes = payload.slice(0, FILE_HEADER_SIZE);
    console.log('[TeamsDat] scanning', expectedTeams, 'records...');
    const nextRecords = this.scanRecords(nextTeamDataBytes);
    console.log('[TeamsDat] scan done, records:', nextRecords.length);

    if (nextRecords.length === 0) {
      throw new Error('Invalid teams.dat: no team blocks found.');
    }

    this.wasZlib = isZlib;
    this.fileHeaderBytes = nextHeaderBytes;
    this.teamDataBytes = nextTeamDataBytes;
    this.records = nextRecords;
    this.teamOptions = nextRecords.map(r => ({
      value: r.index,
      label: r.teamLabel + (r.stadiumName ? ` | ${r.stadiumName}` : '')
    }));
    this.formationIdByTeamId = this.buildFormationIdMap(nextRecords);
    this.hasPendingChanges = false;
    console.log('[TeamsDat] load complete —', nextRecords.length, 'teams.');
  }

  private getSerializedData(): ArrayBuffer {
    if (!this.fileHeaderBytes || !this.teamDataBytes) {
      throw new Error('No teams.dat loaded');
    }

    const merged = new Uint8Array(this.fileHeaderBytes.byteLength + this.teamDataBytes.byteLength);
    merged.set(this.fileHeaderBytes, 0);
    merged.set(this.teamDataBytes, this.fileHeaderBytes.byteLength);

    if (this.wasZlib) {
      return ((window as any).pako.deflate(merged) as Uint8Array).buffer;
    }

    return merged.buffer;
  }
}
