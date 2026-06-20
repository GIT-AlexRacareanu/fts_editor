import { AppComponent } from './app.component';
import { Player } from './models/player.model';
import { TeamRecord } from './models/team-editor.model';

function createComponent(
  playerServiceOverrides: Record<string, any> = {},
  playerImportServiceOverrides: Record<string, any> = {},
  teamEditorServiceOverrides: Record<string, any> = {},
  teamsDatServiceOverrides: Record<string, any> = {},
  xlcEditorServiceOverrides: Record<string, any> = {},
  pakEditorServiceOverrides: Record<string, any> = {},
  fileHandleStorageOverrides: Record<string, any> = {}
): AppComponent {
  const ngZone = {
    run: <T>(callback: () => T) => callback(),
    runOutsideAngular: <T>(callback: () => T) => callback()
  };
  const changeDetectorRef = {
    detectChanges: () => undefined,
    markForCheck: () => undefined
  };
  const playerService = {
    getOvrTuningConfig: () => [],
    readPlayer: () => ({ pos: 11, nat: 0 }),
    getPlayerNameByIndex: () => 'Player',
    findPlayerIndexByName: () => -1,
    parsePlayerId: () => -1,
    formatPlayerId: (value: number) => value.toString(16).toUpperCase().padStart(4, '0'),
    calculateOVR: () => 70,
    binaryData: new Uint8Array(1),
    totalPlayers: 0,
    saveCurrentToSameFile: async () => undefined,
    ...playerServiceOverrides
  };
  const playerImportService = {
    filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
    mapImportedPlayer: () => ({ pos: 11, nat: 0 }),
    ...playerImportServiceOverrides
  };
  const pakEditorService = {
    hasData: true,
    saveToSameFile: async () => undefined,
    ...pakEditorServiceOverrides
  };
  const teamEditorService = {
    hasData: true,
    teamOptions: [],
    getTeam: () => ({ offset: 0, teamId: 0, teamLabel: 'Team 0', playerCount: 0, slots: [] }),
    searchTeams: () => [],
    saveToSameFile: async () => undefined,
    normalizeActiveSlotAttributes: () => 0,
    updateSlot: (_offset: number, _slotIndex: number, _changes: Record<string, any>) => ({ offset: 0, teamId: 0, teamLabel: 'Team 0', playerCount: 0, slots: [] }),
    ...teamEditorServiceOverrides
  };
  const teamsDatService = {
    hasData: true,
    kitStyleOptions: [],
    sponsorTypeOptions: [],
    europeanCompetitionOptions: [],
    stadiumNameMaxLength: 23,
    records: [],
    teamCount: 0,
    updateRecord: () => undefined,
    saveToSameFile: async () => undefined,
    ...teamsDatServiceOverrides
  };
  const xlcEditorService = {
    hasData: false,
    getLocaleValueByKey: () => null,
    entries: [],
    ...xlcEditorServiceOverrides
  };
  const domSanitizer = {
    bypassSecurityTrustUrl: (value: string) => value
  };
  const fileHandleStorage = {
    getFileHandle: async () => null,
    saveFileHandle: async () => undefined,
    deleteFileHandle: async () => undefined,
    deleteStoredValue: async () => undefined,
    ...fileHandleStorageOverrides
  };

  return new AppComponent(
    ngZone as any,
    changeDetectorRef as any,
    playerService as any,
    playerImportService as any,
    pakEditorService as any,
    teamEditorService as any,
    teamsDatService as any,
    xlcEditorService as any,
    domSanitizer as any,
    fileHandleStorage as any
  );
}

