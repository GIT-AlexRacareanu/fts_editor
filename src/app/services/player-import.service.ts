import { Injectable } from '@angular/core';
import { NATIONALITY_NAMES_BY_ID } from '../data/nationalities';
import { Player } from '../models/player.model';

export interface ImportedPlayerRecord {
  playerId: string;
  shortName: string;
  overall: number;
  age: number;
  heightCm: number;
  weightKg: number;
  clubPosition: string;
  nationalityName: string;
  preferredFoot: string;
  shooting: number;
  passing: number;
  dribbling: number;
  attackingCrossing: number;
  attackingHeadingAccuracy: number;
  skillFkAccuracy: number;
  movementAcceleration: number;
  movementSprintSpeed: number;
  powerStamina: number;
  powerStrength: number;
  defendingStandingTackle: number;
  defendingSlidingTackle: number;
  goalkeepingDiving: number;
  goalkeepingHandling: number;
  goalkeepingPositioning: number;
  goalkeepingReflexes: number;
  jumping: number;
  finishing: number;
  shotPower: number;
  longShots: number;
  volleys: number;
  penalties: number;
  curve: number;
  agility: number;
  balance: number;
  ballControl: number;
  shortPassing: number;
  longPassing: number;
  vision: number;
  interceptions: number;
  defAwareness: number;
}

export interface ImportPlayerMapOptions {
  includeYear?: boolean;
}

const POSITION_MAP: Record<string, number> = {
  GK: 0,
  LB: 1,
  LWB: 1,
  RB: 2,
  RWB: 2,
  LSW: 3,
  RSW: 4,
  LCB: 5,
  CB: 6,
  RCB: 7,
  CDM: 8,
  RDM: 9,
  LDM: 10,
  CM: 11,
  LCM: 12,
  RCM: 13,
  LAM: 14,
  RAM: 15,
  RM: 16,
  LM: 17,
  CAM: 18,
  ST: 19,
  LS: 19,
  RS: 19,
  LW: 20,
  LF: 20,
  RW: 21,
  RF: 21,
  CF: 22
};

const NATIONALITY_ALIASES: Record<string, string> = {
  usa: 'united states',
  unitedstates: 'united states',
  holland: 'netherlands',
  'the netherlands': 'netherlands',
  'korea republic': 'south korea',
  'korea rp': 'south korea',
  'republic of korea': 'south korea',
  'korea dpr': 'north korea',
  'ivory coast': 'cote divoire',
  'ireland republic': 'republic of ireland',
  'ir rep': 'republic of ireland',
  'macedonia fyrom': 'north macedonia'
};

@Injectable({ providedIn: 'root' })
export class PlayerImportService {
  private readonly nationalityIndex = new Map<string, number>(
    Object.entries(NATIONALITY_NAMES_BY_ID).map(([id, name]) => [this.normalizeKey(name), Number(id)])
  );

  parseCsv(csvText: string): ImportedPlayerRecord[] {
    const rows = this.parseCsvRows(csvText);

    if (rows.length < 2) {
      return [];
    }

    const [headerRow, ...dataRows] = rows;
    const headerIndexes = new Map(headerRow.map((header, index) => [this.normalizeKey(header), index]));

    return dataRows
      .filter((row) => row.some((value) => value.trim().length > 0))
      .map((row) => this.toImportedPlayerRecord(row, headerIndexes))
      .filter((player): player is ImportedPlayerRecord => player !== null)
      .sort((left, right) => {
        if (right.overall !== left.overall) {
          return right.overall - left.overall;
        }

        return left.shortName.localeCompare(right.shortName);
      });
  }

  searchPlayers(players: ImportedPlayerRecord[], query: string): ImportedPlayerRecord[] {
    const normalizedQuery = this.normalizeKey(query);

    if (!normalizedQuery) {
      return players;
    }

    const queryTokens = normalizedQuery.split(' ').filter((token) => token.length > 0);

    return players.filter((player) => {
      const searchableText = this.normalizeKey([
        player.shortName,
        player.playerId,
        player.nationalityName,
        player.clubPosition,
        String(player.overall)
      ].join(' '));

      return queryTokens.every((token) => searchableText.includes(token));
    });
  }

