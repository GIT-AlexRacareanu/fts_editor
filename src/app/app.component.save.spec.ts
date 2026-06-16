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
    readPlayer: (playerId: number) => ({ pos: playerId, nat: 0 }),
    calculateOVR: (player: { pos: number }) => player.pos,
    binaryData: new Uint8Array(1),
    totalPlayers: 500,
    saveCurrentToSameFile: jasmine.createSpy('saveCurrentToSameFile').and.resolveTo(),
    ...playerServiceOverrides
  };
  const playerImportService = {
    filterByTeam: () => [],
    mapImportedPlayer: () => ({ pos: 11, nat: 0 }),
    ...playerImportServiceOverrides
  };
  const pakEditorService = {
    hasData: false,
    ...pakEditorServiceOverrides
  };
  const teamEditorService = {
    hasData: true,
    teamOptions: [],
    getTeam: () => ({ offset: 0, teamId: 0, teamLabel: 'Team 0', playerCount: 0, slots: [] }),
    normalizeActiveSlotAttributes: () => 0,
    validatePlayerReferences: () => [],
    saveToSameFile: jasmine.createSpy('saveToSameFile').and.resolveTo(),
    ...teamEditorServiceOverrides
  };
  const teamsDatService = {
    hasData: true,
    kitStyleOptions: [],
    sponsorTypeOptions: [],
    europeanCompetitionOptions: [],
    records: [],
    saveToSameFile: jasmine.createSpy('saveToSameFile').and.resolveTo(),
    ...teamsDatServiceOverrides
  };
  const xlcEditorService = {
    hasData: false,
    saveToSameFile: jasmine.createSpy('saveToSameFile').and.resolveTo(),
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

describe('AppComponent save batching', () => {
  it('rebuilds the team browser once after syncing all teams before save', async () => {
    const alertSpy = spyOn(window, 'alert');
    const teamEditorService = {
      teamOptions: [{ offset: 10, label: 'Arsenal' }, { offset: 20, label: 'Chelsea' }],
      getTeam: (offset: number) => offset === 10
        ? {
          offset: 10,
          teamId: 100,
          teamLabel: 'Arsenal',
          playerCount: 3,
          slots: [
            { playerId: 90, position: 19, isEmpty: false },
            { playerId: 80, position: 11, isEmpty: false },
            { playerId: 70, position: 6, isEmpty: false }
          ]
        }
        : {
          offset: 20,
          teamId: 200,
          teamLabel: 'Chelsea',
          playerCount: 3,
          slots: [
            { playerId: 87, position: 20, isEmpty: false },
            { playerId: 77, position: 12, isEmpty: false },
            { playerId: 67, position: 5, isEmpty: false }
          ]
        }
    };
    const updateRecord = jasmine.createSpy('updateRecord').and.callFake((index: number, changes: Record<string, number>) => ({
      index,
      teamId: index === 0 ? 100 : 200,
      formationId: 0,
      attackOvr: changes['attackOvr'] ?? 0,
      midfieldOvr: changes['midfieldOvr'] ?? 0,
      defenseOvr: changes['defenseOvr'] ?? 0
    }));
    const teamsDatService = {
      records: [
        { index: 0, teamId: 100, formationId: 0, attackOvr: 0, midfieldOvr: 0, defenseOvr: 0 },
        { index: 1, teamId: 200, formationId: 0, attackOvr: 0, midfieldOvr: 0, defenseOvr: 0 }
      ],
      updateRecord
    };
    const pakEditorService = {
      hasData: true,
      saveToSameFile: jasmine.createSpy('saveToSameFile').and.resolveTo()
    };
    const component = createComponent({}, {}, teamEditorService as any, teamsDatService as any, {}, pakEditorService as any);
    const rebuildTeamBrowseItemsSpy = spyOn<any>(component, 'rebuildTeamBrowseItems').and.callFake(() => undefined);
    spyOn<any>(component, 'syncAllTeamsDatRolesWithCurrentRosters').and.returnValue(0);

    await component.saveAllFiles();

    expect(updateRecord).toHaveBeenCalledWith(0, {
      attackOvr: 90,
      midfieldOvr: 80,
      defenseOvr: 70
    });
    expect(updateRecord).toHaveBeenCalledWith(1, {
      attackOvr: 87,
      midfieldOvr: 77,
      defenseOvr: 67
    });
    expect(rebuildTeamBrowseItemsSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Synced ATT/MID/DEF OVR values in TEAMS.DAT for 2 teams before save.');
    expect(alertSpy).toHaveBeenCalledWith('Files overwritten successfully.');
  });
});