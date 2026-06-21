import { AppComponent } from './app.component';
import { ImportedPlayerRecord, PlayerImportService } from './services/player-import.service';

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
    readPlayer: (index: number) => ({ name: index < 18 ? `dummy${index + 1}` : `Player ${index}`, pos: 11, nat: 0 }),
    findPlayerIndexByName: () => -1,
    parsePlayerId: () => -1,
    formatPlayerId: (index: number) => index.toString(16).toUpperCase().padStart(4, '0'),
    calculateOVR: (player: { ovr?: number }) => player.ovr ?? 0,
    totalPlayers: 64,
    binaryData: new Uint8Array(1),
    ...playerServiceOverrides
  };
  const playerImportService = {
    filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
    mapImportedPlayer: (player: { clubPosition: string; overall: number }) => ({
      pos: player.clubPosition === 'GK' ? 0 : player.clubPosition === 'LM' ? 17 : player.clubPosition === 'RM' ? 16 : 19,
      nat: 0,
      ovr: player.overall
    }),
    ...playerImportServiceOverrides
  };
  const pakEditorService = {
    hasData: false,
    ...pakEditorServiceOverrides
  };
  const teamEditorService = {
    hasData: true,
    teamOptions: [{ offset: 16, label: 'Test FC' }],
    getTeam: () => ({ offset: 16, teamId: 99, teamLabel: 'Test FC', playerCount: 0, slots: [] }),
    searchTeams: () => [],
    clearTeam: () => undefined,
    addPlayer: () => undefined,
    ...teamEditorServiceOverrides
  };
  const teamsDatService = {
    hasData: true,
    getFormationIdByTeamId: () => 0,
    records: [],
    ...teamsDatServiceOverrides
  };
  const xlcEditorService = {
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

describe('team import jersey numbers', () => {
  function createImportedPlayer(overrides: Partial<ImportedPlayerRecord> = {}): ImportedPlayerRecord {
    return {
      shortName: 'Test Player',
      lastName: '',
      overall: 70,
      age: 24,
      heightCm: 180,
      weightKg: 75,
      clubPosition: 'CM',
      nationalityName: 'Portugal',
      preferredFoot: 'Right',
      teamName: 'Arsenal',
      nationalTeamName: '',
      loanedToTeamName: '',
      shooting: 60,
      passing: 65,
      dribbling: 68,
      physical: 66,
      attackingCrossing: 55,
      attackingHeadingAccuracy: 52,
      skillFkAccuracy: 58,
      movementAcceleration: 70,
      movementSprintSpeed: 72,
      powerStamina: 74,
      powerStrength: 66,
      defendingStandingTackle: 50,
      defendingSlidingTackle: 48,
      goalkeepingDiving: 10,
      goalkeepingHandling: 9,
      goalkeepingPositioning: 11,
      goalkeepingReflexes: 8,
      jumping: 64,
      finishing: 60,
      shotPower: 65,
      longShots: 62,
      volleys: 55,
      penalties: 58,
      curve: 62,
      agility: 69,
      balance: 67,
      ballControl: 71,
      shortPassing: 66,
      longPassing: 64,
      vision: 63,
      interceptions: 49,
      defAwareness: 47,
      defending: 50,
      ...overrides
    };
  }

  it('parses jersey numbers from csv rows when present', () => {
    const service = new PlayerImportService();
    const csv = [
      'knownas,club,overallrating,age,height,weight,position_1,preferredfoot,jersey_number',
      'Erling Haaland,Manchester City,91,24,195,94,25,Left,9'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(1);
    expect(parsed[0].jerseyNumber).toBe(9);
  });

  it('parses jersey numbers from the import_2 csv header style', () => {
    const service = new PlayerImportService();
    const csv = [
      'knownas,club,overallrating,age,height,weight,position_1,preferredfoot,jerseynumber',
      'Erling Haaland,Manchester City,91,24,195,94,25,Left,9'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(1);
    expect(parsed[0].jerseyNumber).toBe(9);
  });

  it('uses the imported csv jersey number when linking a team roster', async () => {
    const addPlayer = jasmine.createSpy('addPlayer');
    const clearTeam = jasmine.createSpy('clearTeam');
    const playerIdByName: Record<string, number> = {
      'Top Keeper': 18,
      'Top Striker': 19
    };
    const component = createComponent(
      {
        findPlayerIndexByName: (name: string) => playerIdByName[name] ?? -1
      },
      {},
      {
        clearTeam,
        addPlayer
      }
    );
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(component, 'loadSingleTeam').and.stub();
    spyOn<any>(component, 'refreshDbBrowsePlayers').and.stub();

    component.selectedTeamOffset = 16;
    component.teamImportCsvTeam = 'Arsenal';
    component.importedPlayers = [
      createImportedPlayer({ sourceRowIndex: 0, shortName: 'Top Keeper', clubPosition: 'GK', overall: 88, jerseyNumber: 1 }),
      createImportedPlayer({ sourceRowIndex: 1, shortName: 'Top Striker', clubPosition: 'ST', overall: 94, jerseyNumber: 9 })
    ];

    await component.importTeamFromCsv();

    expect(clearTeam).toHaveBeenCalledOnceWith(16);
    expect(addPlayer).toHaveBeenCalledWith(16, 18, 0, 1);
    expect(addPlayer).toHaveBeenCalledWith(16, 19, 17, 9);
  });
});
