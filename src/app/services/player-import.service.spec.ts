/// <reference types="jasmine" />

import { PlayerImportService, ImportedPlayerRecord } from './player-import.service';

describe('PlayerImportService', () => {
  let service: PlayerImportService;

  beforeEach(() => {
    service = new PlayerImportService();
  });

  it('matches imported names without requiring exact diacritics', () => {
    const players = [createImportedPlayer({ shortName: 'Joao Felix' })];

    const matches = service.searchPlayers(players, 'joão');

    expect(matches.length).toBe(1);
    expect(matches[0].shortName).toBe('Joao Felix');
  });

  it('matches tokenized search across name and nationality', () => {
    const players = [
      createImportedPlayer({ shortName: 'Luka Modric', nationalityName: 'Croatia' }),
      createImportedPlayer({ shortName: 'Luka Romero', nationalityName: 'Argentina' })
    ];

    const matches = service.searchPlayers(players, 'luka croat');

    expect(matches.length).toBe(1);
    expect(matches[0].shortName).toBe('Luka Modric');
  });

  it('matches by imported player id as a fallback', () => {
    const players = [
      createImportedPlayer({ playerId: '9001', shortName: 'Player A' }),
      createImportedPlayer({ playerId: '9123', shortName: 'Player B' })
    ];

    const matches = service.searchPlayers(players, '9123');

    expect(matches.length).toBe(1);
    expect(matches[0].shortName).toBe('Player B');
  });
});

function createImportedPlayer(overrides: Partial<ImportedPlayerRecord> = {}): ImportedPlayerRecord {
  return {
    playerId: '1000',
    shortName: 'Test Player',
    overall: 70,
    age: 24,
    heightCm: 180,
    weightKg: 75,
    clubPosition: 'CM',
    nationalityName: 'Portugal',
    preferredFoot: 'Right',
    shooting: 60,
    passing: 65,
    dribbling: 68,
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
    ...overrides
  };
}