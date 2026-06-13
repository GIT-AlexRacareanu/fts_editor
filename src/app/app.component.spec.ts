import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});

describe('AppComponent team CSV import preview', () => {
  function createComponent(): AppComponent {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: () => ({ pos: 11 }),
      findPlayerIndexByName: () => -1,
      parsePlayerId: () => -1,
      formatPlayerId: () => '0001',
      calculateOVR: () => 70,
      binaryData: null
    };
    const playerImportService = {
      filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const teamEditorService = { hasData: false };
    const teamsDatService = { hasData: false };

    return new AppComponent(playerService as any, playerImportService as any, teamEditorService as any, teamsDatService as any);
  }

  it('loads the import source when team CSV search starts and no source is loaded', async () => {
    const component = createComponent();
    const loadSpy = spyOn(component, 'loadImportSource').and.callFake(async () => {
      component.importedPlayers = [
        { shortName: 'Preview One', teamName: 'Arsenal' }
      ] as any;
    });

    await component.onTeamImportCsvTeamInput({ target: { value: 'ars' } } as any);

    expect(loadSpy).toHaveBeenCalledOnceWith(false, false);
  });

  it('returns selected CSV team players for preview even before PLAYERS.DAT name matching', () => {
    const component = createComponent();
    component.importedPlayers = [
      { shortName: 'Player A', teamName: 'Arsenal', clubPosition: 'CM', overall: 80 },
      { shortName: 'Player B', teamName: 'Arsenal', clubPosition: 'ST', overall: 82 },
      { shortName: 'Player C', teamName: 'Chelsea', clubPosition: 'GK', overall: 75 }
    ] as any;

    component.selectCsvImportTeam('Arsenal');

    expect(component.teamImportPreviewPlayers.length).toBe(2);
    expect(component.teamImportCsvPreviewPlayers.length).toBe(2);
    expect(component.teamImportCsvPreviewPlayers[0].shortName).toBe('Player A');
  });

  it('maps selected CSV team players by name matching instead of import row index', () => {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (index: number) => ({ name: `Player ${index}`, pos: 11, nat: 0 }),
      findPlayerIndexByName: (name: string) => name === 'Matches DB Name' ? 7 : -1,
      parsePlayerId: () => -1,
      formatPlayerId: (index: number) => index.toString(16).toUpperCase().padStart(4, '0'),
      calculateOVR: () => 70,
      totalPlayers: 10,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const component = new AppComponent(playerService as any, playerImportService as any, { hasData: false } as any, { hasData: false } as any);

    component.importedPlayers = [
      { shortName: 'Matches DB Name', teamName: 'Arsenal', clubPosition: 'CM', overall: 80, sourceRowIndex: 3, playerId: '3' }
    ] as any;

    component.selectCsvImportTeam('Arsenal');

    expect(component.teamImportMappedPreview.length).toBe(1);
    expect(component.teamImportMappedPreview[0].futureIndex).toBe(7);
    expect(component.teamImportMappedPreview[0].futureHexId).toBe('0007');
  });

  it('falls back to short name plus surname when the csv short name alone is insufficient', () => {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (index: number) => ({ name: `Player ${index}`, pos: 11, nat: 0 }),
      findPlayerIndexByName: (name: string) => name === 'Gabriel dos S. Magalhães' ? 9 : -1,
      parsePlayerId: () => -1,
      formatPlayerId: (index: number) => index.toString(16).toUpperCase().padStart(4, '0'),
      calculateOVR: () => 70,
      totalPlayers: 10,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const component = new AppComponent(playerService as any, playerImportService as any, { hasData: false } as any, { hasData: false } as any);

    component.importedPlayers = [
      { shortName: 'Gabriel', lastName: 'dos S. Magalhães', teamName: 'Arsenal', clubPosition: 'CB', overall: 89, sourceRowIndex: 3, playerId: '3' }
    ] as any;

    component.selectCsvImportTeam('Arsenal');

    expect(component.teamImportMappedPreview.length).toBe(1);
    expect(component.teamImportMappedPreview[0].futureIndex).toBe(9);
    expect(component.teamImportMappedPreview[0].futureHexId).toBe('0009');
  });

  it('maps selected csv players by import order when players.dat was bulk-replaced from the same csv', () => {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (index: number) => ({
        name: index < 18 ? `dummy${index + 1}` : `Player ${index}`,
        pos: 11,
        nat: 0
      }),
      findPlayerIndexByName: () => -1,
      parsePlayerId: () => -1,
      formatPlayerId: (index: number) => index.toString(16).toUpperCase().padStart(4, '0'),
      calculateOVR: () => 70,
      totalPlayers: 40,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const component = new AppComponent(playerService as any, playerImportService as any, { hasData: false } as any, { hasData: false } as any);

    component.importedPlayers = [
      { shortName: 'Top Arsenal Player', teamName: 'Arsenal', clubPosition: 'CM', overall: 90, sourceRowIndex: 10, playerId: '10' },
      { shortName: 'Other Team Player', teamName: 'Chelsea', clubPosition: 'CM', overall: 85, sourceRowIndex: 1, playerId: '1' },
      { shortName: 'Second Arsenal Player', teamName: 'Arsenal', clubPosition: 'ST', overall: 80, sourceRowIndex: 3, playerId: '3' }
    ] as any;

    component.selectCsvImportTeam('Arsenal');

    expect(component.teamImportMappedPreview.length).toBe(2);
    expect(component.teamImportMappedPreview[0].futureIndex).toBe(18);
    expect(component.teamImportMappedPreview[0].futureHexId).toBe('0012');
    expect(component.teamImportMappedPreview[1].futureIndex).toBe(20);
    expect(component.teamImportMappedPreview[1].futureHexId).toBe('0014');
  });

  it('does not use source row index directly for bulk-imported players.dat matching', () => {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (index: number) => ({
        name: index < 18 ? `dummy${index + 1}` : `Player ${index}`,
        pos: 11,
        nat: 0
      }),
      findPlayerIndexByName: () => -1,
      parsePlayerId: () => -1,
      formatPlayerId: (index: number) => index.toString(16).toUpperCase().padStart(4, '0'),
      calculateOVR: () => 70,
      totalPlayers: 50,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const component = new AppComponent(playerService as any, playerImportService as any, { hasData: false } as any, { hasData: false } as any);

    component.importedPlayers = [
      { shortName: 'Chosen Arsenal Player', teamName: 'Arsenal', clubPosition: 'CM', overall: 92, sourceRowIndex: 25, playerId: '25' },
      { shortName: 'Lower Arsenal Player', teamName: 'Arsenal', clubPosition: 'CM', overall: 80, sourceRowIndex: 2, playerId: '2' }
    ] as any;

    component.selectCsvImportTeam('Arsenal');

    expect(component.teamImportMappedPreview[0].futureIndex).toBe(18);
    expect(component.teamImportMappedPreview[1].futureIndex).toBe(19);
  });

  it('uses an explicit imported player id before falling back to name matching', () => {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (index: number) => ({ name: `Player ${index}`, pos: 11, nat: 0 }),
      findPlayerIndexByName: () => 7,
      parsePlayerId: (value: string) => value === '00AF' ? 4 : -1,
      formatPlayerId: (index: number) => index.toString(16).toUpperCase().padStart(4, '0'),
      calculateOVR: () => 70,
      totalPlayers: 10,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const component = new AppComponent(playerService as any, playerImportService as any, { hasData: false } as any, { hasData: false } as any);

    component.importedPlayers = [
      { shortName: 'Matches DB Name', teamName: 'Arsenal', clubPosition: 'CM', overall: 80, playerId: '00AF', hasExplicitPlayerId: true }
    ] as any;

    component.selectCsvImportTeam('Arsenal');

    expect(component.teamImportMappedPreview.length).toBe(1);
    expect(component.teamImportMappedPreview[0].futureIndex).toBe(4);
    expect(component.teamImportMappedPreview[0].futureHexId).toBe('0004');
  });

  it('uses the mapped player when calculating preview OVR and position', () => {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: () => ({ name: 'Base Player', pos: 11, nat: 0 }),
      findPlayerIndexByName: () => 3,
      parsePlayerId: () => -1,
      formatPlayerId: (index: number) => index.toString(16).toUpperCase().padStart(4, '0'),
      calculateOVR: (player: { pos: number }) => player.pos === 19 ? 91 : 70,
      totalPlayers: 10,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
      mapImportedPlayer: () => ({ pos: 19, nat: 0 })
    };
    const component = new AppComponent(playerService as any, playerImportService as any, { hasData: false } as any, { hasData: false } as any);

    component.importedPlayers = [
      { shortName: 'Target Striker', teamName: 'Arsenal', clubPosition: 'ST', overall: 90, sourceRowIndex: 3, playerId: '3' }
    ] as any;

    component.selectCsvImportTeam('Arsenal');

    expect(component.teamImportMappedPreview.length).toBe(1);
    expect(component.teamImportMappedPreview[0].positionLabel).toBe('ST');
    expect(component.teamImportMappedPreview[0].ovr).toBe(91);
  });

  it('orders imported starters by the selected formation and best matching OVR', async () => {
    const addPlayer = jasmine.createSpy('addPlayer');
    const clearTeam = jasmine.createSpy('clearTeam');
    const playerIdByName: Record<string, number> = {
      'Top Keeper': 1,
      'Left Mid': 4,
      'Right Mid': 5,
      'Top Striker': 2,
      'Backup Striker': 3
    };
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (index: number) => ({ name: `Player ${index}`, pos: 11, nat: 0 }),
      findPlayerIndexByName: (name: string) => playerIdByName[name] ?? -1,
      parsePlayerId: () => -1,
      formatPlayerId: (index: number) => index.toString(16).toUpperCase().padStart(4, '0'),
      calculateOVR: (player: { ovr?: number }) => player.ovr ?? 0,
      totalPlayers: 0,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
      mapImportedPlayer: (player: { shortName: string; clubPosition: string; overall: number }) => ({
        pos: player.clubPosition === 'GK' ? 0 : player.clubPosition === 'LM' ? 17 : player.clubPosition === 'RM' ? 16 : 19,
        nat: 0,
        ovr: player.overall
      })
    };
    const teamEditorService = {
      hasData: true,
      teamOptions: [{ offset: 16, label: 'Test FC' }],
      getTeam: () => ({ offset: 16, teamId: 99, teamLabel: 'Test FC', playerCount: 0, slots: [] }),
      clearTeam,
      addPlayer
    };
    const teamsDatService = {
      hasData: true,
      getFormationIdByTeamId: () => 0,
      records: []
    };
    const component = new AppComponent(playerService as any, playerImportService as any, teamEditorService as any, teamsDatService as any);
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(component, 'loadSingleTeam').and.stub();
    spyOn<any>(component, 'refreshDbBrowsePlayers').and.stub();

    component.selectedTeamOffset = 16;
    component.teamImportCsvTeam = 'Arsenal';
    component.importedPlayers = [
      { shortName: 'Top Keeper', teamName: 'Arsenal', clubPosition: 'GK', overall: 88 },
      { shortName: 'Left Mid', teamName: 'Arsenal', clubPosition: 'LM', overall: 84 },
      { shortName: 'Backup Striker', teamName: 'Arsenal', clubPosition: 'ST', overall: 80 },
      { shortName: 'Right Mid', teamName: 'Arsenal', clubPosition: 'RM', overall: 83 },
      { shortName: 'Top Striker', teamName: 'Arsenal', clubPosition: 'ST', overall: 94 }
    ] as any;

    await component.importTeamFromCsv();

    expect(clearTeam).toHaveBeenCalledOnceWith(16);
    const addedPlayerIds = addPlayer.calls.allArgs().map((args) => args[1]);

    expect(addedPlayerIds).toContain(2);
    expect(addedPlayerIds).toContain(3);
    expect(addedPlayerIds.indexOf(2)).toBeLessThan(addedPlayerIds.indexOf(3));
  });

  it('preserves the current popup position when importing a single player', () => {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: () => ({ name: 'Base Player', pos: 11, nat: 0 }),
      findPlayerIndexByName: () => -1,
      parsePlayerId: () => -1,
      formatPlayerId: () => '0001',
      calculateOVR: (player: { pos: number }) => player.pos,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: () => [],
      mapImportedPlayer: () => ({ name: 'Imported Player', pos: 19, nat: 0 })
    };
    const component = new AppComponent(playerService as any, playerImportService as any, { hasData: false } as any, { hasData: false } as any);

    component.popupPlayerIndex = 1;
    component.popupPlayer = { name: 'Current Player', pos: 11, nat: 0 } as any;

    component.importSelectedPlayer({ shortName: 'Imported Player' } as any);

    expect(component.popupPlayer.name).toBe('Imported Player');
    expect(component.popupPlayer.pos).toBe(11);
  });

  it('prepends 18 dummy players before real players during bulk replace import', async () => {
    const replacePlayers = jasmine.createSpy('replacePlayers').and.returnValue({ replaced: 20, previousTotal: 4, nextTotal: 20 });
    const downloadFile = jasmine.createSpy('downloadFile').and.resolveTo();
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: () => ({ name: 'Template', pos: 11, nat: 0, foot: 0, estatura: 180, peso: 75, hiddenFromTransferMarket: 0, isIconLegend: 0, birthDay: 1, birthMonth: 1, year: 2000, skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0, boots: 0, mangas: 0, guantes: 0, ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0, CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0 }),
      formatPlayerId: (index: number) => index.toString(16).toUpperCase().padStart(4, '0'),
      calculateOVR: () => 70,
      replacePlayers,
      downloadFile,
      binaryData: new Uint8Array(1),
      totalPlayers: 4
    };
    const playerImportService = {
      filterByTeam: () => [],
      mapImportedPlayer: (source: { shortName: string }) => ({ name: source.shortName, pos: 11, nat: 0, foot: 0, estatura: 180, peso: 75, hiddenFromTransferMarket: 0, isIconLegend: 0, birthDay: 1, birthMonth: 1, year: 2000, skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0, boots: 0, mangas: 0, guantes: 0, ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0, CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0 })
    };
    const component = new AppComponent(playerService as any, playerImportService as any, { hasData: false } as any, { hasData: false } as any);
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);

    component.importedPlayers = [
      { shortName: 'Real One' },
      { shortName: 'Real Two' }
    ] as any;

    await component.bulkReplaceAllPlayersAndDownload();

    expect(confirmSpy).toHaveBeenCalled();
    expect(replacePlayers).toHaveBeenCalled();

    const [playersArg, optionsArg] = replacePlayers.calls.mostRecent().args as [Array<{ name: string; ACC: number; GKP: number }>, { templatePlayerIndex: number }];

    expect(playersArg.length).toBe(20);
    expect(playersArg[0].name).toBe('dummy1');
    expect(playersArg[17].name).toBe('dummy18');
    expect(playersArg[0].ACC).toBe(40);
    expect(playersArg[0].GKP).toBe(40);
    expect(playersArg[18].name).toBe('Real One');
    expect(playersArg[19].name).toBe('Real Two');
    expect(optionsArg).toEqual({ templatePlayerIndex: 0 });
    expect(downloadFile).toHaveBeenCalled();
    expect(component.importStatusMessage).toContain('inserted 18 dummy players, then 2 imported players');
  });

  it('caches formation sketches for the same displayed team object', () => {
    const readPlayerSpy = jasmine.createSpy('readPlayer').and.returnValue({
      name: 'Player A',
      pos: 11,
      nat: 0
    });
    const calculateOvrSpy = jasmine.createSpy('calculateOVR').and.returnValue(77);
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: readPlayerSpy,
      findPlayerIndexByName: () => -1,
      parsePlayerId: () => -1,
      calculateOVR: calculateOvrSpy,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: () => [],
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const teamEditorService = { hasData: true };
    const teamsDatService = { hasData: false };
    const component = new AppComponent(playerService as any, playerImportService as any, teamEditorService as any, teamsDatService as any);
    const team = {
      offset: 16,
      teamId: 1,
      teamLabel: 'Test FC',
      playerCount: 1,
      slots: [{
        index: 0,
        playerId: 1,
        playerIdHex: '0001',
        tacticalByte: 0,
        isStarter: true,
        isCaptain: false,
        isPenaltyTaker: false,
        isFreeKickTaker: false,
        isLeftCornerTaker: false,
        isRightCornerTaker: false,
        shirtNumber: 9,
        position: 11,
        isEmpty: false,
        playerName: 'Player A'
      }]
    } as any;

    const firstSketch = component.getFormationSketch(team);
    const secondSketch = component.getFormationSketch(team);

    expect(firstSketch).toBe(secondSketch);
    expect(readPlayerSpy).toHaveBeenCalledTimes(1);
    expect(calculateOvrSpy).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the selected team sketch immediately after a formation change', () => {
    let currentFormationId = 0;
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (playerId: number) => ({ name: `Player ${playerId}`, pos: playerId === 1 ? 17 : 16, nat: 0 }),
      getPlayerNameByIndex: (playerId: number) => `Player ${playerId}`,
      findPlayerIndexByName: () => -1,
      parsePlayerId: () => -1,
      calculateOVR: () => 75,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: () => [],
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const teamEditorService = {
      hasData: true,
      getTeam: () => ({
        offset: 16,
        teamId: 99,
        teamLabel: 'Test FC',
        playerCount: 2,
        slots: [
          {
            index: 0,
            playerId: 1,
            playerIdHex: '0001',
            tacticalByte: 0,
            isStarter: true,
            isCaptain: false,
            isPenaltyTaker: false,
            isFreeKickTaker: false,
            isLeftCornerTaker: false,
            isRightCornerTaker: false,
            shirtNumber: 11,
            position: 17,
            isEmpty: false,
            playerName: 'Left Mid'
          },
          {
            index: 1,
            playerId: 2,
            playerIdHex: '0002',
            tacticalByte: 0,
            isStarter: true,
            isCaptain: false,
            isPenaltyTaker: false,
            isFreeKickTaker: false,
            isLeftCornerTaker: false,
            isRightCornerTaker: false,
            shirtNumber: 7,
            position: 16,
            isEmpty: false,
            playerName: 'Right Mid'
          }
        ]
      })
    };
    const teamsDatService = {
      hasData: true,
      records: [{ index: 0, teamId: 99, formationId: 0 }],
      getFormationIdByTeamId: () => currentFormationId,
      updateRecord: (_index: number, changes: { formationId: number }) => {
        currentFormationId = changes.formationId;
        return { index: 0, teamId: 99, formationId: currentFormationId };
      }
    };
    const component = new AppComponent(playerService as any, playerImportService as any, teamEditorService as any, teamsDatService as any);

    component.loadSingleTeam(16);
    const initialSketch = component.getFormationSketch(component.displayedTeams[0]);

    component.updateTeamsDatFormation({ index: 0, teamId: 99, formationId: 0 } as any, 1);

    const updatedSketch = component.getFormationSketch(component.displayedTeams[0]);

    expect(initialSketch.slots.map((slot) => slot.targetPosition)).toEqual([0, 1, 5, 7, 2, 17, 12, 13, 16, 19, 19]);
    expect(updatedSketch.slots.map((slot) => slot.targetPosition)).toEqual([0, 1, 5, 7, 2, 12, 11, 13, 20, 19, 21]);
  });

  it('updates teams.dat attack, midfield, and defense ratings from the resolved first 11', () => {
    const updateRecord = jasmine.createSpy('updateRecord').and.callFake((_index: number, changes: Record<string, number>) => ({
      index: 0,
      teamId: 99,
      formationId: 0,
      attackOvr: changes['attackOvr'] ?? 0,
      midfieldOvr: changes['midfieldOvr'] ?? 0,
      defenseOvr: changes['defenseOvr'] ?? 0
    }));
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (playerId: number) => ({
        name: `Player ${playerId}`,
        pos: 0,
        nat: 0,
        ovr: 0
      }),
      getPlayerNameByIndex: (playerId: number) => `Player ${playerId}`,
      findPlayerIndexByName: () => -1,
      parsePlayerId: () => -1,
      calculateOVR: (player: { ovr?: number }) => player.ovr ?? 0,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: () => [],
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const teamEditorService = {
      hasData: true,
      getTeam: () => ({
        offset: 16,
        teamId: 99,
        teamLabel: 'Test FC',
        playerCount: 4,
        slots: [
          { index: 0, playerId: 1, playerIdHex: '0001', tacticalByte: 0, isStarter: true, isCaptain: false, isPenaltyTaker: false, isFreeKickTaker: false, isLeftCornerTaker: false, isRightCornerTaker: false, shirtNumber: 1, position: 0, isEmpty: false },
          { index: 1, playerId: 2, playerIdHex: '0002', tacticalByte: 0, isStarter: true, isCaptain: false, isPenaltyTaker: false, isFreeKickTaker: false, isLeftCornerTaker: false, isRightCornerTaker: false, shirtNumber: 4, position: 6, isEmpty: false },
          { index: 2, playerId: 3, playerIdHex: '0003', tacticalByte: 0, isStarter: true, isCaptain: false, isPenaltyTaker: false, isFreeKickTaker: false, isLeftCornerTaker: false, isRightCornerTaker: false, shirtNumber: 8, position: 11, isEmpty: false },
          { index: 3, playerId: 4, playerIdHex: '0004', tacticalByte: 0, isStarter: true, isCaptain: false, isPenaltyTaker: false, isFreeKickTaker: false, isLeftCornerTaker: false, isRightCornerTaker: false, shirtNumber: 9, position: 19, isEmpty: false }
        ]
      })
    };
    const teamsDatService = {
      hasData: true,
      teamCount: 1,
      records: [{ index: 0, teamId: 99, formationId: 0, attackOvr: 0, midfieldOvr: 0, defenseOvr: 0 }],
      getFormationIdByTeamId: () => 0,
      updateRecord
    };
    const component = new AppComponent(playerService as any, playerImportService as any, teamEditorService as any, teamsDatService as any);

    spyOn(component as any, 'getFormationSketch').and.returnValue({
      slots: [
        { targetPosition: 0, player: { ovr: 80 } },
        { targetPosition: 6, player: { ovr: 70 } },
        { targetPosition: 11, player: { ovr: 60 } },
        { targetPosition: 19, player: { ovr: 90 } }
      ],
      reservePlayers: []
    });

    component.loadSingleTeam(16);

    expect(updateRecord).toHaveBeenCalledWith(0, {
      attackOvr: 90,
      midfieldOvr: 60,
      defenseOvr: 75
    });
  });

  it('creates a new DB Browser player by appending to PLAYERS.DAT and opening it', () => {
    const appendPlayers = jasmine.createSpy('appendPlayers').and.returnValue([24]);
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (index: number) => ({ name: `Player ${index}`, pos: 11, nat: 0 }),
      calculateOVR: () => 70,
      appendPlayers,
      totalPlayers: 0,
      binaryData: new Uint8Array(1)
    };
    const playerImportService = {
      filterByTeam: () => [],
      mapImportedPlayer: () => ({ pos: 11 })
    };
    const teamEditorService = { hasData: false };
    const teamsDatService = { hasData: false };
    const component = new AppComponent(playerService as any, playerImportService as any, teamEditorService as any, teamsDatService as any);
    const applyPlayerFileLoadedSpy = spyOn<any>(component, 'applyPlayerFileLoaded').and.stub();
    const openPlayerEditPopupSpy = spyOn(component, 'openPlayerEditPopup').and.stub();

    component.createDbBrowsePlayer();

    expect(appendPlayers).toHaveBeenCalledTimes(1);
    expect(appendPlayers.calls.mostRecent().args[0].length).toBe(1);
    expect(appendPlayers.calls.mostRecent().args[0][0]).toEqual(jasmine.objectContaining({
      name: '',
      pos: 0,
      ACC: 40,
      SPD: 40,
      STA: 40,
      STR: 40,
      TAC: 40,
      CON: 40,
      SHO: 40,
      CRO: 40,
      FK: 40,
      PAS: 40,
      HEA: 40,
      GKS: 40,
      GKH: 40,
      GKP: 40
    }));
    expect(applyPlayerFileLoadedSpy).toHaveBeenCalled();
    expect(openPlayerEditPopupSpy).toHaveBeenCalledOnceWith(24);
  });
});
