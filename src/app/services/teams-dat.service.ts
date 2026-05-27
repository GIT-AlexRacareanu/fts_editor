import { Injectable } from '@angular/core';

import { TEAM_NAMES_BY_ID } from '../data/team-names';
import { TeamsDatRecord } from '../models/teams-dat.model';
import { FileHandleStorageService } from './file-handle-storage.service';

declare const pako: any;

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
  private wasCompressed = false;

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
    const buffer = await file.arrayBuffer();
    const input = new Uint8Array(buffer);

    this.fileHandle = nextHandle;
    this.wasCompressed = this.isCompressed(input);

    const inflated = this.wasCompressed ? new Uint8Array(pako.inflate(input)) : input;

    if (inflated.byteLength < FILE_HEADER_SIZE) {
      throw new Error('Invalid teams.dat format. File is smaller than header size.');
    }

    this.fileHeaderBytes = inflated.slice(0, FILE_HEADER_SIZE);
    this.teamDataBytes = inflated.slice(FILE_HEADER_SIZE);
    this.records = this.scanRecords();

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
    const record = this.records.find((item) => item.teamId === teamId);
    return record ? record.formationId : null;
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

  private scanRecords(): TeamsDatRecord[] {
    const bytes = this.getTeamDataOrThrow();
    const totalTeams = Math.floor(bytes.byteLength / TEAM_BLOCK_SIZE);

    return Array.from({ length: totalTeams }, (_, index) => this.parseRecord(index));
  }

  private parseRecord(index: number): TeamsDatRecord {
    const view = this.getView();
    const bytes = this.getTeamDataOrThrow();
    const blockStart = this.getBlockStart(index);

    const teamId = view.getUint32(blockStart + 0x00, true);

    return {
      index,
      blockStart,
      teamId,
      teamLabel: this.formatTeamLabel(teamId),
      leagueId: view.getUint32(blockStart + 0x04, true),
      rivalId: view.getUint32(blockStart + 0x08, true),
      attackOvr: view.getUint32(blockStart + 0x0C, true),
      midfieldOvr: view.getUint32(blockStart + 0x10, true),
      defenseOvr: view.getUint32(blockStart + 0x14, true),
      formationId: view.getUint32(blockStart + FORMATION_OFFSET, true),
      captainRole: view.getUint32(blockStart + 0xCC, true),
      leftCornerRole: view.getUint32(blockStart + 0xD0, true),
      rightCornerRole: view.getUint32(blockStart + 0xD4, true),
      penaltyRole: view.getUint32(blockStart + 0xD8, true),
      freeKickRole: view.getUint32(blockStart + 0xDC, true),
      region: this.extractUtf16String(bytes, blockStart + 0xF8, 4),
      stadiumName: this.extractUtf16String(bytes, blockStart + 0x128, 60)
    };
  }

  private getBlockStart(index: number): number {
    return index * TEAM_BLOCK_SIZE;
  }

  private getView(): DataView {
    return new DataView(this.getTeamDataOrThrow().buffer);
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

  private isCompressed(data: Uint8Array): boolean {
    return data.length > 1 && data[0] === 0x78;
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

    const payload = this.wasCompressed ? pako.deflate(merged) : merged;
    const bytes = new Uint8Array(payload.byteLength);
    bytes.set(payload);

    return bytes.buffer;
  }
}
