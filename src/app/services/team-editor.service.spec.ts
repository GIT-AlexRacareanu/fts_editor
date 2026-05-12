/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';

import { TeamEditorService } from './team-editor.service';

const TEAM_START_OFFSET = 0x10;
const TEAM_STRIDE = 264;
const PLAYER_ID_OFFSET = 136;

describe('TeamEditorService', () => {
  let service: TeamEditorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TeamEditorService);
  });

  it('reuses an empty slot inside playerCount before appending a new slot', () => {
    const offset = seedTeamBinary(service, {
      playerCount: 3,
      playerIds: [0x0010, 0x0000, 0x0020]
    });

    const updatedTeam = service.addSlot(offset);

    expect(updatedTeam).not.toBeNull();
    expect(updatedTeam?.playerCount).toBe(3);
    expect(updatedTeam?.slots[1].isEmpty).toBeTrue();
  });

  it('appends at playerCount when the counted slots are already occupied', () => {
    const offset = seedTeamBinary(service, {
      playerCount: 2,
      playerIds: [0x0010, 0x0020, 0x0000]
    });

    const updatedTeam = service.addSlot(offset);

    expect(updatedTeam).not.toBeNull();
    expect(updatedTeam?.playerCount).toBe(3);
    expect(updatedTeam?.slots[2].isEmpty).toBeTrue();
  });

  it('treats FFFF placeholders as empty slots when adding a player', () => {
    const offset = seedTeamBinary(service, {
      playerCount: 32,
      playerIds: [0x0010, 0xffff, 0x0020]
    });

    const updatedTeam = service.addSlot(offset);

    expect(updatedTeam).not.toBeNull();
    expect(updatedTeam?.playerCount).toBe(32);
    expect(updatedTeam?.slots[1].isEmpty).toBeTrue();
  });

  it('adds a chosen player into the next available slot with the provided position', () => {
    const offset = seedTeamBinary(service, {
      playerCount: 2,
      playerIds: [0x0010, 0x0000, 0x0000]
    });

    const updatedTeam = service.addPlayer(offset, 0x0033, 13);

    expect(updatedTeam).not.toBeNull();
    expect(updatedTeam?.playerCount).toBe(2);
    expect(updatedTeam?.slots[1].playerId).toBe(0x0033);
    expect(updatedTeam?.slots[1].position).toBe(13);
    expect(updatedTeam?.slots[1].isEmpty).toBeFalse();
  });
});

function seedTeamBinary(
  service: TeamEditorService,
  config: { playerCount: number; playerIds: number[] }
): number {
  const binaryData = new Uint8Array(TEAM_START_OFFSET + TEAM_STRIDE);
  const view = new DataView(binaryData.buffer);
  const offset = TEAM_START_OFFSET;

  view.setUint32(offset, 1, true);
  view.setUint32(offset + 4, config.playerCount, true);

  config.playerIds.forEach((playerId, index) => {
    view.setUint16(offset + PLAYER_ID_OFFSET + index * 4, playerId, true);
  });

  service.binaryData = binaryData;

  return offset;
}