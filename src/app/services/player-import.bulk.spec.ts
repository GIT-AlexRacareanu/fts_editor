/// <reference types="jasmine" />

import { Player } from '../models/player.model';
import { ImportedPlayerRecord, PlayerImportService } from './player-import.service';

describe('PlayerImportService bulk import mapping', () => {
  it('keeps the template year and appearance when bulk import disables year mapping', () => {
    const service = new PlayerImportService();
    const basePlayer: Player = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, year: 1998,
      skin: 2, skin_tone: 1, head_type: 3, hair_type: 4, hair: 5, beard_type: 6,
      boots: 7, mangas: 8, guantes: 9,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };
    const imported = createImportedPlayer({ age: 20, shortName: 'Mohamed Salah' });

    const mapped = service.mapImportedPlayer(imported, basePlayer, { includeYear: false });

    expect(mapped.year).toBe(1998);
    expect(mapped.skin).toBe(2);
    expect(mapped.boots).toBe(7);
    expect(mapped.name).toBe('M. Salah');
    expect(mapped.pos).toBe(imported.clubPosition === 'CM' ? 11 : mapped.pos);
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
    ...overrides
  };
}