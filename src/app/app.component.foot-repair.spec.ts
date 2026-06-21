import { AppComponent } from './app.component';

function createComponent(playerServiceOverrides: Record<string, any> = {}): AppComponent {
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
    readPlayer: () => ({ pos: 11, nat: 0, foot: 0 }),
    getPlayerNameByIndex: () => 'Player',
    findPlayerIndexByName: () => -1,
    parsePlayerId: () => -1,
    formatPlayerId: () => '0001',
    calculateOVR: () => 70,
    binaryData: null,
    totalPlayers: 0,
    ...playerServiceOverrides
  };

  return new AppComponent(
    ngZone as any,
    changeDetectorRef as any,
    playerService as any,
    { filterByTeam: () => [], mapImportedPlayer: () => ({ pos: 11, nat: 0 }) } as any,
    { hasData: false } as any,
    { hasData: false, teamOptions: [], getTeam: () => ({ offset: 0, teamId: 0, teamLabel: 'Team 0', playerCount: 0, slots: [] }), searchTeams: () => [] } as any,
    { hasData: false, kitStyleOptions: [], sponsorTypeOptions: [], europeanCompetitionOptions: [], stadiumNameMaxLength: 23, records: [] } as any,
    { getLocaleValueByKey: () => null, entries: [] } as any,
    { bypassSecurityTrustUrl: (value: string) => value } as any,
    { getFileHandle: async () => null, saveFileHandle: async () => undefined, deleteFileHandle: async () => undefined } as any
  );
}

describe('AppComponent foot repair', () => {
  it('maps player editor foot options to the corrected left-right values', () => {
    const component = createComponent();

    expect(component.feet).toEqual([
      { value: 0, label: 'Left' },
      { value: 1, label: 'Right' },
      { value: 255, label: 'Default/Both' }
    ]);
  });

  it('repairs every stored player foot by inverting left and right values', () => {
    const players = [
      { name: 'Left Footed', pos: 11, nat: 0, foot: 0 },
      { name: 'Right Footed', pos: 12, nat: 0, foot: 1 },
      { name: 'Default Foot', pos: 13, nat: 0, foot: 255 }
    ];
    const writePlayer = jasmine.createSpy('writePlayer').and.callFake((index: number, player: { foot: number }) => {
      players[index] = { ...players[index], ...player };
    });
    const component = createComponent({
      readPlayer: (index: number) => ({ ...players[index] }),
      writePlayer,
      totalPlayers: players.length,
      binaryData: new Uint8Array(1)
    });

    component.showPlayerEditPopup = true;
    component.popupPlayerIndex = 1;
    component.popupPlayer = { ...players[1] } as any;

    component.repairAllPlayerFeet();

    expect(writePlayer.calls.allArgs()).toEqual([
      [0, jasmine.objectContaining({ foot: 1 })],
      [1, jasmine.objectContaining({ foot: 0 })]
    ]);
    expect(component.popupPlayer.foot).toBe(0);
  });
});