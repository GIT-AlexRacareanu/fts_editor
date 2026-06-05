import { Injectable } from '@angular/core';

import { TEAM_NAMES_BY_ID } from '../data/team-names';
import { TeamOption, TeamRecord, TeamSlot } from '../models/team-editor.model';
import { FileHandleStorageService } from './file-handle-storage.service';

declare const pako: any;

const TEAM_STRIDE = 264;
const TEAM_START_OFFSET = 0x10;
const SLOT_COUNT = 32;
const ATTRIBUTES_OFFSET = 8;
const PLAYER_ID_OFFSET = 136;
const EMPTY_PLAYER_ID = 0;
const UNUSED_PLAYER_ID = 0xffff;
const MAX_POSITION_VALUE = 22;
const STARTER_SLOT_COUNT = 11;

export interface TeamPlayerReferenceIssue {
  teamOffset: number;
  teamLabel: string;
  slotIndex: number;
  playerId: number;
  playerIdHex: string;
}

@Injectable({ providedIn: 'root' })
export class TeamEditorService {
  private readonly storageKey = 'team-db';

  binaryData: Uint8Array | null = null;
  fileHandle: any = null;
  teamOptions: TeamOption[] = [];
  private wasCompressed = false;

  constructor(private readonly fileHandleStorage: FileHandleStorageService) {}

  get hasData(): boolean {
    return this.binaryData !== null;
  }

  async loadFile(fileHandle?: any): Promise<string> {
    if (!(window as any).showOpenFilePicker) {
      throw new Error('Your browser does not support File System Access API. Use Chrome.');
    }

    let nextHandle = fileHandle;

    if (!nextHandle) {
      const handles = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [{ description: 'Team DB Files', accept: { 'application/octet-stream': ['.dat', '.bin'] } }]
      });

