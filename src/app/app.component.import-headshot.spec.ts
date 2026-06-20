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
    readPlayer: () => ({ pos: 11, nat: 0, foot: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000, skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0, boots: 0, mangas: 0, guantes: 0, ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0, CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0, name: 'Player' }),
    getPlayerNameByIndex: () => 'Player',
    findPlayerIndexByName: () => -1,
    parsePlayerId: () => -1,
    formatPlayerId: () => '0001',
    calculateOVR: () => 70,
    binaryData: new Uint8Array(1),
    totalPlayers: 0,
    ...playerServiceOverrides
  };
  const playerImportService = {
    filterByTeam: (players: Array<{ teamName: string }>, teamName: string) => players.filter((player) => player.teamName === teamName),
    mapImportedPlayer: (_record: ImportedPlayerRecord, currentPlayer: Record<string, any>) => ({ ...currentPlayer }),
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

describe('import headshot support', () => {
  it('parses the headshot column from import CSV rows', () => {
    const service = new PlayerImportService();
    const csv = [
      'knownas,nation,club,overallrating,age,height,weight,position_1,preferredfoot,headshot',
      'Erling Haaland,Norway,Manchester City,91,24,195,94,25,Left,https://example.com/headshots/haaland.png'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(1);
    expect(parsed[0].headshot).toBe('https://example.com/headshots/haaland.png');
  });

  it('shows the headshot from the CSV row matching the popup player index after the 18 dummy players', () => {
    const firstRecord: ImportedPlayerRecord = {
      sourceRowIndex: 0,
      shortName: 'First Player',
      lastName: 'One',
      headshot: 'https://example.com/headshots/first.png',
      overall: 71,
      age: 24,
      heightCm: 180,
      weightKg: 75,
      clubPosition: 'CM',
      nationalityName: 'Portugal',
      preferredFoot: 'Right',
      teamName: 'First Club',
      nationalTeamName: '',
      loanedToTeamName: '',
      shooting: 61,
      passing: 62,
      dribbling: 63,
      physical: 64,
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
      defending: 50
    };
    const secondRecord: ImportedPlayerRecord = {
      sourceRowIndex: 1,
      shortName: 'Erling Haaland',
      lastName: 'Haaland',
      headshot: 'https://example.com/headshots/haaland.png',
      overall: 91,
      age: 24,
      heightCm: 195,
      weightKg: 94,
      clubPosition: 'ST',
      nationalityName: 'Norway',
      preferredFoot: 'Left',
      teamName: 'Manchester City',
      nationalTeamName: 'Norway',
      loanedToTeamName: '',
      shooting: 91,
      passing: 69,
      dribbling: 80,
      physical: 88,
      attackingCrossing: 62,
      attackingHeadingAccuracy: 85,
      skillFkAccuracy: 75,
      movementAcceleration: 82,
      movementSprintSpeed: 92,
      powerStamina: 78,
      powerStrength: 93,
      defendingStandingTackle: 47,
      defendingSlidingTackle: 29,
      goalkeepingDiving: 7,
      goalkeepingHandling: 14,
      goalkeepingPositioning: 11,
      goalkeepingReflexes: 7,
      jumping: 88,
      finishing: 96,
      shotPower: 94,
      longShots: 83,
      volleys: 90,
      penalties: 90,
      curve: 85,
      agility: 66,
      balance: 71,
      ballControl: 79,
      shortPassing: 77,
      longPassing: 58,
      vision: 75,
      interceptions: 43,
      defAwareness: 42,
      defending: 49
    };
    const component = createComponent(
      {},
      {
        mapImportedPlayer: (_source: ImportedPlayerRecord, currentPlayer: Record<string, any>) => ({
          ...currentPlayer,
          name: 'Erling Haaland'
        })
      }
    );

    component.importedPlayers = [secondRecord, firstRecord];

    component.openPlayerEditPopup(19);
    component.importSelectedPlayer(firstRecord);

    expect(component.popupImportedHeadshotUrl).toBe('https://example.com/headshots/haaland.png');
    expect(component.selectedImportedPlayer).toBe(firstRecord);
  });
});
