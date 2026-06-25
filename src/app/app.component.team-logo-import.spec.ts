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
    stadiumNameMaxLength: 23,
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

describe('AppComponent team logo import', () => {
  it('creates both logo entries when neither exists in teams.pak', async () => {
    const mainBytes = new Uint8Array([1, 2, 3]);
    const thumbBytes = new Uint8Array([4, 5]);
    const mainEntry = { name: 't7.png', index: 1, path: 't7.png' };
    const thumbEntry = { name: 't7_thumb.png', index: 2, path: 't7_thumb.png' };

    let hasMain = false;
    let hasThumb = false;

    const getTeamLogoEntry = jasmine.createSpy('getTeamLogoEntry').and.callFake((_teamId: number, variant: 'main' | 'thumb') => {
      if (variant === 'main') {
        return hasMain ? mainEntry : null;
      }
      return hasThumb ? thumbEntry : null;
    });
    const addEntry = jasmine.createSpy('addEntry').and.callFake((name: string) => {
      if (name.endsWith('_thumb.png')) {
        hasThumb = true;
      } else {
        hasMain = true;
      }
    });
    const replaceEntry = jasmine.createSpy('replaceEntry');
    const component = createComponent({}, {}, {}, {}, {}, {
      getTeamLogoEntry,
      addEntry,
      replaceEntry
    } as any);

    spyOn<any>(component, 'renderImageAsPng').and.returnValues(Promise.resolve(mainBytes), Promise.resolve(thumbBytes));
    const alertSpy = spyOn(window, 'alert');

    component.pendingTeamLogoImportTeamId = 7;
    await component.onTeamLogoFileSelected({ target: { files: [{ name: 'logo.png' }] } } as any);

    expect(addEntry).toHaveBeenCalledWith('t7.png', mainBytes);
    expect(addEntry).toHaveBeenCalledWith('t7_thumb.png', thumbBytes);
    expect(replaceEntry).toHaveBeenCalledWith(mainEntry, mainBytes);
    expect(replaceEntry).toHaveBeenCalledWith(thumbEntry, thumbBytes);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('creates only the missing thumb entry when main already exists', async () => {
    const mainBytes = new Uint8Array([9, 9, 9]);
    const thumbBytes = new Uint8Array([6]);
    const mainEntry = { name: 't12.png', index: 5, path: 't12.png' };
    const thumbEntry = { name: 't12_thumb.png', index: 6, path: 't12_thumb.png' };

    let hasThumb = false;

    const getTeamLogoEntry = jasmine.createSpy('getTeamLogoEntry').and.callFake((_teamId: number, variant: 'main' | 'thumb') => {
      if (variant === 'main') {
        return mainEntry;
      }
      return hasThumb ? thumbEntry : null;
    });
    const addEntry = jasmine.createSpy('addEntry').and.callFake(() => {
      hasThumb = true;
    });
    const replaceEntry = jasmine.createSpy('replaceEntry');
    const component = createComponent({}, {}, {}, {}, {}, {
      getTeamLogoEntry,
      addEntry,
      replaceEntry
    } as any);

    spyOn<any>(component, 'renderImageAsPng').and.returnValues(Promise.resolve(mainBytes), Promise.resolve(thumbBytes));

    component.pendingTeamLogoImportTeamId = 12;
    await component.onTeamLogoFileSelected({ target: { files: [{ name: 'logo.png' }] } } as any);

    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith('t12_thumb.png', thumbBytes);
    expect(replaceEntry).toHaveBeenCalledWith(mainEntry, mainBytes);
    expect(replaceEntry).toHaveBeenCalledWith(thumbEntry, thumbBytes);
  });
});