      nextHandle = handles[0];
    }

    const file = await nextHandle.getFile();
    const buffer = await file.arrayBuffer();
    const input = new Uint8Array(buffer);

    this.fileHandle = nextHandle;
    this.wasCompressed = this.isCompressed(input);
    this.binaryData = this.wasCompressed ? new Uint8Array(pako.inflate(input)) : input;
    this.scanTeams();

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
      this.teamOptions = [];
      await this.fileHandleStorage.deleteFileHandle(this.storageKey);
      return null;
    }
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

  exportUncompressedFile(fileName = 'TEAMPLAYERLINKS_0_uncompressed.dat'): void {
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

  getPlayerClubMap(): Map<number, string[]> {
    const playerClubMap = new Map<number, Set<string>>();

    if (!this.binaryData) {
      return new Map<number, string[]>();
    }

    this.teamOptions.forEach(({ offset }) => {
      const team = this.getTeam(offset);

      team.slots.forEach((slot) => {
        if (slot.isEmpty) {
          return;
        }

        if (!playerClubMap.has(slot.playerId)) {
          playerClubMap.set(slot.playerId, new Set<string>());
        }

        playerClubMap.get(slot.playerId)?.add(team.teamLabel);
      });
    });

    return new Map<number, string[]>(
      Array.from(playerClubMap.entries()).map(([playerId, clubs]) => [playerId, Array.from(clubs)])
    );
  }

  validatePlayerReferences(maxPlayerCount: number): TeamPlayerReferenceIssue[] {
    if (!this.binaryData) {
      return [];
    }

    const normalizedMaxPlayerCount = Number.isFinite(maxPlayerCount)
      ? this.clamp(Math.trunc(maxPlayerCount), 0, 0xffff)
      : 0;

    const issues: TeamPlayerReferenceIssue[] = [];

    this.teamOptions.forEach(({ offset }) => {
      const team = this.getTeam(offset);
      const activeSlotCount = this.clamp(Math.trunc(team.playerCount), 0, SLOT_COUNT);

      for (let slotIndex = 0; slotIndex < activeSlotCount; slotIndex += 1) {
        const slot = team.slots[slotIndex];

        if (!slot || slot.isEmpty) {
          continue;
        }

        if (slot.playerId >= normalizedMaxPlayerCount) {
          issues.push({
            teamOffset: team.offset,
            teamLabel: team.teamLabel,
            slotIndex,
            playerId: slot.playerId,
            playerIdHex: slot.playerIdHex
          });
        }
      }
    });

    return issues;
  }

  updatePlayerCount(offset: number, playerCount: number): TeamRecord {
    const view = this.getView();
    const team = this.getTeam(offset);
    const previousPlayerCount = this.clamp(Math.trunc(team.playerCount), 0, SLOT_COUNT);
    const normalizedPlayerCount = Number.isFinite(playerCount)
      ? Math.trunc(playerCount)
      : 0;
    const nextPlayerCount = this.clamp(normalizedPlayerCount, 0, SLOT_COUNT);

    if (nextPlayerCount < previousPlayerCount) {
      for (let index = nextPlayerCount; index < previousPlayerCount; index++) {
        const attrPtr = offset + ATTRIBUTES_OFFSET + index * 4;
        const idPtr = offset + PLAYER_ID_OFFSET + index * 4;
        view.setUint32(attrPtr, 0, true);
        view.setUint16(idPtr, UNUSED_PLAYER_ID, true);
        view.setUint16(idPtr + 2, UNUSED_PLAYER_ID, true);
      }
    }

    if (nextPlayerCount > previousPlayerCount) {
      for (let index = previousPlayerCount; index < nextPlayerCount; index++) {
        const idPtr = offset + PLAYER_ID_OFFSET + index * 4;
        const currentPlayerId = view.getUint16(idPtr, true);

        if (currentPlayerId === UNUSED_PLAYER_ID) {
          view.setUint16(idPtr, EMPTY_PLAYER_ID, true);
        }

        view.setUint16(idPtr + 2, view.getUint16(idPtr, true) === UNUSED_PLAYER_ID ? UNUSED_PLAYER_ID : 0, true);
      }
    }

    view.setUint32(offset + 4, nextPlayerCount, true);
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
        const nextPlayerId = this.clamp(parsed, 0, 0xffff);
        view.setUint16(idPtr, nextPlayerId, true);
        view.setUint16(idPtr + 2, nextPlayerId === UNUSED_PLAYER_ID ? UNUSED_PLAYER_ID : 0, true);
      }
    }

    if (changes.shirtNumber !== undefined) {
      view.setUint8(attrPtr, this.clamp(changes.shirtNumber, 0, 0xff));
    }

    if (changes.position !== undefined) {
      view.setUint8(attrPtr + 1, this.clamp(changes.position, 0, MAX_POSITION_VALUE));
    }

    if (nextPlayerCount !== undefined) {
      view.setUint32(offset + 4, this.clamp(Math.trunc(nextPlayerCount), 0, SLOT_COUNT), true);
    }

    return this.getTeam(offset);
  }

  addSlot(offset: number): TeamRecord | null {
    const team = this.getTeam(offset);
    const insertSlot = this.findInsertSlot(team);

    if (!insertSlot) {
      return null;
    }

    const nextPlayerCount = insertSlot.index < team.playerCount
      ? team.playerCount
      : Math.min(team.playerCount + 1, SLOT_COUNT);

    return this.updateSlot(offset, insertSlot.index, {
      playerIdHex: this.formatPlayerId(EMPTY_PLAYER_ID),
      shirtNumber: 0,
      position: 0
    }, nextPlayerCount);
  }

  addPlayer(offset: number, playerId: number, position: number): TeamRecord | null {
    const team = this.getTeam(offset);
    const insertSlot = this.findInsertSlot(team);

    if (!insertSlot) {
      return null;
    }

    const nextPlayerCount = insertSlot.index < team.playerCount
      ? team.playerCount
      : Math.min(team.playerCount + 1, SLOT_COUNT);

    return this.updateSlot(offset, insertSlot.index, {
      playerIdHex: this.formatPlayerId(playerId),
      shirtNumber: 0,
      position
    }, nextPlayerCount);
  }

  deleteSlot(offset: number, slotIndex: number): TeamRecord {
    const team = this.getTeam(offset);
    const normalizedPlayerCount = this.clamp(Math.trunc(team.playerCount), 0, SLOT_COUNT);
    const isCountedSlot = slotIndex >= 0 && slotIndex < normalizedPlayerCount;
    const slot = team.slots[slotIndex];

    if (!isCountedSlot || !slot || slot.isEmpty) {
      return team;
    }

    const view = this.getView();
    const activeLastIndex = normalizedPlayerCount - 1;

    for (let index = slotIndex; index < activeLastIndex; index++) {
      const sourceAttrPtr = offset + ATTRIBUTES_OFFSET + (index + 1) * 4;
      const sourceIdPtr = offset + PLAYER_ID_OFFSET + (index + 1) * 4;
      const targetAttrPtr = offset + ATTRIBUTES_OFFSET + index * 4;
      const targetIdPtr = offset + PLAYER_ID_OFFSET + index * 4;

      view.setUint32(targetAttrPtr, view.getUint32(sourceAttrPtr, true), true);
      view.setUint16(targetIdPtr, view.getUint16(sourceIdPtr, true), true);
      view.setUint16(targetIdPtr + 2, view.getUint16(sourceIdPtr + 2, true), true);
    }

    const clearAttrPtr = offset + ATTRIBUTES_OFFSET + activeLastIndex * 4;
    const clearIdPtr = offset + PLAYER_ID_OFFSET + activeLastIndex * 4;
    view.setUint32(clearAttrPtr, 0, true);
    view.setUint16(clearIdPtr, UNUSED_PLAYER_ID, true);
    view.setUint16(clearIdPtr + 2, UNUSED_PLAYER_ID, true);
    view.setUint32(offset + 4, activeLastIndex, true);

    return this.getTeam(offset);
  }

  clearAllTeams(starterPositionsByTeamId?: ReadonlyMap<number, readonly number[]>): void {
    const view = this.getView();
    const ACTIVE_SLOTS = 18;

    this.teamOptions.forEach(({ offset }) => {
      const teamId = view.getUint32(offset, true);
      const starterPositions = starterPositionsByTeamId?.get(teamId) ?? [];
      view.setUint32(offset + 4, ACTIVE_SLOTS, true);

      for (let index = 0; index < SLOT_COUNT; index++) {
        const attrPtr = offset + ATTRIBUTES_OFFSET + index * 4;
        const idPtr = offset + PLAYER_ID_OFFSET + index * 4;

        if (index < ACTIVE_SLOTS) {
          view.setUint16(idPtr, index, true);
          view.setUint16(idPtr + 2, 0, true);
        } else {
          view.setUint16(idPtr, UNUSED_PLAYER_ID, true);
          view.setUint16(idPtr + 2, UNUSED_PLAYER_ID, true);
        }

        const cleanPosition = index < 11
          ? (starterPositions[index] ?? 0)
          : (index === 11
            ? 0
            : (index < ACTIVE_SLOTS ? starterPositions[index - 10] ?? 0 : 0));
        const starterFlag = index < 11 ? 1 : 0;

        view.setUint8(attrPtr, 0);
        view.setUint8(attrPtr + 1, this.clamp(cleanPosition, 0, MAX_POSITION_VALUE));
        view.setUint8(attrPtr + 2, starterFlag);
        view.setUint8(attrPtr + 3, 0);
      }
    });
  }

  reorderUsedPlayers(offset: number, orderedSlotIndexes: number[], starterPositions: number[]): TeamRecord {
    const team = this.getTeam(offset);
    const usedIndexes = team.slots
      .slice(0, this.clamp(Math.trunc(team.playerCount), 0, SLOT_COUNT))
      .filter((slot) => !slot.isEmpty)
      .map((slot) => slot.index);

    if (usedIndexes.length !== orderedSlotIndexes.length) {
      return team;
    }

    const orderedSlots = orderedSlotIndexes
      .map((slotIndex) => team.slots[slotIndex])
      .filter((slot): slot is TeamSlot => Boolean(slot));

    if (orderedSlots.length !== usedIndexes.length) {
      return team;
    }

    const view = this.getView();

    usedIndexes.forEach((targetSlotIndex, orderIndex) => {
      const sourceSlot = orderedSlots[orderIndex];
      const attrPtr = offset + ATTRIBUTES_OFFSET + targetSlotIndex * 4;
      const idPtr = offset + PLAYER_ID_OFFSET + targetSlotIndex * 4;
      view.setUint8(attrPtr, sourceSlot.shirtNumber);
      view.setUint8(attrPtr + 1, this.clamp(starterPositions[orderIndex] ?? sourceSlot.position, 0, MAX_POSITION_VALUE));
      view.setUint8(attrPtr + 2, orderIndex < STARTER_SLOT_COUNT ? 1 : 0);
      view.setUint8(attrPtr + 3, 0);
      view.setUint16(idPtr, sourceSlot.playerId, true);
      view.setUint16(idPtr + 2, sourceSlot.playerId === UNUSED_PLAYER_ID ? UNUSED_PLAYER_ID : 0, true);
    });

    return this.getTeam(offset);
  }

  normalizeActiveSlotAttributes(): number {
    if (!this.binaryData) {
      return 0;
    }

    const view = this.getView();
    let updatedSlots = 0;

    this.teamOptions.forEach(({ offset }) => {
      const playerCount = this.clamp(view.getUint32(offset + 4, true), 0, SLOT_COUNT);

      for (let slotIndex = 0; slotIndex < playerCount; slotIndex += 1) {
        const attrPtr = offset + ATTRIBUTES_OFFSET + slotIndex * 4;
        const idPtr = offset + PLAYER_ID_OFFSET + slotIndex * 4;
        const playerId = view.getUint16(idPtr, true);

        if (this.isEmptySlot(playerId)) {
          continue;
        }

        const currentPosition = view.getUint8(attrPtr + 1);
        const normalizedPosition = this.clamp(currentPosition, 0, MAX_POSITION_VALUE);
        const currentStarterFlag = view.getUint8(attrPtr + 2);
        const normalizedStarterFlag = slotIndex < STARTER_SLOT_COUNT ? 1 : 0;
        const currentPadding = view.getUint8(attrPtr + 3);
        const currentPlayerPad = view.getUint16(idPtr + 2, true);
        const normalizedPlayerPad = playerId === UNUSED_PLAYER_ID ? UNUSED_PLAYER_ID : 0;

        if (
          normalizedPosition !== currentPosition
          || normalizedStarterFlag !== currentStarterFlag
          || currentPadding !== 0
          || currentPlayerPad !== normalizedPlayerPad
        ) {
          view.setUint8(attrPtr + 1, normalizedPosition);
          view.setUint8(attrPtr + 2, normalizedStarterFlag);
          view.setUint8(attrPtr + 3, 0);
          view.setUint16(idPtr + 2, normalizedPlayerPad, true);
          updatedSlots += 1;
        }
      }
    });

    return updatedSlots;
  }

  private scanTeams(): void {
    if (!this.binaryData) {
      this.teamOptions = [];
      return;
    }

    const view = new DataView(this.binaryData.buffer);
    const options: TeamOption[] = [];

    const lastTeamOffset = this.binaryData.byteLength - TEAM_STRIDE;

    for (let offset = TEAM_START_OFFSET; offset <= lastTeamOffset; offset += TEAM_STRIDE) {
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
    const countedEmptySlot = team.slots
      .slice(0, Math.min(team.playerCount, SLOT_COUNT))
      .find((slot) => slot.isEmpty);

    if (countedEmptySlot) {
      return countedEmptySlot;
    }

    const preferredSlot = team.playerCount < SLOT_COUNT ? team.slots[team.playerCount] : undefined;
    if (preferredSlot?.isEmpty) {
      return preferredSlot;
    }

    return team.slots.find((slot) => slot.isEmpty);
  }

  private isEmptySlot(playerId: number): boolean {
    return playerId === EMPTY_PLAYER_ID || playerId === UNUSED_PLAYER_ID;
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

  private async hasReadPermission(fileHandle: any): Promise<boolean> {
    if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
      return false;
    }

    return (await fileHandle.queryPermission({ mode: 'read' })) === 'granted';
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