  mapImportedPlayer(
    source: ImportedPlayerRecord,
    currentPlayer: Player,
    options: ImportPlayerMapOptions = {}
  ): Player {
    const { includeYear = true } = options;
    const shooting = source.shooting;
    const freeKick = source.skillFkAccuracy;
    const crossing = source.attackingCrossing;
    const dribblingControl = source.dribbling;
    const heading = source.attackingHeadingAccuracy;
    const passing = source.passing;
    const tackling = this.averageStats(source.defendingSlidingTackle, source.defendingStandingTackle);

    return {
      ...currentPlayer,
      name: this.toGameName(source.shortName, currentPlayer.name),
      pos: this.mapPosition(source, currentPlayer.pos),
      foot: this.mapFoot(source.preferredFoot, currentPlayer.foot),
      nat: this.mapNationality(source.nationalityName, currentPlayer.nat),
      estatura: this.clampByte(source.heightCm, currentPlayer.estatura),
      peso: this.clampByte(source.weightKg, currentPlayer.peso),
      hiddenFromTransferMarket: 0,
      isIconLegend: 0,
      birthDay: 1,
      birthMonth: 1,
      year: includeYear ? this.mapYear(source.age, currentPlayer.year) : currentPlayer.year,
      ACC: this.clampStat(source.movementAcceleration, currentPlayer.ACC),
      SPD: this.clampStat(source.movementSprintSpeed, currentPlayer.SPD),
      STA: this.clampStat(source.powerStamina, currentPlayer.STA),
      STR: this.clampStat(source.powerStrength, currentPlayer.STR),
      TAC: this.clampStat(tackling, currentPlayer.TAC),
      CON: this.clampStat(dribblingControl, currentPlayer.CON),
      SHO: this.clampStat(shooting, currentPlayer.SHO),
      CRO: this.clampStat(crossing, currentPlayer.CRO),
      FK: this.clampStat(freeKick, currentPlayer.FK),
      PAS: this.clampStat(passing, currentPlayer.PAS),
      HEA: this.clampStat(heading, currentPlayer.HEA),
      GKS: this.clampStat(source.goalkeepingReflexes, currentPlayer.GKS),
      GKH: this.clampStat(source.goalkeepingHandling, currentPlayer.GKH),
      GKP: this.clampStat(source.goalkeepingPositioning, currentPlayer.GKP)
    };
  }

  private toImportedPlayerRecord(row: string[], headerIndexes: Map<string, number>): ImportedPlayerRecord | null {
    const shortName = this.getFieldByAliases(row, headerIndexes, ['short_name', 'name']);

    if (!shortName) {
      return null;
    }

    const finishing = this.getNumberFieldByAliases(row, headerIndexes, ['finishing']);
    const shotPower = this.getNumberFieldByAliases(row, headerIndexes, ['shot_power', 'shot power']);
    const longShots = this.getNumberFieldByAliases(row, headerIndexes, ['long_shots', 'long shots']);
    const volleys = this.getNumberFieldByAliases(row, headerIndexes, ['volleys']);
    const penalties = this.getNumberFieldByAliases(row, headerIndexes, ['penalties']);
    const shooting = this.averageNonZero([
      this.getNumberFieldByAliases(row, headerIndexes, ['shooting']),
      finishing,
      shotPower,
      longShots,
      volleys,
      penalties
    ]);

    const shortPassing = this.getNumberFieldByAliases(row, headerIndexes, ['short_passing', 'short passing']);
    const longPassing = this.getNumberFieldByAliases(row, headerIndexes, ['long_passing', 'long passing']);
    const vision = this.getNumberFieldByAliases(row, headerIndexes, ['vision']);
    const passing = this.averageNonZero([
      this.getNumberFieldByAliases(row, headerIndexes, ['passing']),
      shortPassing,
      longPassing,
      vision
    ]);

    const headingAccuracy = this.getNumberFieldByAliases(row, headerIndexes, ['attacking_heading_accuracy', 'heading_accuracy', 'heading accuracy']);
    const curve = this.getNumberFieldByAliases(row, headerIndexes, ['curve']);
    const agility = this.getNumberFieldByAliases(row, headerIndexes, ['agility']);
    const balance = this.getNumberFieldByAliases(row, headerIndexes, ['balance']);
    const ballControl = this.getNumberFieldByAliases(row, headerIndexes, ['ball_control', 'ball control']);
    const interceptions = this.getNumberFieldByAliases(row, headerIndexes, ['interceptions']);
    const defAwareness = this.getNumberFieldByAliases(row, headerIndexes, ['def_awareness', 'def awareness']);

    return {
      playerId: this.getFieldByAliases(row, headerIndexes, ['player_id']),
      shortName,
      overall: this.getNumberFieldByAliases(row, headerIndexes, ['overall']),
      age: this.getNumberFieldByAliases(row, headerIndexes, ['age']),
      heightCm: this.getNumberFieldByAliases(row, headerIndexes, ['height_cm', 'height']),
      weightKg: this.getNumberFieldByAliases(row, headerIndexes, ['weight_kg', 'weight']),
      clubPosition: this.getFieldByAliases(row, headerIndexes, ['club_position', 'position']),
      nationalityName: this.getFieldByAliases(row, headerIndexes, ['nationality_name', 'nation']),
      preferredFoot: this.getFieldByAliases(row, headerIndexes, ['preferred_foot', 'preferred foot']),
      shooting,
      passing,
      dribbling: this.getNumberFieldByAliases(row, headerIndexes, ['dribbling']),
      attackingCrossing: this.getNumberFieldByAliases(row, headerIndexes, ['attacking_crossing', 'crossing']),
      attackingHeadingAccuracy: headingAccuracy,
      skillFkAccuracy: this.getNumberFieldByAliases(row, headerIndexes, ['skill_fk_accuracy', 'free_kick_accuracy', 'free kick accuracy']),
      movementAcceleration: this.getNumberFieldByAliases(row, headerIndexes, ['movement_acceleration', 'acceleration']),
      movementSprintSpeed: this.getNumberFieldByAliases(row, headerIndexes, ['movement_sprint_speed', 'sprint_speed', 'sprint speed']),
      powerStamina: this.getNumberFieldByAliases(row, headerIndexes, ['power_stamina', 'stamina']),
      powerStrength: this.getNumberFieldByAliases(row, headerIndexes, ['power_strength', 'strength']),
      defendingStandingTackle: this.getNumberFieldByAliases(row, headerIndexes, ['defending_standing_tackle', 'standing_tackle', 'standing tackle']),
      defendingSlidingTackle: this.getNumberFieldByAliases(row, headerIndexes, ['defending_sliding_tackle', 'sliding_tackle', 'sliding tackle']),
      goalkeepingDiving: this.getNumberFieldByAliases(row, headerIndexes, ['goalkeeping_diving', 'gk_diving', 'gk diving']),
      goalkeepingHandling: this.getNumberFieldByAliases(row, headerIndexes, ['goalkeeping_handling', 'gk_handling', 'gk handling']),
      goalkeepingPositioning: this.getNumberFieldByAliases(row, headerIndexes, ['goalkeeping_positioning', 'gk_positioning', 'gk positioning']),
      goalkeepingReflexes: this.getNumberFieldByAliases(row, headerIndexes, ['goalkeeping_reflexes', 'gk_reflexes', 'gk reflexes']),
      jumping: this.getNumberFieldByAliases(row, headerIndexes, ['jumping']),
      finishing,
      shotPower,
      longShots,
      volleys,
      penalties,
      curve,
      agility,
      balance,
      ballControl,
      shortPassing,
      longPassing,
      vision,
      interceptions,
      defAwareness
    };
  }

