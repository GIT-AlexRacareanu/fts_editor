import { AppComponent } from './app.component';

function createComponent(
  playerServiceOverrides: Record<string, any> = {},
  playerImportServiceOverrides: Record<string, any> = {},
  teamEditorServiceOverrides: Record<string, any> = {},
  teamsDatServiceOverrides: Record<string, any> = {},
  xlcEditorServiceOverrides: Record<string, any> = {},
  pakEditorServiceOverrides: Record<string, any> = {}
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
    formatPlayerId: () => '0001',
    calculateOVR: () => 70,
    binaryData: null,
    totalPlayers: 0,
    ...playerServiceOverrides
  };
  const playerImportService = {
    filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
    mapImportedPlayer: () => ({ pos: 11, nat: 0 }),
    ...playerImportServiceOverrides
  };
  const pakEditorService = {
    hasData: false,
    ...pakEditorServiceOverrides
  };
  const teamEditorService = {
    hasData: false,
    teamOptions: [],
    getTeam: () => ({ offset: 0, teamId: 0, teamLabel: 'Team 0', playerCount: 0, slots: [] }),
    searchTeams: () => [],
    ...teamEditorServiceOverrides
  };
  const teamsDatService = {
    hasData: false,
    teamCount: 0,
    kitStyleOptions: [],
    sponsorTypeOptions: [],
    europeanCompetitionOptions: [],
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
    deleteFileHandle: async () => undefined
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

describe('AppComponent Team Browser caching', () => {
  it('reuses cached browse rows across repeated getter reads', () => {
    const records = [
      {
        index: 0,
        teamId: 100,
        leagueId: 1,
        rivalId: 200,
        stadiumName: 'Alpha Stadium',
        europeanCompetition: 0,
        attackOvr: 70,
        midfieldOvr: 72,
        defenseOvr: 74
      },
      {
        index: 1,
        teamId: 101,
        leagueId: 2,
        rivalId: 201,
        stadiumName: 'Beta Stadium',
        europeanCompetition: 1,
        attackOvr: 80,
        midfieldOvr: 81,
        defenseOvr: 82
      }
    ];
    const component = createComponent({}, {}, {}, { hasData: true, teamCount: records.length, records } as any);
    const labelSpy = spyOn<any>(component, 'getTeamLongDisplayLabel').and.callFake((teamId: number) => `Team ${teamId}`);

    (component as any).rebuildTeamBrowseItems();

    const firstRead = component.filteredTeamBrowseItems;
    const secondRead = component.filteredTeamBrowseItems;
    const pageRead = component.pagedTeamBrowseItems;

    expect(labelSpy.calls.count()).toBe(records.length);
    expect(firstRead).toBe(secondRead);
    expect(pageRead.length).toBe(records.length);
    expect(firstRead.map((team) => team.teamId)).toEqual([101, 100]);
  });
});