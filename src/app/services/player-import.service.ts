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
    const headerIndexes = new Map(headerRow.map((header, index) => [header.trim(), index]));

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
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return players;
    }

    return players.filter((player) => player.shortName.toLowerCase().includes(normalizedQuery));
  }

  mapImportedPlayer(source: ImportedPlayerRecord, currentPlayer: Player): Player {
    return {
      ...currentPlayer,
      name: source.shortName,
      pos: this.mapPosition(source, currentPlayer.pos),
      foot: this.mapFoot(source.preferredFoot, currentPlayer.foot),
      nat: this.mapNationality(source.nationalityName, currentPlayer.nat),
      estatura: this.clampByte(source.heightCm, currentPlayer.estatura),
      peso: this.clampByte(source.weightKg, currentPlayer.peso),
      year: this.mapYear(source.age, currentPlayer.year),
      ACC: this.clampStat(source.movementAcceleration, currentPlayer.ACC),
      SPD: this.clampStat(source.movementSprintSpeed, currentPlayer.SPD),
      STA: this.clampStat(source.powerStamina, currentPlayer.STA),
      STR: this.clampStat(source.powerStrength, currentPlayer.STR),
      TAC: this.clampStat(
        Math.round((source.defendingStandingTackle + source.defendingSlidingTackle) / 2),
        currentPlayer.TAC
      ),
      CON: this.clampStat(source.dribbling, currentPlayer.CON),
      SHO: this.clampStat(source.shooting, currentPlayer.SHO),
      CRO: this.clampStat(source.attackingCrossing, currentPlayer.CRO),
      FK: this.clampStat(source.skillFkAccuracy, currentPlayer.FK),
      PAS: this.clampStat(source.passing, currentPlayer.PAS),
      HEA: this.clampStat(source.attackingHeadingAccuracy, currentPlayer.HEA),
      GKS: this.clampStat(source.goalkeepingReflexes, currentPlayer.GKS),
      GKH: this.clampStat(source.goalkeepingHandling, currentPlayer.GKH),
      GKP: this.clampStat(source.goalkeepingPositioning, currentPlayer.GKP)
    };
  }

  private toImportedPlayerRecord(row: string[], headerIndexes: Map<string, number>): ImportedPlayerRecord | null {
    const shortName = this.getField(row, headerIndexes, 'short_name');

    if (!shortName) {
      return null;
    }

    return {
      playerId: this.getField(row, headerIndexes, 'player_id'),
      shortName,
      overall: this.getNumberField(row, headerIndexes, 'overall'),
      age: this.getNumberField(row, headerIndexes, 'age'),
      heightCm: this.getNumberField(row, headerIndexes, 'height_cm'),
      weightKg: this.getNumberField(row, headerIndexes, 'weight_kg'),
      clubPosition: this.getField(row, headerIndexes, 'club_position'),
      nationalityName: this.getField(row, headerIndexes, 'nationality_name'),
      preferredFoot: this.getField(row, headerIndexes, 'preferred_foot'),
      shooting: this.getNumberField(row, headerIndexes, 'shooting'),
      passing: this.getNumberField(row, headerIndexes, 'passing'),
      dribbling: this.getNumberField(row, headerIndexes, 'dribbling'),
      attackingCrossing: this.getNumberField(row, headerIndexes, 'attacking_crossing'),
      attackingHeadingAccuracy: this.getNumberField(row, headerIndexes, 'attacking_heading_accuracy'),
      skillFkAccuracy: this.getNumberField(row, headerIndexes, 'skill_fk_accuracy'),
      movementAcceleration: this.getNumberField(row, headerIndexes, 'movement_acceleration'),
      movementSprintSpeed: this.getNumberField(row, headerIndexes, 'movement_sprint_speed'),
      powerStamina: this.getNumberField(row, headerIndexes, 'power_stamina'),
      powerStrength: this.getNumberField(row, headerIndexes, 'power_strength'),
      defendingStandingTackle: this.getNumberField(row, headerIndexes, 'defending_standing_tackle'),
      defendingSlidingTackle: this.getNumberField(row, headerIndexes, 'defending_sliding_tackle'),
      goalkeepingDiving: this.getNumberField(row, headerIndexes, 'goalkeeping_diving'),
      goalkeepingHandling: this.getNumberField(row, headerIndexes, 'goalkeeping_handling'),
      goalkeepingPositioning: this.getNumberField(row, headerIndexes, 'goalkeeping_positioning'),
      goalkeepingReflexes: this.getNumberField(row, headerIndexes, 'goalkeeping_reflexes')
    };
  }

  private getField(row: string[], headerIndexes: Map<string, number>, fieldName: string): string {
    const columnIndex = headerIndexes.get(fieldName);

    if (columnIndex === undefined) {
      return '';
    }

    return (row[columnIndex] ?? '').trim();
  }

  private getNumberField(row: string[], headerIndexes: Map<string, number>, fieldName: string): number {
    const value = this.getField(row, headerIndexes, fieldName);
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  private parseCsvRows(csvText: string): string[][] {
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

      if (char === ',' && !insideQuotes) {
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
      return fallback;
    }

    return Math.max(0, Math.min(99, Math.round(value)));
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