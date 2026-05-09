import { Injectable } from '@angular/core';

import { TEAM_NAMES_BY_ID } from '../data/team-names';
import { TeamOption, TeamRecord, TeamSlot } from '../models/team-editor.model';

declare const pako: any;

const TEAM_STRIDE = 264;
const TEAM_START_OFFSET = 0x10;
const SLOT_COUNT = 32;
const ATTRIBUTES_OFFSET = 8;
const PLAYER_ID_OFFSET = 136;
const EMPTY_PLAYER_ID = 0;

@Injectable({ providedIn: 'root' })
export class TeamEditorService {
  binaryData: Uint8Array | null = null;
  fileHandle: any = null;
  teamOptions: TeamOption[] = [];
  private wasCompressed = false;

  get hasData(): boolean {
    return this.binaryData !== null;
  }

  async loadFile(): Promise<string> {
    if (!(window as any).showOpenFilePicker) {
      throw new Error('Your browser does not support File System Access API. Use Chrome.');
    }

    const handles = await (window as any).showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Team DB Files', accept: { 'application/octet-stream': ['.dat', '.bin'] } }]
    });

    this.fileHandle = handles[0];
    const file = await this.fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    const input = new Uint8Array(buffer);

    this.wasCompressed = this.isCompressed(input);
    this.binaryData = this.wasCompressed ? new Uint8Array(pako.inflate(input)) : input;
    this.scanTeams();

    return file.name;
  }

  async saveToSameFile(): Promise<void> {
    if (!this.fileHandle || !this.binaryData) {
      throw new Error('No team database loaded');
    }

    const writable = await this.fileHandle.createWritable();
    await writable.write(this.getSerializedData());
    await writable.close();
  }

  exportFile(fileName = 'DB_EXPORT.bin'): void {
    if (!this.binaryData) {
      return;
    }

    const blob = new Blob([this.getSerializedData()], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  getTeam(offset: number): TeamRecord {
    if (!this.binaryData) {
      throw new Error('No team database loaded');
    }

    const view = new DataView(this.binaryData.buffer);
    const teamId = view.getUint32(offset, true);
    const playerCount = view.getUint32(offset + 4, true);
    const slots: TeamSlot[] = [];

    for (let index = 0; index < SLOT_COUNT; index++) {
      const attrPtr = offset + ATTRIBUTES_OFFSET + index * 4;
      const idPtr = offset + PLAYER_ID_OFFSET + index * 4;
      const playerId = view.getUint16(idPtr, true);

      slots.push({
        index,
        playerId,
        playerIdHex: this.formatPlayerId(playerId),
        shirtNumber: view.getUint8(attrPtr),
        position: view.getUint8(attrPtr + 1),
        isEmpty: this.isEmptySlot(playerId)
      });
    }

    return {
      offset,
      teamId,
      teamLabel: this.formatTeamLabel(teamId),
      playerCount,
      slots
    };
  }

  searchTeams(query: string): TeamRecord[] {
    if (!this.binaryData) {
      return [];
    }

    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery) {
      return [];
    }

    return this.teamOptions
      .filter(({ offset }) => this.teamContainsPlayerId(offset, normalizedQuery))
      .map(({ offset }) => this.getTeam(offset));
  }

  updatePlayerCount(offset: number, playerCount: number): TeamRecord {
    const view = this.getView();
    view.setUint32(offset + 4, this.clamp(playerCount, 0, 0xffffffff), true);
    return this.getTeam(offset);
  }

  updateSlot(
    offset: number,
    slotIndex: number,
    changes: { playerIdHex?: string; shirtNumber?: number; position?: number },
    nextPlayerCount?: number
  ): TeamRecord {
    const view = this.getView();
    const attrPtr = offset + ATTRIBUTES_OFFSET + slotIndex * 4;
    const idPtr = offset + PLAYER_ID_OFFSET + slotIndex * 4;

    if (changes.playerIdHex !== undefined) {
      const parsed = Number.parseInt(changes.playerIdHex.trim(), 16);
      if (!Number.isNaN(parsed)) {
        view.setUint16(idPtr, this.clamp(parsed, 0, 0xffff), true);
      }
    }

    if (changes.shirtNumber !== undefined) {
      view.setUint8(attrPtr, this.clamp(changes.shirtNumber, 0, 0xff));
    }

    if (changes.position !== undefined) {
      view.setUint8(attrPtr + 1, this.clamp(changes.position, 0, 0xff));
    }

    if (nextPlayerCount !== undefined) {
      view.setUint32(offset + 4, nextPlayerCount, true);
    }

    return this.getTeam(offset);
  }

  addSlot(offset: number): TeamRecord | null {
    const team = this.getTeam(offset);
    const insertSlot = this.findInsertSlot(team);

    if (!insertSlot) {
      return null;
    }

    return this.updateSlot(offset, insertSlot.index, {
      playerIdHex: this.formatPlayerId(EMPTY_PLAYER_ID),
      shirtNumber: 0,
      position: 0
    }, Math.min(team.playerCount + 1, SLOT_COUNT));
  }

  deleteSlot(offset: number, slotIndex: number): TeamRecord {
    const team = this.getTeam(offset);

    return this.updateSlot(offset, slotIndex, {
      playerIdHex: this.formatPlayerId(EMPTY_PLAYER_ID),
      shirtNumber: 0,
      position: 0
    }, Math.max(team.playerCount - 1, 0));
  }

  private scanTeams(): void {
    if (!this.binaryData) {
      this.teamOptions = [];
      return;
    }

    const view = new DataView(this.binaryData.buffer);
    const options: TeamOption[] = [];

    for (let offset = TEAM_START_OFFSET; offset < this.binaryData.byteLength - TEAM_STRIDE; offset += TEAM_STRIDE) {
      const teamId = view.getUint32(offset, true);
      options.push({
        offset,
        label: this.formatTeamLabel(teamId)
      });
    }

    this.teamOptions = options;
  }

  private teamContainsPlayerId(offset: number, query: string): boolean {
    const view = this.getView();

    for (let index = 0; index < SLOT_COUNT; index++) {
      const playerId = view.getUint16(offset + PLAYER_ID_OFFSET + index * 4, true);
      if (this.isEmptySlot(playerId)) {
        continue;
      }

      if (this.formatPlayerId(playerId).includes(query)) {
        return true;
      }
    }

    return false;
  }

  private formatPlayerId(playerId: number): string {
    return playerId.toString(16).toUpperCase().padStart(4, '0');
  }

  private findInsertSlot(team: TeamRecord): TeamSlot | undefined {
    const preferredSlot = team.playerCount < SLOT_COUNT ? team.slots[team.playerCount] : undefined;
    if (preferredSlot?.isEmpty) {
      return preferredSlot;
    }

    return team.slots.find((slot) => slot.isEmpty);
  }

  private isEmptySlot(playerId: number): boolean {
    return playerId === EMPTY_PLAYER_ID;
  }

  private formatTeamLabel(teamId: number): string {
    if (teamId === 0xffffffff) {
      return 'Empty Team';
    }

    const teamName = TEAM_NAMES_BY_ID[teamId];
    return teamName ? `${teamName} (ID ${teamId})` : `Team ${teamId}`;
  }

  private getView(): DataView {
    if (!this.binaryData) {
      throw new Error('No team database loaded');
    }

    return new DataView(this.binaryData.buffer);
  }

  private isCompressed(data: Uint8Array): boolean {
    return data.length > 1 && data[0] === 0x78;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private getSerializedData(): ArrayBuffer {
    if (!this.binaryData) {
      throw new Error('No team database loaded');
    }

    const payload = this.wasCompressed ? pako.deflate(this.binaryData) : this.binaryData;
    const bytes = new Uint8Array(payload.byteLength);
    bytes.set(payload);
    return bytes.buffer;
  }

}