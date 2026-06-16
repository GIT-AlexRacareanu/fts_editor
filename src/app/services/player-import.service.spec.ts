/// <reference types="jasmine" />

import { calculatePlayerOvr } from './player.service';
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

  it('matches by imported player overall as a fallback', () => {
    const players = [
      createImportedPlayer({ shortName: 'Player A', overall: 81 }),
      createImportedPlayer({ shortName: 'Player B', overall: 85 })
    ];

    const matches = service.searchPlayers(players, '85');

    expect(matches.length).toBe(1);
    expect(matches[0].shortName).toBe('Player B');
  });

  it('parses tab-delimited FIFA export headers and numeric text values', () => {
    const tsv = [
      'Name\tAcceleration\tSprint Speed\tPositioning\tFinishing\tShot Power\tLong Shots\tVolleys\tPenalties\tVision\tCrossing\tFree Kick Accuracy\tShort Passing\tLong Passing\tCurve\tDribbling\tAgility\tBalance\tReactions\tBall Control\tComposure\tInterceptions\tHeading Accuracy\tDef Awareness\tStanding Tackle\tSliding Tackle\tJumping\tStamina\tStrength\tAggression\tPosition\tPreferred foot\tHeight\tWeight\tAge\tNation\tGK Diving\tGK Handling\tGK Kicking\tGK Positioning\tGK Reflexes',
      'Mohamed Salah\t88\t89\t93\t94\t83\t78\t83\t88\t86\t89\t69\t88\t81\t88\t90\t86\t91\t94\t90\t93\t55\t59\t38\t43\t41\t79\t88\t75\t63\tRM\tLeft\t175cm / 5\'9"\t72kg / 159lb\t33\tEgypt\t\t\t\t\t'
    ].join('\n');

    const parsed = service.parseCsv(tsv);

    expect(parsed.length).toBe(1);
    expect(parsed[0].shortName).toBe('Mohamed Salah');
    expect(parsed[0].movementAcceleration).toBe(88);
    expect(parsed[0].movementSprintSpeed).toBe(89);
    expect(parsed[0].heightCm).toBe(175);
    expect(parsed[0].weightKg).toBe(72);
    expect(parsed[0].clubPosition).toBe('RM');
    expect(parsed[0].preferredFoot).toBe('Left');
    expect(parsed[0].jumping).toBe(79);
  });

  it('parses FC face-stat exports when detail columns are missing', () => {
    const csv = [
      'Name,OVR,PAC,SHO,PAS,DRI,DEF,PHY,Position,Preferred Foot,Height,Weight,Age,Nationality',
      'Sample Player,77,80,74,71,78,66,73,CAM,Right,"5\'11\" / 180cm","176lb / 80kg",24,Portugal'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(1);
    expect(parsed[0].overall).toBe(77);
    expect(parsed[0].shooting).toBe(74);
    expect(parsed[0].passing).toBe(71);
    expect(parsed[0].dribbling).toBe(78);
    expect(parsed[0].movementAcceleration).toBe(80);
    expect(parsed[0].movementSprintSpeed).toBe(80);
    expect(parsed[0].defendingStandingTackle).toBe(66);
    expect(parsed[0].defendingSlidingTackle).toBe(66);
    expect(parsed[0].powerStamina).toBe(73);
    expect(parsed[0].powerStrength).toBe(73);
    expect(parsed[0].heightCm).toBe(180);
    expect(parsed[0].weightKg).toBe(80);
    expect(parsed[0].clubPosition).toBe('CAM');
    expect(parsed[0].preferredFoot).toBe('Right');
    expect(parsed[0].nationalityName).toBe('Portugal');
  });

  it('parses import_2 compact headers including knownas and overallrating', () => {
    const csv = [
      'knownas,age,height,weight,overallrating,agility,balance,ballcontrol,crossing,curve,dribbling,finishing,freekickaccuracy,headingaccuracy,interceptions,longpassing,longshots,penalties,reactions,shortpassing,shotpower,slidingtackle,sprintspeed,stamina,standingtackle,strength,vision,volleys,sho,pas,dri,def,phy,nation,club,national_team,loanedto_club',
      'Erling Haaland,24,195,94,91,71,69,83,58,77,79,96,62,85,43,66,83,90,95,78,94,29,92,78,47,93,75,90,91,69,80,49,88,Norway,Manchester City,Norway,'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(1);
    expect(parsed[0].shortName).toBe('Erling Haaland');
    expect(parsed[0].overall).toBe(91);
    expect(parsed[0].movementAcceleration).toBe(92);
    expect(parsed[0].movementSprintSpeed).toBe(92);
    expect(parsed[0].skillFkAccuracy).toBe(62);
    expect(parsed[0].attackingHeadingAccuracy).toBe(85);
    expect(parsed[0].shortPassing).toBe(78);
    expect(parsed[0].longPassing).toBe(66);
    expect(parsed[0].shotPower).toBe(94);
    expect(parsed[0].defendingStandingTackle).toBe(47);
    expect(parsed[0].defendingSlidingTackle).toBe(29);
    expect(parsed[0].powerStrength).toBe(88);
    expect(parsed[0].defending).toBe(49);
    expect(parsed[0].teamName).toBe('Manchester City');
    expect(parsed[0].nationalTeamName).toBe('Norway');
    expect(parsed[0].loanedToTeamName).toBe('');
  });

  it('includes club, national team, and loan destination names in the import team options', () => {
    const teamNames = service.getAvailableTeamNames([
      createImportedPlayer({ teamName: 'Arsenal', nationalTeamName: 'England', loanedToTeamName: 'Sunderland' }),
      createImportedPlayer({ teamName: 'Chelsea', nationalTeamName: 'England' })
    ]);

    expect(teamNames).toEqual(['Arsenal', 'Chelsea', 'England', 'Sunderland']);
  });

  it('filters club imports to active squad plus inbound loans, excluding outbound loans', () => {
    const matches = service.filterByTeam([
      createImportedPlayer({ shortName: 'Home Squad', teamName: 'Arsenal' }),
      createImportedPlayer({ shortName: 'Loaned Out', teamName: 'Arsenal', loanedToTeamName: 'Sunderland' }),
      createImportedPlayer({ shortName: 'Loaned In', teamName: 'Chelsea', loanedToTeamName: 'Arsenal' })
    ], 'Arsenal');

    expect(matches.map((player) => player.shortName)).toEqual(['Home Squad', 'Loaned In']);
  });

  it('filters national team imports from the dedicated national team column', () => {
    const matches = service.filterByTeam([
      createImportedPlayer({ shortName: 'International One', teamName: 'Arsenal', nationalTeamName: 'England' }),
      createImportedPlayer({ shortName: 'International Two', teamName: 'Chelsea', nationalTeamName: 'England' }),
      createImportedPlayer({ shortName: 'Club Only', teamName: 'England FC' })
    ], 'England');

    expect(matches.map((player) => player.shortName)).toEqual(['International One', 'International Two']);
  });

  it('parses knownus as the short name alias', () => {
    const csv = [
      'knownus,overallrating,sho,pas,dri,def,phy,sprintspeed,stamina,freekickaccuracy,headingaccuracy,crossing,nation',
      'Alias Player,80,70,71,72,73,74,75,76,67,68,69,Portugal'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(1);
    expect(parsed[0].shortName).toBe('Alias Player');
    expect(parsed[0].overall).toBe(80);
  });

  it('keeps the original import row index when no id column exists', () => {
    const csv = [
      'knownus,overallrating,club',
      'First Row,70,Arsenal',
      'Second Row,90,Arsenal'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(2);
    expect(parsed[0].shortName).toBe('Second Row');
    expect(parsed[0].sourceRowIndex).toBe(1);
    expect(parsed[1].shortName).toBe('First Row');
    expect(parsed[1].sourceRowIndex).toBe(0);
  });

  it('maps numeric import position codes from position_1 using the configured importer mapper', () => {
    const csv = [
      'knownas,overallrating,club,position_1',
      'Target Striker,90,Arsenal,25',
      'Wide Creator,88,Arsenal,27',
      'Anchor Midfielder,86,Arsenal,10'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(3);
    expect(parsed[0].shortName).toBe('Target Striker');
    expect(parsed[0].clubPosition).toBe('ST');
    expect(parsed[1].clubPosition).toBe('LW');
    expect(parsed[2].clubPosition).toBe('CDM');
  });

  it('parses imperial-first height and weight formats', () => {
    const csv = [
      'Name,Height,Weight,Position,Preferred foot,Nation',
      'Format Player,"5\'9\" / 175cm","159lb / 72kg",CM,Left,Spain'
    ].join('\n');

    const parsed = service.parseCsv(csv);

    expect(parsed.length).toBe(1);
    expect(parsed[0].heightCm).toBe(175);
    expect(parsed[0].weightKg).toBe(72);
  });

  it('moves RM and LM imports to a wide attacking role when that gives the better OVR', () => {
    const basePlayer = {
      name: 'Base', pos: 11, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 84, SPD: 86, STA: 58, STR: 79, TAC: 34, CON: 88, SHO: 83,
      CRO: 72, FK: 68, PAS: 54, HEA: 74, GKS: 20, GKH: 20, GKP: 20
    };

    const wideOverrides = {
      shooting: 83,
      dribbling: 88,
      powerStrength: 79,
      attackingHeadingAccuracy: 74,
      passing: 54,
      powerStamina: 58,
      movementAcceleration: 84,
      movementSprintSpeed: 86,
      defending: 34,
      defendingStandingTackle: 34,
      defendingSlidingTackle: 34
    };

    const rmImported = createImportedPlayer({ clubPosition: 'RM', preferredFoot: 'Right', ...wideOverrides });
    const lmImported = createImportedPlayer({ clubPosition: 'LM', preferredFoot: 'Left', ...wideOverrides });

    const rmMapped = service.mapImportedPlayer(rmImported, basePlayer);
    const lmMapped = service.mapImportedPlayer(lmImported, basePlayer);

    expect(rmMapped.pos).toBe(21);
    expect(lmMapped.pos).toBe(20);
  });

  it('keeps LW and RW imports on their original wide attacking roles', () => {
    const basePlayer = {
      name: 'Base', pos: 20, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 77, SPD: 75, STA: 78, STR: 64, TAC: 63, CON: 81, SHO: 61,
      CRO: 84, FK: 73, PAS: 80, HEA: 58, GKS: 20, GKH: 20, GKP: 20
    };

    const rwImported = createImportedPlayer({ clubPosition: 'RW', preferredFoot: 'Right' });
    const lwImported = createImportedPlayer({ clubPosition: 'LW', preferredFoot: 'Left' });

    const rwMapped = service.mapImportedPlayer(rwImported, basePlayer);
    const lwMapped = service.mapImportedPlayer(lwImported, basePlayer);

    expect(rwMapped.pos).toBe(21);
    expect(lwMapped.pos).toBe(20);
  });

  it('does not flip a wide import from left to right or right to left', () => {
    const leftBasePlayer = {
      name: 'Left Base', pos: 20, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 77, SPD: 75, STA: 78, STR: 64, TAC: 63, CON: 81, SHO: 61,
      CRO: 84, FK: 73, PAS: 80, HEA: 58, GKS: 20, GKH: 20, GKP: 20
    };
    const rightBasePlayer = {
      ...leftBasePlayer,
      name: 'Right Base',
      pos: 21
    };

    const lwMapped = service.mapImportedPlayer(createImportedPlayer({ clubPosition: 'LW', preferredFoot: 'Left' }), leftBasePlayer);
    const rwMapped = service.mapImportedPlayer(createImportedPlayer({ clubPosition: 'RW', preferredFoot: 'Right' }), rightBasePlayer);

    expect(lwMapped.pos).toBe(20);
    expect(rwMapped.pos).toBe(21);
  });

  it('maps HEA using the import stat formula from heading accuracy', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const imported = createImportedPlayer({ attackingHeadingAccuracy: 60, jumping: 80 });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(mapped.HEA).toBe(60);
  });

  it('maps imported gameplay attributes using the import stat formula', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const imported = createImportedPlayer({
      movementAcceleration: 88,
      movementSprintSpeed: 89,
      finishing: 20,
      shotPower: 30,
      volleys: 10,
      penalties: 15,
      skillFkAccuracy: 25,
      attackingCrossing: 10,
      curve: 12,
      dribbling: 11,
      agility: 12,
      balance: 13,
      ballControl: 14,
      longPassing: 17,
      shortPassing: 18,
      vision: 19,
      interceptions: 6,
      defAwareness: 7,
      defendingStandingTackle: 8,
      defendingSlidingTackle: 9
    });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(mapped.ACC).toBe(88);
    expect(mapped.SPD).toBe(89);
    expect(mapped.SHO).toBe(25);
    expect(mapped.FK).toBe(25);
    expect(mapped.CRO).toBe(10);
    expect(mapped.CON).toBe(13);
    expect(mapped.PAS).toBe(18);
    expect(mapped.TAC).toBe(8);
  });

  it('maps full names to initial plus surname format', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const imported = createImportedPlayer({ shortName: 'Mohamed Salah' });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(mapped.name).toBe('M. Salah');
  });

  it('raises goalkeeper stats when the mapped OVR is below the imported OVR', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 190, peso: 82, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 40, SPD: 42, STA: 45, STR: 60, TAC: 20, CON: 25, SHO: 15,
      CRO: 10, FK: 12, PAS: 18, HEA: 30, GKS: 70, GKH: 71, GKP: 72
    };

    const imported = createImportedPlayer({
      overall: 80,
      clubPosition: 'GK',
      goalkeepingReflexes: 70,
      goalkeepingHandling: 71,
      goalkeepingDiving: 72
    });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(calculatePlayerOvr(mapped)).toBeGreaterThanOrEqual(80);
    expect(mapped.GKS).toBeGreaterThan(70);
    expect(mapped.GKH).toBeGreaterThan(71);
    expect(mapped.GKP).toBeGreaterThan(72);
  });

  it('lowers defender import stats when the mapped OVR is above the imported OVR', () => {
    const basePlayer = {
      name: 'Base', pos: 6, foot: 0, nat: 0, estatura: 188, peso: 84, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 65, SPD: 67, STA: 72, STR: 84, TAC: 86, CON: 58, SHO: 40,
      CRO: 45, FK: 30, PAS: 62, HEA: 80, GKS: 10, GKH: 10, GKP: 10
    };

    const imported = createImportedPlayer({
      overall: 74,
      clubPosition: 'CB',
      defending: 86,
      defendingStandingTackle: 86,
      defendingSlidingTackle: 86,
      attackingHeadingAccuracy: 80,
      powerStrength: 84
    });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(calculatePlayerOvr(mapped)).toBeLessThanOrEqual(74);
    expect(mapped.TAC).toBeLessThan(86);
    expect(mapped.HEA).toBeLessThan(80);
    expect(mapped.STR).toBeLessThan(84);
  });

  it('applies midfield OVR correction to stamina, control, and passing', () => {
    const basePlayer = {
      name: 'Base', pos: 11, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 74, SPD: 72, STA: 76, STR: 68, TAC: 60, CON: 62, SHO: 58,
      CRO: 64, FK: 55, PAS: 61, HEA: 50, GKS: 10, GKH: 10, GKP: 10
    };

    const imported = createImportedPlayer({
      overall: 76,
      clubPosition: 'CM',
      dribbling: 62,
      passing: 61
    });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(calculatePlayerOvr(mapped)).toBeGreaterThanOrEqual(76);
    expect(mapped.STA).toBeGreaterThan(76);
    expect(mapped.CON).toBeGreaterThan(62);
    expect(mapped.PAS).toBeGreaterThan(61);
  });

  it('applies attacker OVR correction to strength, dribbling, shooting, and heading', () => {
    const basePlayer = {
      name: 'Base', pos: 19, foot: 0, nat: 0, estatura: 182, peso: 78, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 78, SPD: 80, STA: 74, STR: 72, TAC: 35, CON: 66, SHO: 67,
      CRO: 58, FK: 50, PAS: 60, HEA: 62, GKS: 10, GKH: 10, GKP: 10
    };

    const imported = createImportedPlayer({
      overall: 79,
      clubPosition: 'ST',
      dribbling: 66,
      shooting: 67
    });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(calculatePlayerOvr(mapped)).toBeGreaterThanOrEqual(79);
    expect(mapped.STR).toBeGreaterThan(72);
    expect(mapped.CON).toBeGreaterThan(66);
    expect(mapped.SHO).toBeGreaterThan(67);
    expect(mapped.HEA).toBeGreaterThan(62);
  });

  it('maps multipart surnames by abbreviating only the first name', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const imported = createImportedPlayer({ shortName: 'Virgil van Dijk' });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(mapped.name).toBe('V. van Dijk');
  });

  it('keeps the full imported name when it is 10 characters or shorter', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const imported = createImportedPlayer({ shortName: 'Joao Felix' });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(mapped.name).toBe('Joao Felix');
  });

  it('replaces special characters with Latin base letters during import name mapping', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const imported = createImportedPlayer({ shortName: 'Ștefan Ødegaard' });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(mapped.name).toBe('S. Odegard');
  });

  it('strips Romanian diacritics to ASCII during import name mapping', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const imported = createImportedPlayer({ shortName: 'Răzvan Mățel' });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(mapped.name).toBe('R. Matel');
  });

  it('keeps mapped game names within 16 characters including spaces', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const imported = createImportedPlayer({ shortName: 'Alexandru Constantin Popescu' });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(mapped.name.length).toBeLessThanOrEqual(16);
  });

  it('maps Holland and The Netherlands to Netherlands nationality', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 84, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const hollandImported = createImportedPlayer({ nationalityName: 'Holland' });
    const theNetherlandsImported = createImportedPlayer({ nationalityName: 'The Netherlands' });

    const hollandMapped = service.mapImportedPlayer(hollandImported, basePlayer);
    const theNetherlandsMapped = service.mapImportedPlayer(theNetherlandsImported, basePlayer);

    expect(hollandMapped.nat).toBe(3);
    expect(theNetherlandsMapped.nat).toBe(3);
  });

  it('keeps imported gameplay attributes at minimum 1', () => {
    const basePlayer = {
      name: 'Base', pos: 0, foot: 0, nat: 0, estatura: 180, peso: 75, birthDay: 1, birthMonth: 1, year: 2000,
      skin: 0, skin_tone: 0, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 0, guantes: 0,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };

    const imported = createImportedPlayer({
      movementAcceleration: 0,
      movementSprintSpeed: 0,
      powerStamina: 0,
      powerStrength: 0,
      defendingStandingTackle: 0,
      defendingSlidingTackle: 0,
      interceptions: 0,
      defAwareness: 0,
      dribbling: 0,
      ballControl: 0,
      agility: 0,
      finishing: 0,
      shotPower: 0,
      longShots: 0,
      attackingCrossing: 0,
      skillFkAccuracy: 0,
      shortPassing: 0,
      longPassing: 0,
      vision: 0,
      attackingHeadingAccuracy: 0,
      jumping: 0,
      goalkeepingReflexes: 0,
      goalkeepingHandling: 0,
      goalkeepingPositioning: 0
    });

    const mapped = service.mapImportedPlayer(imported, basePlayer);

    expect(mapped.ACC).toBe(1);
    expect(mapped.SPD).toBe(1);
    expect(mapped.STA).toBe(1);
    expect(mapped.STR).toBe(1);
    expect(mapped.TAC).toBe(1);
    expect(mapped.CON).toBe(1);
    expect(mapped.SHO).toBe(1);
    expect(mapped.CRO).toBe(1);
    expect(mapped.FK).toBe(1);
    expect(mapped.PAS).toBe(1);
    expect(mapped.HEA).toBe(1);
    expect(mapped.GKS).toBe(1);
    expect(mapped.GKH).toBe(1);
    expect(mapped.GKP).toBe(1);
  });

  it('parses the real import asset file', async () => {
    const response = await fetch('/assets/import/fc-player-import.csv');

    expect(response.ok).toBeTrue();

    const csvText = await response.text();

    const parsed = service.parseCsv(csvText);

    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0].shortName.length).toBeGreaterThan(0);
    expect(parsed[0].clubPosition.length).toBeGreaterThan(0);
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
    nationalTeamName: '',
    loanedToTeamName: '',
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