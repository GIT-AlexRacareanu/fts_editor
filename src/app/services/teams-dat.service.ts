import { Injectable } from '@angular/core';

import { TEAM_NAMES_BY_ID } from '../data/team-names';
import { TeamsDatRecord } from '../models/teams-dat.model';
import { FileHandleStorageService } from './file-handle-storage.service';

const FILE_HEADER_SIZE = 12;
const TEAM_BLOCK_SIZE = 4356;
const FORMATION_OFFSET = 0xB8;

@Injectable({ providedIn: 'root' })
export class TeamsDatService {
  private readonly storageKey = 'teams-dat';

  fileHandle: any = null;
  fileHeaderBytes: Uint8Array | null = null;
  teamDataBytes: Uint8Array | null = null;
  records: TeamsDatRecord[] = [];
  teamOptions: { value: number; label: string }[] = [];
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

    const file = await nextHandle.getFile();
    console.log('[TeamsDat] file picked:', file.name, 'size:', file.size, 'bytes');

    const buffer = await file.arrayBuffer();
    const raw = new Uint8Array(buffer);
    console.log('[TeamsDat] raw buffer length:', raw.byteLength,
      '| first 4 bytes:', raw[0], raw[1], raw[2], raw[3]);

    // 0x78 = zlib magic byte — file is compressed, inflate it first
    const isZlib = raw.length >= 2 && raw[0] === 0x78;
    let payload: Uint8Array;

    if (isZlib) {
      console.log('[TeamsDat] zlib header detected, inflating...');
      payload = new Uint8Array((window as any).pako.inflate(raw));
      console.log('[TeamsDat] inflated size:', payload.byteLength);
    } else {
      console.log('[TeamsDat] no zlib header, reading raw');
      payload = raw;
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

    // Commit only after the file is fully validated and parsed.
    this.fileHandle = nextHandle;
    this.wasZlib = isZlib;
    this.fileHeaderBytes = nextHeaderBytes;
    this.teamDataBytes = nextTeamDataBytes;
    this.records = nextRecords;
    this.teamOptions = nextRecords.map(r => ({
      value: r.index,
      label: r.teamLabel + (r.stadiumName ? ` | ${r.stadiumName}` : '')
    }));
    this.formationIdByTeamId = this.buildFormationIdMap(nextRecords);
    console.log('[TeamsDat] load complete —', nextRecords.length, 'teams.');

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
      this.fileHandle = null;
      this.fileHeaderBytes = null;
      this.teamDataBytes = null;
      this.records = [];
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

  updateRecord(index: number, changes: Partial<Pick<TeamsDatRecord,
    'teamId' | 'leagueId' | 'rivalId' | 'attackOvr' | 'midfieldOvr' | 'defenseOvr' |
    'formationId' | 'captainRole' | 'leftCornerRole' | 'rightCornerRole' | 'penaltyRole' |
    'freeKickRole' | 'region'
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

    if (changes.region !== undefined) {
      const normalizedRegion = changes.region.toUpperCase().padEnd(2, ' ');
      const bytes = this.getTeamDataOrThrow();
      bytes[blockStart + 0xF8] = normalizedRegion.charCodeAt(0);
      bytes[blockStart + 0xF9] = 0x00;
      bytes[blockStart + 0xFA] = normalizedRegion.charCodeAt(1);
      bytes[blockStart + 0xFB] = 0x00;
    }

    const updatedRecord = this.parseRecord(index);
    this.records[index] = updatedRecord;
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
      stadiumName: this.extractUtf16String(safeBytes, blockStart + 0x128, 60)
    };
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

  private formatTeamLabel(teamId: number): string {
    const teamName = TEAM_NAMES_BY_ID[teamId];
    return teamName ? `${teamName} (ID ${teamId})` : `Team ${teamId}`;
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

  private async hasReadPermission(fileHandle: any): Promise<boolean> {
    if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
      return false;
    }

    return (await fileHandle.queryPermission({ mode: 'read' })) === 'granted';
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