describe('AppComponent team role heuristics', () => {
  function createPlayer(overrides: Partial<Player> = {}): Player {
    return {
      name: 'Player',
      pos: 11,
      foot: 0,
      nat: 0,
      estatura: 180,
      peso: 75,
      hiddenFromTransferMarket: 0,
      isIconLegend: 0,
      birthDay: 1,
      birthMonth: 1,
      year: 2000,
      skin: 0,
      skin_tone: 0,
      head_type: 0,
      hair_type: 0,
      hair: 0,
      beard_type: 0,
      boots: 0,
      mangas: 0,
      guantes: 0,
      ACC: 0,
      SPD: 0,
      STA: 0,
      STR: 0,
      TAC: 0,
      CON: 0,
      SHO: 0,
      CRO: 0,
      FK: 0,
      PAS: 0,
      HEA: 0,
      GKS: 0,
      GKH: 0,
      GKP: 0,
      ...overrides
    };
  }

  function createTeam(): TeamRecord {
    return {
      offset: 32,
      teamId: 99,
      teamLabel: 'Test FC',
      playerCount: 12,
      slots: Array.from({ length: 12 }, (_, index) => ({
        index,
        playerId: index,
        playerIdHex: index.toString(16).toUpperCase().padStart(4, '0'),
        tacticalByte: 0,
        isStarter: index < 11,
        isCaptain: false,
        isPenaltyTaker: false,
        isFreeKickTaker: false,
        isLeftCornerTaker: false,
        isRightCornerTaker: false,
        shirtNumber: index + 1,
        position: index === 0 ? 0 : 11,
        isEmpty: false,
        playerName: `Player ${index}`
      }))
    };
  }

  it('derives roles from the first 11 players using ovr, crossing, shooting, free kicks, and preferred foot', () => {
    const team = createTeam();
    const players = new Map<number, Player>([
      [0, createPlayer({ name: 'GK', pos: 0, foot: 0, CRO: 10, SHO: 12, FK: 8 })],
      [1, createPlayer({ name: 'Captain', foot: 0, CRO: 60, SHO: 70, FK: 55 })],
      [2, createPlayer({ name: 'Right Crosser', foot: 0, CRO: 92, SHO: 40, FK: 45 })],
      [3, createPlayer({ name: 'Left Crosser', foot: 1, CRO: 90, SHO: 42, FK: 44 })],
      [4, createPlayer({ name: 'Shooter', foot: 0, CRO: 30, SHO: 96, FK: 65 })],
      [5, createPlayer({ name: 'Free Kicker', foot: 1, CRO: 35, SHO: 65, FK: 97 })],
      [6, createPlayer({ name: 'Mid 6', foot: 0, CRO: 50, SHO: 60, FK: 50 })],
      [7, createPlayer({ name: 'Mid 7', foot: 1, CRO: 55, SHO: 58, FK: 53 })],
      [8, createPlayer({ name: 'Mid 8', foot: 0, CRO: 45, SHO: 57, FK: 52 })],
      [9, createPlayer({ name: 'Mid 9', foot: 1, CRO: 48, SHO: 59, FK: 54 })],
      [10, createPlayer({ name: 'Mid 10', foot: 0, CRO: 49, SHO: 61, FK: 56 })],
      [11, createPlayer({ name: 'Reserve Star', foot: 1, CRO: 99, SHO: 99, FK: 99 })]
    ]);
    const ovrByPlayerId = new Map<number, number>([
      [0, 45],
      [1, 95],
      [2, 75],
      [3, 74],
      [4, 80],
      [5, 79],
      [6, 65],
      [7, 64],
      [8, 63],
      [9, 62],
      [10, 61],
      [11, 100]
    ]);
    const updateRecord = jasmine.createSpy('updateRecord');
    const updateSlot = jasmine.createSpy('updateSlot').and.callFake((offset: number, slotIndex: number, changes: Record<string, any>) => {
      const slot = team.slots[slotIndex];
      Object.assign(slot, {
        isCaptain: changes['captain'],
        isLeftCornerTaker: changes['leftCornerTaker'],
        isRightCornerTaker: changes['rightCornerTaker'],
        isPenaltyTaker: changes['penaltyTaker'],
        isFreeKickTaker: changes['freeKickTaker']
      });
      return team;
    });
    const component = createComponent(
      {
        readPlayer: (playerId: number) => players.get(playerId)!,
        calculateOVR: (player: Player) => {
          const playerId = Array.from(players.entries()).find(([, value]) => value === player)?.[0] ?? -1;
          return ovrByPlayerId.get(playerId) ?? 0;
        }
      },
      {},
      {
        teamOptions: [{ offset: team.offset, label: team.teamLabel }],
        getTeam: () => team,
        updateSlot
      },
      {
        records: [{
          index: 0,
          teamId: team.teamId,
          teamLabel: team.teamLabel,
          leagueId: 0,
          rivalId: 0,
          attackOvr: 0,
          midfieldOvr: 0,
          defenseOvr: 0,
          formationId: 0,
          captainRole: 0xffffffff,
          leftCornerRole: 0xffffffff,
          rightCornerRole: 0xffffffff,
          penaltyRole: 0xffffffff,
          freeKickRole: 0xffffffff,
          region: '',
          stadiumName: '',
          stadiumColor: { byteOffset: 0, fileOffset: 0, hex: '#000000', rawHex: '00000000' },
          pitchType: 0,
          sponsorType: 0,
          kitManufacturer: 0,
          linesUL: 0,
          linesUV: 0,
          linesPL: 0,
          linesPV: 0,
          europeanCompetition: 0,
          kits: []
        }],
        updateRecord
      }
    );

    component.loadSingleTeam(team.offset);

    const record = component.selectedTeamsDatRecord!;

    expect(record.captainRole).toBe(1);
    expect(record.leftCornerRole).toBe(2);
    expect(record.rightCornerRole).toBe(3);
    expect(record.penaltyRole).toBe(4);
    expect(record.freeKickRole).toBe(5);

    const synced = (component as any).syncTeamsDatRolesForTeam(team, true);

    expect(synced).toBeTrue();
    expect(updateRecord).toHaveBeenCalledWith(0, {
      captainRole: 1,
      leftCornerRole: 2,
      rightCornerRole: 3,
      penaltyRole: 4,
      freeKickRole: 5
    });
    expect(updateSlot).toHaveBeenCalled();
    expect(team.slots[1].isCaptain).toBeTrue();
    expect(team.slots[2].isLeftCornerTaker).toBeTrue();
    expect(team.slots[3].isRightCornerTaker).toBeTrue();
    expect(team.slots[4].isPenaltyTaker).toBeTrue();
    expect(team.slots[5].isFreeKickTaker).toBeTrue();
    expect(team.slots[11].isCaptain).toBeFalse();
    expect(team.slots[11].isLeftCornerTaker).toBeFalse();
    expect(team.slots[11].isRightCornerTaker).toBeFalse();
    expect(team.slots[11].isPenaltyTaker).toBeFalse();
    expect(team.slots[11].isFreeKickTaker).toBeFalse();
  });

  it('falls back to the best crosser overall when no starter matches the preferred foot', () => {
    const team = createTeam();
    const players = new Map<number, Player>(team.slots.map((slot) => [slot.playerId, createPlayer({ foot: 0, CRO: slot.index * 5, SHO: 10, FK: 10 })]));
    players.set(7, createPlayer({ foot: 0, CRO: 99, SHO: 10, FK: 10 }));
    const component = createComponent(
      {
        readPlayer: (playerId: number) => players.get(playerId)!,
        calculateOVR: () => 50
      },
      {},
      {
        teamOptions: [{ offset: team.offset, label: team.teamLabel }],
        getTeam: () => team
      },
      {
        records: [{
          index: 0,
          teamId: team.teamId,
          teamLabel: team.teamLabel,
          leagueId: 0,
          rivalId: 0,
          attackOvr: 0,
          midfieldOvr: 0,
          defenseOvr: 0,
          formationId: 0,
          captainRole: 0xffffffff,
          leftCornerRole: 0xffffffff,
          rightCornerRole: 0xffffffff,
          penaltyRole: 0xffffffff,
          freeKickRole: 0xffffffff,
          region: '',
          stadiumName: '',
          stadiumColor: { byteOffset: 0, fileOffset: 0, hex: '#000000', rawHex: '00000000' },
          pitchType: 0,
          sponsorType: 0,
          kitManufacturer: 0,
          linesUL: 0,
          linesUV: 0,
          linesPL: 0,
          linesPV: 0,
          europeanCompetition: 0,
          kits: []
        }]
      }
    );

    component.loadSingleTeam(team.offset);

    expect(component.selectedTeamsDatRecord!.rightCornerRole).toBe(7);
  });
});
