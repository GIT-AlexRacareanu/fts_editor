import { AppComponent } from './app.component';

describe('AppComponent team name resolution', () => {
  it('builds unique direct key candidates only for the exact team id', () => {
    const component = createComponent();

    const longCandidates = (component as any).getTeamNameKeyCandidates('long', 503) as string[];

    expect(longCandidates).toEqual([
      'TXT_TEAMNAMELONG_503',
      'TXT_TEAMNAME_503',
      'TXT_CLUBNAMELONG_503',
      'TXT_CLUBNAME_503',
      'TXT_TEAM_503_NAME',
      'TXT_TEAM_503_LONGNAME',
      'TXT_TEAM_503_NAMELONG',
      'TXT_CLUB_503_NAME',
      'TXT_CLUB_503_LONGNAME',
      'TXT_CLUB_503_NAMELONG',
      'TXT_TEAM_NAME_503',
      'TXT_TEAM_LONGNAME_503',
      'TXT_TEAM_NAMELONG_503',
      'TXT_CLUB_NAME_503',
      'TXT_CLUB_LONGNAME_503',
      'TXT_CLUB_NAMELONG_503'
    ]);
  });

  it('prefers the first non-empty locale when decorating team names from XLC entries', () => {
    const teamEditorService = {
      hasData: true,
      teamOptions: [{ offset: 16, label: 'Team 1' }],
      getTeam: () => ({ offset: 16, teamId: 1, teamLabel: 'Team 1', playerCount: 0, slots: [] }),
      searchTeams: () => []
    };
    const xlcEditorService = {
      getLocaleValueByKey: () => null,
      entries: [
        {
          index: 0,
          key: 'TXT_TEAMNAMESHORT_1',
          locales: [
            { localeId: 0, localeLabel: 'Locale 0', offset: 10, maxByteLength: 4, originalByteLength: 2, sharedReferenceCount: 1, value: '' },
            { localeId: 1, localeLabel: 'Locale 1', offset: 20, maxByteLength: 8, originalByteLength: 8, sharedReferenceCount: 1, value: 'ARS' }
          ]
        },
        {
          index: 1,
          key: 'TXT_TEAMNAMELONG_1',
          locales: [
            { localeId: 0, localeLabel: 'Locale 0', offset: 30, maxByteLength: 4, originalByteLength: 2, sharedReferenceCount: 1, value: '' },
            { localeId: 1, localeLabel: 'Locale 1', offset: 40, maxByteLength: 16, originalByteLength: 16, sharedReferenceCount: 1, value: 'Arsenal' }
          ]
        }
      ]
    };
    const component = createComponent({}, {}, teamEditorService as any, { hasData: false, records: [] } as any, xlcEditorService as any);

    component.loadSingleTeam(16);

    expect(component.displayedTeams[0].teamLabel).toBe('ARS');
    expect(component.displayedTeams[0].teamShortName).toBe('ARS');
    expect(component.displayedTeams[0].teamLongName).toBe('Arsenal');
  });

  it('does not match reordered TEAM keys that belong to a different team id', () => {
    const teamEditorService = {
      hasData: true,
      teamOptions: [{ offset: 16, label: 'Team 501' }],
      getTeam: () => ({ offset: 16, teamId: 501, teamLabel: 'Team 501', playerCount: 0, slots: [] }),
      searchTeams: () => []
    };
    const xlcEditorService = {
      getLocaleValueByKey: () => null,
      entries: [
        {
          index: 0,
          key: 'TXT_TEAM_0_SHORTNAME',
          locales: [
            { localeId: 0, localeLabel: 'Locale 0', offset: 10, maxByteLength: 8, originalByteLength: 8, sharedReferenceCount: 1, value: 'ARS' }
          ]
        },
        {
          index: 1,
          key: 'TXT_TEAM_0_NAME',
          locales: [
            { localeId: 0, localeLabel: 'Locale 0', offset: 20, maxByteLength: 16, originalByteLength: 16, sharedReferenceCount: 1, value: 'Arsenal' }
          ]
        }
      ]
    };
    const component = createComponent({}, {}, teamEditorService as any, { hasData: false, records: [] } as any, xlcEditorService as any);

    component.loadSingleTeam(16);

    expect(component.displayedTeams[0].teamLabel).toBe('Team 501');
    expect(component.displayedTeams[0].teamShortName).toBeUndefined();
    expect(component.displayedTeams[0].teamLongName).toBeUndefined();
  });

  it('does not borrow another teams ordered entries when the exact team id is missing', () => {
    const teamEditorService = {
      hasData: true,
      teamOptions: [{ offset: 16, label: 'Team 501' }],
      getTeam: () => ({ offset: 16, teamId: 501, teamLabel: 'Team 501', playerCount: 0, slots: [] }),
      searchTeams: () => []
    };
    const xlcEditorService = {
      getLocaleValueByKey: () => null,
      entries: [
        {
          index: 0,
          key: 'TXT_TEAM_SHORT_0',
          locales: [
            { localeId: 0, localeLabel: 'Locale 0', offset: 10, maxByteLength: 8, originalByteLength: 8, sharedReferenceCount: 1, value: 'ARS' }
          ]
        },
        {
          index: 1,
          key: 'TXT_TEAM_NAME_0',
          locales: [
            { localeId: 0, localeLabel: 'Locale 0', offset: 20, maxByteLength: 16, originalByteLength: 16, sharedReferenceCount: 1, value: 'Arsenal' }
          ]
        }
      ]
    };
    const component = createComponent({}, {}, teamEditorService as any, { hasData: false, records: [] } as any, xlcEditorService as any);

    component.loadSingleTeam(16);

    expect(component.displayedTeams[0].teamLabel).toBe('Team 501');
    expect(component.displayedTeams[0].teamShortName).toBeUndefined();
    expect(component.displayedTeams[0].teamLongName).toBeUndefined();
  });

  it('prefers any team-name entry whose trailing numeric suffix matches the exact team id', () => {
    const teamEditorService = {
      hasData: true,
      teamOptions: [{ offset: 16, label: 'Team 501' }],
      getTeam: () => ({ offset: 16, teamId: 501, teamLabel: 'Team 501', playerCount: 0, slots: [] }),
      searchTeams: () => []
    };
    const xlcEditorService = {
      getLocaleValueByKey: () => null,
      entries: [
        {
          index: 0,
          key: 'TXT_TEAM_SHORT_501',
          locales: [
            { localeId: 0, localeLabel: 'Locale 0', offset: 10, maxByteLength: 8, originalByteLength: 8, sharedReferenceCount: 1, value: 'ARS' }
          ]
        },
        {
          index: 1,
          key: 'TXT_WHATEVER_CLUB_NAME_501',
          locales: [
            { localeId: 0, localeLabel: 'Locale 0', offset: 20, maxByteLength: 16, originalByteLength: 16, sharedReferenceCount: 1, value: 'Arsenal' }
          ]
        }
      ]
    };
    const component = createComponent({}, {}, teamEditorService as any, { hasData: false, records: [] } as any, xlcEditorService as any);

    component.loadSingleTeam(16);

    expect(component.displayedTeams[0].teamLabel).toBe('ARS');
    expect(component.displayedTeams[0].teamShortName).toBe('ARS');
    expect(component.displayedTeams[0].teamLongName).toBe('Arsenal');
  });
});

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