  private getFieldByAliases(row: string[], headerIndexes: Map<string, number>, fieldNames: string[]): string {
    for (const fieldName of fieldNames) {
      const columnIndex = headerIndexes.get(this.normalizeKey(fieldName));

      if (columnIndex !== undefined) {
        return (row[columnIndex] ?? '').trim();
      }
    }

    return '';
  }

  private getNumberFieldByAliases(row: string[], headerIndexes: Map<string, number>, fieldNames: string[]): number {
    const value = this.getFieldByAliases(row, headerIndexes, fieldNames);
    const parsed = this.parseLooseNumber(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  private parseCsvRows(csvText: string): string[][] {
    const delimiter = this.detectDelimiter(csvText);

    if (delimiter === '\t') {
      return csvText
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .map((line) => line.split('\t'));
    }

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let index = 0; index < csvText.length; index++) {
      const char = csvText[index];
      const nextChar = csvText[index + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          index += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }

      if (char === delimiter && !insideQuotes) {
        currentRow.push(currentField);
        currentField = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          index += 1;
        }

        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        continue;
      }

      currentField += char;
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    return rows;
  }

  private detectDelimiter(csvText: string): string {
    const firstLine = csvText.split(/\r?\n/, 1)[0] ?? '';
    const commaCount = (firstLine.match(/,/g) ?? []).length;
    const tabCount = (firstLine.match(/\t/g) ?? []).length;
    const semicolonCount = (firstLine.match(/;/g) ?? []).length;

    if (tabCount >= commaCount && tabCount >= semicolonCount && tabCount > 0) {
      return '\t';
    }

    if (semicolonCount > commaCount && semicolonCount > 0) {
      return ';';
    }

    return ',';
  }

  private parseLooseNumber(value: string): number {
    const trimmed = value.trim();

    if (!trimmed) {
      return 0;
    }

    const directParsed = Number(trimmed);

    if (Number.isFinite(directParsed)) {
      return directParsed;
    }

    const match = trimmed.match(/-?\d+(?:\.\d+)?/);

    if (!match) {
      return 0;
    }

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private averageNonZero(values: number[]): number {
    const nonZeroValues = values.filter((value) => Number.isFinite(value) && value > 0);

    if (nonZeroValues.length === 0) {
      return 0;
    }

    return Math.round(nonZeroValues.reduce((total, value) => total + value, 0) / nonZeroValues.length);
  }

  private averageStats(...values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const fallback = values[values.length - 1];
    const explicitValues = values.slice(0, -1).filter((value) => Number.isFinite(value) && value > 0);

    if (explicitValues.length === 0) {
      return fallback;
    }

    return Math.round(explicitValues.reduce((total, value) => total + value, 0) / explicitValues.length);
  }

  private toGameName(sourceName: string, fallback: string): string {
    const normalized = sourceName.trim();

    if (!normalized) {
      return fallback;
    }

    // Keep names that are already in abbreviated in-game style.
    if (/^[A-Za-z]\.\s+/.test(normalized)) {
      return normalized;
    }

    const parts = normalized.split(/\s+/).filter((part) => part.length > 0);

    if (parts.length < 2) {
      return normalized;
    }

    const firstName = parts[0];
    const surname = parts.slice(1).join(' ');

    return `${firstName[0].toUpperCase()}. ${surname}`;
  }

  private mapPosition(source: ImportedPlayerRecord, fallback: number): number {
    const normalizedPosition = source.clubPosition.trim().toUpperCase();
    const mappedPosition = POSITION_MAP[normalizedPosition];

    if (mappedPosition !== undefined) {
      return mappedPosition;
    }

    return this.inferPositionFromStats(source, fallback);
  }

  private inferPositionFromStats(source: ImportedPlayerRecord, fallback: number): number {
    const goalkeeperScore = source.goalkeepingHandling + source.goalkeepingPositioning + source.goalkeepingReflexes;
    const defenseScore = source.defendingStandingTackle + source.defendingSlidingTackle + source.powerStrength + source.attackingHeadingAccuracy;
    const midfieldScore = source.passing + source.dribbling + source.powerStamina + source.attackingCrossing;
    const attackScore = source.shooting + source.dribbling + source.movementAcceleration + source.movementSprintSpeed;

    if (goalkeeperScore >= defenseScore && goalkeeperScore >= midfieldScore && goalkeeperScore >= attackScore) {
      return 0;
    }

    if (defenseScore >= midfieldScore && defenseScore >= attackScore) {
      const wideDefenseScore = source.attackingCrossing + source.movementAcceleration + source.movementSprintSpeed;

      if (wideDefenseScore >= source.attackingHeadingAccuracy + source.powerStrength) {
        return this.mapWidePositionByFoot(source.preferredFoot, 1, 2);
      }

      return 6;
    }

    if (midfieldScore >= attackScore) {
      if (source.shooting >= 78 || source.dribbling >= 82) {
        return 18;
      }

      if (source.attackingCrossing >= 80 && source.movementSprintSpeed >= 78) {
        return this.mapWidePositionByFoot(source.preferredFoot, 17, 16);
      }

      if (source.defendingStandingTackle >= 78 || source.defendingSlidingTackle >= 78) {
        return 11;
      }

      return 11;
    }

    if (source.attackingCrossing >= 78 && source.attackingHeadingAccuracy < 74) {
      return this.mapWidePositionByFoot(source.preferredFoot, 20, 21);
    }

    if (source.shooting >= 80 || source.attackingHeadingAccuracy >= 78 || source.powerStrength >= 78) {
      return 19;
    }

    if (source.dribbling >= 82 || source.movementSprintSpeed >= 84) {
      return this.mapWidePositionByFoot(source.preferredFoot, 20, 21);
    }

    return fallback;
  }

  private mapWidePositionByFoot(preferredFoot: string, leftFootPosition: number, rightFootPosition: number): number {
    return preferredFoot.trim().toLowerCase() === 'left' ? leftFootPosition : rightFootPosition;
  }

  private mapFoot(preferredFoot: string, fallback: number): number {
    const normalizedFoot = preferredFoot.trim().toLowerCase();

    if (normalizedFoot === 'right') {
      return 0;
    }

    if (normalizedFoot === 'left') {
      return 1;
    }

    return fallback;
  }

  private mapNationality(nationalityName: string, fallback: number): number {
    const normalizedNationality = this.normalizeKey(nationalityName);
    const aliasedNationality = NATIONALITY_ALIASES[normalizedNationality] ?? normalizedNationality;

    return this.nationalityIndex.get(aliasedNationality) ?? fallback;
  }

  private mapYear(age: number, fallback: number): number {
    if (!Number.isFinite(age) || age <= 0) {
      return fallback;
    }

    return Math.max(0, 2026 - Math.round(age));
  }

  private clampStat(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return Math.max(1, Math.min(99, Math.round(fallback)));
    }

    return Math.max(1, Math.min(99, Math.round(value)));
  }

  private clampByte(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.max(0, Math.min(255, Math.round(value)));
  }

  private normalizeKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();
  }
}