import { AppComponent } from './app.component';

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
    binaryData: new Uint8Array(1),
    totalPlayers: 10,
    loadFromBytes: jasmine.createSpy('loadFromBytes').and.returnValue('PLAYERS.DAT'),
    exportCurrentFileBytes: () => new Uint8Array([1, 2, 3]),
    readPlayer: () => ({ pos: 11, nat: 0 }),
    calculateOVR: () => 70,
    ...playerServiceOverrides
  };
  const playerImportService = {
    filterByTeam: () => [],
    mapImportedPlayer: () => ({ pos: 11, nat: 0 }),
    ...playerImportServiceOverrides
  };
  const pakEditorService = {
    hasData: true,
    entries: [],
    loadFromBytes: jasmine.createSpy('loadFromBytes').and.returnValue('teams.pak'),
    exportCurrentFileBytes: () => new Uint8Array([11, 12]),
    getTeamLogoEntry: () => null,
    ...pakEditorServiceOverrides
  };
  const teamEditorService = {
    hasData: true,
    teamOptions: [],
    loadFromBytes: jasmine.createSpy('loadFromBytes').and.returnValue('TEAMPLAYERLINKS_0.dat'),
    exportCurrentFileBytes: () => new Uint8Array([4, 5, 6]),
    searchTeams: () => [],
    getTeam: () => ({ offset: 0, teamId: 0, teamLabel: 'Team 0', playerCount: 0, slots: [] }),
    ...teamEditorServiceOverrides
  };
  const teamsDatService = {
    hasData: true,
    records: [],
    loadFromBytes: jasmine.createSpy('loadFromBytes').and.returnValue('TEAMS.DAT'),
    exportCurrentFileBytes: () => new Uint8Array([7, 8, 9]),
    ...teamsDatServiceOverrides
  };
  const xlcEditorService = {
    hasData: false,
    entries: [],
    loadFromBytes: jasmine.createSpy('loadFromBytes').and.returnValue('ftsteamnames.xlc'),
    exportCurrentFileBytes: () => new Uint8Array([10]),
    getLocaleValueByKey: () => null,
    ...xlcEditorServiceOverrides
  };
  const domSanitizer = {
    bypassSecurityTrustUrl: (value: string) => value
  };
  const fileHandleStorage = {
    getFileHandle: async () => null,
    getStoredValue: async () => null,
    saveStoredValue: async () => undefined,
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

describe('AppComponent local save', () => {
  it('loads all files from the stored local bundle', async () => {
    const bundle = {
      updatedAt: Date.now(),
      players: { fileName: 'PLAYERS.DAT', bytes: new Uint8Array([1]).buffer },
      teamPlayerLinks: { fileName: 'TEAMPLAYERLINKS_0.dat', bytes: new Uint8Array([2]).buffer },
      teamsDat: { fileName: 'TEAMS.DAT', bytes: new Uint8Array([3]).buffer },
      pak: { fileName: 'teams.pak', bytes: new Uint8Array([4]).buffer },
      xlc: { fileName: 'ftsteamnames.xlc', bytes: new Uint8Array([5]).buffer }
    };
    const component = createComponent(
      {},
      {},
      {},
      {},
      {},
      {},
      { getStoredValue: async () => bundle }
    );

    spyOn<any>(component, 'applyPlayerFileLoaded').and.callFake(() => undefined);
    spyOn<any>(component, 'applyTeamFileLoaded').and.callFake(() => undefined);
    spyOn<any>(component, 'applyTeamsDatLoaded').and.callFake(() => undefined);
    spyOn<any>(component, 'applyPakLoaded').and.callFake(() => undefined);
    spyOn<any>(component, 'applyXlcLoaded').and.callFake(() => undefined);
    spyOn<any>(component, 'checkAutoTransition').and.callFake(() => undefined);

    await component.useLocalSave();

    expect(component.playerService.loadFromBytes).toHaveBeenCalled();
    expect(component.teamEditorService.loadFromBytes).toHaveBeenCalled();
    expect(component.teamsDatService.loadFromBytes).toHaveBeenCalled();
    expect(component.pakEditorService.loadFromBytes).toHaveBeenCalled();
    expect(component.xlcEditorService.loadFromBytes).toHaveBeenCalled();
    expect(component.localSaveMode).toBeTrue();
  });
});