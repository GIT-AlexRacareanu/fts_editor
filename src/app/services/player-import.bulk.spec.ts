/// <reference types="jasmine" />

import { Player } from '../models/player.model';
import { calculatePlayerOvr } from './player.service';
import { ImportedPlayerRecord, PlayerImportService } from './player-import.service';

describe('PlayerImportService bulk import mapping', () => {
  it('keeps the template year and appearance when bulk import disables year mapping', () => {
    const service = new PlayerImportService();
    const basePlayer: Player = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 1998,
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

  it('maps FK and goalkeeper stats from compact import aliases', () => {
    const service = new PlayerImportService();
    const csv = [
      'knownas,club,position,freeKick,gkdiving,gkhandling,gkpositioning,gkreflexes',
      'Shot Stopper,Test Club,GK,63,71,69,67,73'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(1);
    expect(parsed[0].skillFkAccuracy).toBe(63);
    expect(parsed[0].goalkeepingDiving).toBe(71);
    expect(parsed[0].goalkeepingHandling).toBe(69);
    expect(parsed[0].goalkeepingPositioning).toBe(67);
    expect(parsed[0].goalkeepingReflexes).toBe(73);
  });

  it('maps reflexes to GKS, handling to GKH, and diving to GKP', () => {
    const service = new PlayerImportService();
    const basePlayer: Player = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 1998,
      skin: 2, skin_tone: 1, head_type: 3, hair_type: 4, hair: 5, beard_type: 6,
      boots: 7, mangas: 8, guantes: 9,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };
    const imported = createImportedPlayer({
      clubPosition: 'GK',
      skillFkAccuracy: 57,
      goalkeepingDiving: 80,
      goalkeepingHandling: 76,
      goalkeepingPositioning: 74,
      goalkeepingReflexes: 70
    });

    const mapped = service.mapImportedPlayer(imported, basePlayer, { includeYear: false });

    expect(mapped.FK).toBe(57);
    expect(mapped.GKS).toBe(70);
    expect(mapped.GKH).toBe(76);
    expect(mapped.GKP).toBe(80);
  });

  it('maps heading accuracy to HEA', () => {
    const service = new PlayerImportService();
    const basePlayer: Player = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 1998,
      skin: 2, skin_tone: 1, head_type: 3, hair_type: 4, hair: 5, beard_type: 6,
      boots: 7, mangas: 8, guantes: 9,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };
    const imported = createImportedPlayer({
      attackingHeadingAccuracy: 83,
      jumping: 91
    });

    const mapped = service.mapImportedPlayer(imported, basePlayer, { includeYear: false });

    expect(mapped.HEA).toBe(83);
  });

  it('applies the same OVR correction during bulk import mapping', () => {
    const service = new PlayerImportService();
    const basePlayer: Player = {
      name: 'Base', pos: 11, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 1998,
      skin: 2, skin_tone: 1, head_type: 3, hair_type: 4, hair: 5, beard_type: 6,
      boots: 7, mangas: 8, guantes: 9,
      ACC: 74, SPD: 72, STA: 76, STR: 68, TAC: 60, CON: 62, SHO: 58,
      CRO: 64, FK: 55, PAS: 61, HEA: 50, GKS: 10, GKH: 10, GKP: 10
    };
    const imported = createImportedPlayer({
      overall: 76,
      clubPosition: 'CM',
      dribbling: 62,
      passing: 61
    });

    const mapped = service.mapImportedPlayer(imported, basePlayer, { includeYear: false });

    expect(calculatePlayerOvr(mapped)).toBeGreaterThanOrEqual(76);
    expect(mapped.CON).toBeGreaterThan(62);
    expect(mapped.PAS).toBeGreaterThan(61);
    expect(mapped.year).toBe(1998);
  });
});

function createImportedPlayer(overrides: Partial<ImportedPlayerRecord> = {}): ImportedPlayerRecord {
  return {
    shortName: 'Test Player',
    lastName: '',
    overall: 70,
    age: 24,
    heightCm: 180,
    weightKg: 75,
    clubPosition: 'CM',
    nationalityName: 'Portugal',
    preferredFoot: 'Right',
    teamName: 'Test Club',
    shooting: 60,
    passing: 65,
    dribbling: 68,
    physical: 66,
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
    defending: 50,
    ...overrides
  };
}