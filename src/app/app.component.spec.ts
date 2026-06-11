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

  it('maps selected CSV team players by import row index instead of name matching', () => {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: (index: number) => ({ name: `Player ${index}`, pos: 11, nat: 0 }),
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
      { shortName: 'Does Not Match DB Name', teamName: 'Arsenal', clubPosition: 'CM', overall: 80, sourceRowIndex: 3, playerId: '3' }
    ] as any;

    component.selectCsvImportTeam('Arsenal');

    expect(component.teamImportMappedPreview.length).toBe(1);
    expect(component.teamImportMappedPreview[0].futureIndex).toBe(3);
    expect(component.teamImportMappedPreview[0].futureHexId).toBe('0003');
  });

  it('uses the mapped player when calculating preview OVR and position', () => {
    const playerService = {
      getOvrTuningConfig: () => [],
      readPlayer: () => ({ name: 'Base Player', pos: 11, nat: 0 }),
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
});
