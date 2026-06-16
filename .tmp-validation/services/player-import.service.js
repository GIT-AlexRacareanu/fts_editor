"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerImportService = void 0;
const core_1 = require("@angular/core");
const nationalities_1 = require("../data/nationalities");
const player_service_1 = require("./player.service");
const IMPORT_POSITION_LABEL_BY_CODE = {
    0: 'GK',
    1: 'SW',
    2: 'RWB',
    3: 'RB',
    4: 'RCB',
    5: 'CB',
    6: 'LCB',
    7: 'LB',
    8: 'LWB',
    9: 'RDM',
    10: 'CDM',
    11: 'LDM',
    12: 'RM',
    13: 'RCM',
    14: 'CM',
    15: 'LCM',
    16: 'LM',
    17: 'RAM',
    18: 'CAM',
    19: 'LAM',
    20: 'RF',
    21: 'CF',
    22: 'LF',
    23: 'RW',
    24: 'RS',
    25: 'ST',
    26: 'LS',
    27: 'LW'
};
const POSITION_MAP = {
    GK: 0,
    SW: 6,
    LSW: 3,
    RSW: 4,
    RWB: 2,
    RB: 2,
    RCB: 7,
    CB: 6,
    LCB: 5,
    LB: 1,
    LWB: 1,
    RDM: 9,
    CDM: 8,
    LDM: 10,
    RM: 16,
    RCM: 13,
    CM: 11,
    LCM: 12,
    LM: 17,
    RAM: 15,
    CAM: 18,
    LAM: 14,
    RF: 21,
    CF: 22,
    LF: 20,
    RW: 21,
    RS: 19,
    ST: 19,
    LS: 19,
    LW: 20
};
const WIDE_IMPORT_POSITIONS = new Set(['LM', 'RM', 'LW', 'RW']);
const LEFT_WIDE_GAME_POSITIONS = [17, 20];
const RIGHT_WIDE_GAME_POSITIONS = [16, 21];
const FK_FIELD_ALIASES = [
    'skill_fk_accuracy', 'free_kick_accuracy', 'free kick accuracy', 'freekickaccuracy', 'freekick acc',
    'free kick', 'freekick', 'fkaccuracy', 'fk accuracy', 'fk'
];
const GK_DIVING_FIELD_ALIASES = [
    'goalkeeping_diving', 'goalkeeping diving', 'gk_diving', 'gk diving', 'gkdiving', 'gkdiv', 'diving'
];
const GK_HANDLING_FIELD_ALIASES = [
    'goalkeeping_handling', 'goalkeeping handling', 'gk_handling', 'gk handling', 'gkhandling', 'gkhand', 'handling'
];
const GK_POSITIONING_FIELD_ALIASES = [
    'goalkeeping_positioning', 'goalkeeping positioning', 'gk_positioning', 'gk positioning', 'gkpositioning', 'gkpos', 'positioning_gk'
];
const GK_REFLEXES_FIELD_ALIASES = [
    'goalkeeping_reflexes', 'goalkeeping reflexes', 'gk_reflexes', 'gk reflexes', 'gkreflexes', 'gkref', 'reflexes_gk'
];
const NATIONALITY_ALIASES = {
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
const SPECIAL_LATIN_MAP = {
    'ß': 'ss', 'ẞ': 'SS',
    'Æ': 'AE', 'æ': 'ae',
    'Œ': 'OE', 'œ': 'oe',
    'Ø': 'O', 'ø': 'o',
    'Ð': 'D', 'ð': 'd',
    'Þ': 'Th', 'þ': 'th',
    'Ł': 'L', 'ł': 'l',
    'Đ': 'D', 'đ': 'd',
    'Ħ': 'H', 'ħ': 'h',
    'Ŋ': 'N', 'ŋ': 'n'
};
let PlayerImportService = class PlayerImportService {
    constructor() {
        this.maxGameNameLength = 16;
        this.nationalityIndex = new Map(Object.entries(nationalities_1.NATIONALITY_NAMES_BY_ID).map(([id, name]) => [this.normalizeKey(name), Number(id)]));
    }
    parseCsv(csvText) {
        const rows = this.parseCsvRows(csvText);
        if (rows.length < 2) {
            return [];
        }
        const [headerRow, ...dataRows] = rows;
        const headerIndexes = new Map(headerRow.map((header, index) => [this.normalizeKey(header), index]));
        return dataRows
            .filter((row) => row.some((value) => value.trim().length > 0))
            .map((row, rowIndex) => this.toImportedPlayerRecord(row, headerIndexes, rowIndex))
            .filter((player) => player !== null)
            .sort((left, right) => {
            if (right.overall !== left.overall) {
                return right.overall - left.overall;
            }
            return left.shortName.localeCompare(right.shortName);
        });
    }
    getAvailableTeamNames(players) {
        const teams = new Set();
        for (const player of players) {
            for (const teamName of [player.teamName, player.nationalTeamName, player.loanedToTeamName]) {
                if ((teamName ?? '').length > 0) {
                    teams.add(teamName);
                }
            }
        }
        return Array.from(teams).sort();
    }
    filterByTeam(players, teamName) {
        return players.filter((player) => {
            const clubTeamName = player.teamName.trim();
            const nationalTeamName = (player.nationalTeamName ?? '').trim();
            const loanedToTeamName = (player.loanedToTeamName ?? '').trim();
            if (nationalTeamName === teamName) {
                return true;
            }
            if (loanedToTeamName === teamName) {
                return true;
            }
            return clubTeamName === teamName && loanedToTeamName.length === 0;
        });
    }
    searchPlayers(players, query) {
        const normalizedQuery = this.normalizeKey(query);
        if (!normalizedQuery) {
            return players;
        }
        const queryTokens = normalizedQuery.split(' ').filter((token) => token.length > 0);
        return players.filter((player) => {
            const searchableText = this.normalizeKey([
                player.shortName,
                player.nationalityName,
                player.clubPosition,
                String(player.overall)
            ].join(' '));
            return queryTokens.every((token) => searchableText.includes(token));
        });
    }
    mapImportedPlayer(source, currentPlayer, options = {}) {
        const { includeYear = true } = options;
        const shooting = source.shooting;
        const freeKick = source.skillFkAccuracy;
        const crossing = source.attackingCrossing;
        const dribblingControl = source.dribbling;
        const heading = source.attackingHeadingAccuracy;
        const passing = source.passing;
        const tackling = this.averageStats(source.defending, source.defendingSlidingTackle, source.defendingStandingTackle);
        const mappedPlayer = {
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
            GKP: this.clampStat(source.goalkeepingDiving, currentPlayer.GKP)
        };
        mappedPlayer.pos = this.resolveBestWidePosition(source, mappedPlayer);
        this.applyImportedOvrAdjustment(source, mappedPlayer);
        return mappedPlayer;
    }
    toImportedPlayerRecord(row, headerIndexes, rowIndex) {
        const shortName = this.getFieldByAliases(row, headerIndexes, ['short_name', 'knownas', 'knownus', 'name']);
        const lastName = this.getFieldByAliases(row, headerIndexes, ['lastname', 'last_name', 'surname', 'last name']);
        if (!shortName) {
            return null;
        }
        const finishing = this.getNumberFieldByAliases(row, headerIndexes, ['finishing']);
        const shotPower = this.getNumberFieldByAliases(row, headerIndexes, ['shot_power', 'shot power', 'shotpower']);
        const longShots = this.getNumberFieldByAliases(row, headerIndexes, ['long_shots', 'long shots', 'longshots']);
        const volleys = this.getNumberFieldByAliases(row, headerIndexes, ['volleys']);
        const penalties = this.getNumberFieldByAliases(row, headerIndexes, ['penalties']);
        const compactShooting = this.getNumberFieldByAliases(row, headerIndexes, ['sho']);
        const shooting = compactShooting > 0
            ? compactShooting
            : this.averageNonZero([
                this.getNumberFieldByAliases(row, headerIndexes, ['shooting']),
                finishing,
                shotPower,
                longShots,
                volleys,
                penalties
            ]);
        const shortPassing = this.getNumberFieldByAliases(row, headerIndexes, ['short_passing', 'short passing', 'shortpassing']);
        const longPassing = this.getNumberFieldByAliases(row, headerIndexes, ['long_passing', 'long passing', 'longpassing']);
        const vision = this.getNumberFieldByAliases(row, headerIndexes, ['vision']);
        const compactPassing = this.getNumberFieldByAliases(row, headerIndexes, ['pas']);
        const passing = compactPassing > 0
            ? compactPassing
            : this.averageNonZero([
                this.getNumberFieldByAliases(row, headerIndexes, ['passing']),
                shortPassing,
                longPassing,
                vision
            ]);
        const headingAccuracy = this.getNumberFieldByAliases(row, headerIndexes, ['attacking_heading_accuracy', 'heading_accuracy', 'heading accuracy', 'headingaccuracy', 'heading acc', 'hea', 'headacc', 'head acc']);
        const curve = this.getNumberFieldByAliases(row, headerIndexes, ['curve']);
        const agility = this.getNumberFieldByAliases(row, headerIndexes, ['agility']);
        const balance = this.getNumberFieldByAliases(row, headerIndexes, ['balance']);
        const ballControl = this.getNumberFieldByAliases(row, headerIndexes, ['ball_control', 'ball control', 'ballcontrol']);
        const interceptions = this.getNumberFieldByAliases(row, headerIndexes, ['interceptions']);
        const defAwareness = this.getNumberFieldByAliases(row, headerIndexes, ['def_awareness', 'def awareness']);
        const defending = this.getNumberFieldByAliases(row, headerIndexes, ['defending', 'def']);
        const sprintSpeed = this.getNumberFieldByAliases(row, headerIndexes, ['movement_sprint_speed', 'sprint_speed', 'sprint speed', 'sprintspeed', 'speed', 'spe']);
        const acceleration = this.getNumberFieldByAliases(row, headerIndexes, ['movement_acceleration', 'acceleration', 'acc']);
        return {
            sourceRowIndex: rowIndex,
            shortName,
            lastName,
            overall: this.getNumberFieldByAliases(row, headerIndexes, ['overall', 'overallrating', 'ovr', 'rating']),
            age: this.getNumberFieldByAliases(row, headerIndexes, ['age']),
            heightCm: this.getHeightFieldByAliases(row, headerIndexes, ['height_cm', 'height']),
            weightKg: this.getWeightFieldByAliases(row, headerIndexes, ['weight_kg', 'weight']),
            clubPosition: this.getImportPosition(row, headerIndexes),
            nationalityName: this.getFieldByAliases(row, headerIndexes, ['nationality_name', 'nation', 'nationality', 'country region', 'country']),
            teamName: this.getFieldByAliases(row, headerIndexes, ['team', 'club', 'club_name', 'club name', 'team name']),
            nationalTeamName: this.getFieldByAliases(row, headerIndexes, ['national_team', 'national team']),
            loanedToTeamName: this.getFieldByAliases(row, headerIndexes, ['loanedto_club', 'loaned_to_club', 'loaned club', 'loan club', 'loaned to club']),
            preferredFoot: this.getFieldByAliases(row, headerIndexes, ['preferred_foot', 'preferred foot', 'preferredfoot', 'foot']),
            shooting,
            passing,
            dribbling: this.getNumberFieldByAliases(row, headerIndexes, ['dri', 'dribbling']),
            physical: this.getNumberFieldByAliases(row, headerIndexes, ['physical', 'phy']),
            attackingCrossing: this.getNumberFieldByAliases(row, headerIndexes, ['attacking_crossing', 'crossing', 'cro']),
            attackingHeadingAccuracy: headingAccuracy,
            skillFkAccuracy: this.getNumberFieldByAliases(row, headerIndexes, [...FK_FIELD_ALIASES]),
            movementAcceleration: acceleration > 0 ? acceleration : sprintSpeed,
            movementSprintSpeed: sprintSpeed,
            powerStamina: this.getNumberFieldByAliases(row, headerIndexes, ['power_stamina', 'stamina', 'sta']),
            powerStrength: this.getNumberFieldByAliases(row, headerIndexes, ['phy', 'physical', 'power_strength', 'strength']),
            defendingStandingTackle: this.getNumberFieldByAliases(row, headerIndexes, ['defending_standing_tackle', 'standing_tackle', 'standing tackle', 'standingtackle', 'def']),
            defendingSlidingTackle: this.getNumberFieldByAliases(row, headerIndexes, ['defending_sliding_tackle', 'sliding_tackle', 'sliding tackle', 'slidingtackle', 'def']),
            goalkeepingDiving: this.getNumberFieldByAliases(row, headerIndexes, [...GK_DIVING_FIELD_ALIASES]),
            goalkeepingHandling: this.getNumberFieldByAliases(row, headerIndexes, [...GK_HANDLING_FIELD_ALIASES]),
            goalkeepingPositioning: this.getNumberFieldByAliases(row, headerIndexes, [...GK_POSITIONING_FIELD_ALIASES]),
            goalkeepingReflexes: this.getNumberFieldByAliases(row, headerIndexes, [...GK_REFLEXES_FIELD_ALIASES]),
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
            defAwareness,
            defending
        };
    }
    getFieldByAliases(row, headerIndexes, fieldNames) {
        for (const fieldName of fieldNames) {
            const columnIndex = headerIndexes.get(this.normalizeKey(fieldName));
            if (columnIndex !== undefined) {
                return (row[columnIndex] ?? '').trim();
            }
        }
        return '';
    }
    getImportPosition(row, headerIndexes) {
        const directPosition = this.getFieldByAliases(row, headerIndexes, ['club_position', 'position', 'best_position', 'best position']);
        if (directPosition) {
            return this.normalizeImportPosition(directPosition) ?? directPosition.trim();
        }
        for (const fieldName of ['position_1', 'position_2', 'position_3', 'position_4']) {
            const codedPosition = this.getFieldByAliases(row, headerIndexes, [fieldName]);
            const normalizedPosition = this.normalizeImportPosition(codedPosition);
            if (normalizedPosition) {
                return normalizedPosition;
            }
        }
        return '';
    }
    getNumberFieldByAliases(row, headerIndexes, fieldNames) {
        const value = this.getFieldByAliases(row, headerIndexes, fieldNames);
        const parsed = this.parseLooseNumber(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    getHeightFieldByAliases(row, headerIndexes, fieldNames) {
        const value = this.getFieldByAliases(row, headerIndexes, fieldNames);
        const parsed = this.parseHeightCm(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    getWeightFieldByAliases(row, headerIndexes, fieldNames) {
        const value = this.getFieldByAliases(row, headerIndexes, fieldNames);
        const parsed = this.parseWeightKg(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    parseCsvRows(csvText) {
        const delimiter = this.detectDelimiter(csvText);
        if (delimiter === '\t') {
            return csvText
                .split(/\r?\n/)
                .filter((line) => line.length > 0)
                .map((line) => line.split('\t'));
        }
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let insideQuotes = false;
        for (let index = 0; index < csvText.length; index++) {
            const char = csvText[index];
            const nextChar = csvText[index + 1];
            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    currentField += '"';
                    index += 1;
                }
                else {
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
    detectDelimiter(csvText) {
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
    parseLooseNumber(value) {
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
    parseHeightCm(value) {
        const trimmed = value.trim();
        if (!trimmed) {
            return 0;
        }
        const cmMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*cm\b/i);
        if (cmMatch) {
            return this.parseLooseNumber(cmMatch[1]);
        }
        const feetInchesMatch = trimmed.match(/(\d+)\s*'\s*(\d+)(?:\"|\b)/);
        if (feetInchesMatch) {
            const feet = this.parseLooseNumber(feetInchesMatch[1]);
            const inches = this.parseLooseNumber(feetInchesMatch[2]);
            if (feet > 0 || inches > 0) {
                return Math.round((feet * 12 + inches) * 2.54);
            }
        }
        return this.parseLooseNumber(trimmed);
    }
    parseWeightKg(value) {
        const trimmed = value.trim();
        if (!trimmed) {
            return 0;
        }
        const kgMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
        if (kgMatch) {
            return this.parseLooseNumber(kgMatch[1]);
        }
        const lbsMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds)\b/i);
        if (lbsMatch) {
            const pounds = this.parseLooseNumber(lbsMatch[1]);
            return pounds > 0 ? Math.round(pounds * 0.45359237) : 0;
        }
        return this.parseLooseNumber(trimmed);
    }
    averageNonZero(values) {
        const nonZeroValues = values.filter((value) => Number.isFinite(value) && value > 0);
        if (nonZeroValues.length === 0) {
            return 0;
        }
        return Math.round(nonZeroValues.reduce((total, value) => total + value, 0) / nonZeroValues.length);
    }
    averageStats(...values) {
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
    toGameName(sourceName, fallback) {
        const normalized = this.toLatinAscii(sourceName);
        if (!normalized) {
            return this.trimToGameNameLength(this.toLatinAscii(fallback));
        }
        // Keep names that are already in abbreviated in-game style.
        if (/^[A-Za-z]\.\s+/.test(normalized)) {
            return this.trimToGameNameLength(normalized);
        }
        const parts = normalized.split(/\s+/).filter((part) => part.length > 0);
        if (parts.length < 2) {
            return this.trimToGameNameLength(normalized);
        }
        if (normalized.length <= 10) {
            return this.trimToGameNameLength(normalized);
        }
        const firstName = parts[0];
        const surname = parts.slice(1).join(' ');
        return this.trimToGameNameLength(`${firstName[0].toUpperCase()}. ${surname}`);
    }
    mapPosition(source, fallback) {
        const normalizedPosition = this.normalizeImportPosition(source.clubPosition)?.toUpperCase()
            ?? source.clubPosition.trim().toUpperCase();
        const mappedPosition = POSITION_MAP[normalizedPosition];
        if (mappedPosition !== undefined) {
            return mappedPosition;
        }
        return this.inferPositionFromStats(source, fallback);
    }
    resolveBestWidePosition(source, mappedPlayer) {
        const normalizedPosition = source.clubPosition.trim().toUpperCase();
        if (!WIDE_IMPORT_POSITIONS.has(normalizedPosition)) {
            return mappedPlayer.pos;
        }
        const candidatePositions = normalizedPosition.startsWith('L')
            ? LEFT_WIDE_GAME_POSITIONS
            : RIGHT_WIDE_GAME_POSITIONS;
        let bestPosition = mappedPlayer.pos;
        let bestOvr = (0, player_service_1.calculatePlayerOvr)(mappedPlayer);
        for (const candidatePosition of candidatePositions) {
            const candidateOvr = (0, player_service_1.calculatePlayerOvr)({ ...mappedPlayer, pos: candidatePosition });
            if (candidateOvr > bestOvr) {
                bestOvr = candidateOvr;
                bestPosition = candidatePosition;
            }
        }
        return bestPosition;
    }
    applyImportedOvrAdjustment(source, mappedPlayer) {
        if (!Number.isFinite(source.overall) || source.overall <= 0) {
            return;
        }
        const ovrCategory = this.getOvrCategoryForPosition(mappedPlayer.pos);
        for (let attempt = 0; attempt < 99; attempt += 1) {
            const ratingDifference = source.overall - (0, player_service_1.calculatePlayerOvr)(mappedPlayer);
            if (ratingDifference === 0) {
                return;
            }
            const adjustmentAmount = attempt === 0 ? ratingDifference : Math.sign(ratingDifference);
            if (!this.adjustPlayerStatsForCategory(mappedPlayer, ovrCategory, adjustmentAmount)) {
                return;
            }
        }
    }
    adjustPlayerStatsForCategory(player, ovrCategory, ratingDifference) {
        switch (ovrCategory) {
            case 'gk':
                return [
                    this.adjustPlayerStat(player, 'GKS', ratingDifference),
                    this.adjustPlayerStat(player, 'GKH', ratingDifference),
                    this.adjustPlayerStat(player, 'GKP', ratingDifference)
                ].some(Boolean);
            case 'def': {
                const headingDelta = ratingDifference >= 0
                    ? Math.ceil(ratingDifference / 2)
                    : Math.floor(ratingDifference / 2);
                const strengthDelta = ratingDifference - headingDelta;
                return [
                    this.adjustPlayerStat(player, 'TAC', ratingDifference),
                    this.adjustPlayerStat(player, 'HEA', headingDelta),
                    this.adjustPlayerStat(player, 'STR', strengthDelta)
                ].some(Boolean);
            }
            case 'mid':
                return [
                    this.adjustPlayerStat(player, 'CON', ratingDifference),
                    this.adjustPlayerStat(player, 'PAS', ratingDifference)
                ].some(Boolean);
            default:
                return [
                    this.adjustPlayerStat(player, 'CON', ratingDifference),
                    this.adjustPlayerStat(player, 'SHO', ratingDifference)
                ].some(Boolean);
        }
    }
    getOvrCategoryForPosition(position) {
        if (position === 0) {
            return 'gk';
        }
        if (position === 8) {
            return 'mid';
        }
        if (position === 16 || position === 17) {
            return 'att';
        }
        if (position >= 1 && position <= 10) {
            return 'def';
        }
        if (position >= 11 && position <= 18) {
            return 'mid';
        }
        return 'att';
    }
    adjustPlayerStat(player, stat, delta) {
        const nextValue = this.clampStat(player[stat] + delta, player[stat]);
        if (nextValue === player[stat]) {
            return false;
        }
        player[stat] = nextValue;
        return true;
    }
    inferPositionFromStats(source, fallback) {
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
    mapWidePositionByFoot(preferredFoot, leftFootPosition, rightFootPosition) {
        return preferredFoot.trim().toLowerCase() === 'left' ? leftFootPosition : rightFootPosition;
    }
    normalizeImportPosition(value) {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsedCode = Number(trimmed);
        if (Number.isInteger(parsedCode)) {
            return IMPORT_POSITION_LABEL_BY_CODE[parsedCode] ?? null;
        }
        const normalizedLabel = trimmed.toUpperCase();
        return POSITION_MAP[normalizedLabel] !== undefined ? normalizedLabel : null;
    }
    mapFoot(preferredFoot, fallback) {
        const normalizedFoot = preferredFoot.trim().toLowerCase();
        if (normalizedFoot === 'right') {
            return 0;
        }
        if (normalizedFoot === 'left') {
            return 1;
        }
        return fallback;
    }
    mapNationality(nationalityName, fallback) {
        const normalizedNationality = this.normalizeKey(nationalityName);
        const aliasedNationality = NATIONALITY_ALIASES[normalizedNationality] ?? normalizedNationality;
        return this.nationalityIndex.get(aliasedNationality) ?? fallback;
    }
    mapYear(age, fallback) {
        if (!Number.isFinite(age) || age <= 0) {
            return fallback;
        }
        return Math.max(0, 2026 - Math.round(age));
    }
    clampStat(value, fallback) {
        if (!Number.isFinite(value)) {
            return Math.max(1, Math.min(99, Math.round(fallback)));
        }
        return Math.max(1, Math.min(99, Math.round(value)));
    }
    clampByte(value, fallback) {
        if (!Number.isFinite(value)) {
            return fallback;
        }
        return Math.max(0, Math.min(255, Math.round(value)));
    }
    normalizeKey(value) {
        return this.toLatinBase(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .trim()
            .toLowerCase();
    }
    toLatinAscii(value) {
        return this.toLatinBase(value)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9 .'-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    trimToGameNameLength(value) {
        return value.slice(0, this.maxGameNameLength).trimEnd();
    }
    toLatinBase(value) {
        return Array.from(value)
            .map((char) => SPECIAL_LATIN_MAP[char] ?? char)
            .join('');
    }
};
PlayerImportService = __decorate([
    (0, core_1.Injectable)({ providedIn: 'root' })
], PlayerImportService);
exports.PlayerImportService = PlayerImportService;
