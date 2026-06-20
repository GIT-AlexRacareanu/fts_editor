/// <reference types="jasmine" />

import { TeamEditorService } from './team-editor.service';

const TEAM_START_OFFSET = 0x10;
const TEAM_STRIDE = 264;
const PLAYER_ID_OFFSET = 136;

describe('TeamEditorService addPlayer shirt numbers', () => {
  let service: TeamEditorService;

  beforeEach(() => {
    service = new TeamEditorService({} as any);
  });

  it('stores the provided shirt number when adding a player', () => {
    const offset = seedTeamBinary(service, {
      playerCount: 1,
      playerIds: [0x0010, 0x0000]
    });

    const updatedTeam = service.addPlayer(offset, 0x0033, 13, 27);

    expect(updatedTeam).not.toBeNull();
    expect(updatedTeam?.slots[1].playerId).toBe(0x0033);
    expect(updatedTeam?.slots[1].shirtNumber).toBe(27);
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
