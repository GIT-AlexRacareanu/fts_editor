import { PlayerImportService, ImportedPlayerRecord } from './player-import.service';

function createImportedPlayer(overrides: Partial<ImportedPlayerRecord> = {}): ImportedPlayerRecord {
  return {
    shortName: 'Player',
    overall: 70,
    nationalityName: 'Nation',
    nationalTeamName: '',
    teamName: 'Club',
    loanedToTeamName: '',
    clubPosition: 'CM',
    preferredFoot: 'Right',
    age: 24,
    heightCm: 180,
    weightKg: 75,
    movementAcceleration: 60,
    movementSprintSpeed: 60,
    powerStamina: 60,
    powerStrength: 60,
    defendingStandingTackle: 60,
    passing: 60,
    physical: 60,
    dribbling: 60,
    shooting: 60,
    attackingCrossing: 60,
    skillFkAccuracy: 60,
    shortPassing: 60,
    attackingHeadingAccuracy: 60,
    goalkeepingDiving: 10,
    goalkeepingHandling: 10,
    goalkeepingPositioning: 10,
    goalkeepingReflexes: 10,
    agility: 60,
    balance: 60,
    ballControl: 60,
    curve: 60,
    defending: 60,
    defendingSlidingTackle: 60,
    finishing: 60,
    interceptions: 60,
    jumping: 60,
    longPassing: 60,
    longShots: 60,
    penalties: 60,
    shotPower: 60,
    vision: 60,
    volleys: 60,
    defAwareness: 60,
    hairColorCode: 0,
    skinToneCode: 0,
    sourceRowIndex: 0,
    ...overrides
  };
}

describe('PlayerImportService foot mapping', () => {
  it('maps imported preferred foot to the corrected stored values', () => {
    const service = new PlayerImportService();
    const basePlayer = {
      name: 'Base', pos: 0, foot: 255, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const mappedLeft = service.mapImportedPlayer(createImportedPlayer({ preferredFoot: 'Left' }), basePlayer as any);
    const mappedRight = service.mapImportedPlayer(createImportedPlayer({ preferredFoot: 'Right' }), basePlayer as any);

    expect(mappedLeft.foot).toBe(0);
    expect(mappedRight.foot).toBe(1);
  });
});