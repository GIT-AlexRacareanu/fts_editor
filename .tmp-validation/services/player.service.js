"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerService = exports.calculatePlayerOvr = exports.OFFSET_MAP = void 0;
const core_1 = require("@angular/core");
exports.OFFSET_MAP = {
    skin: 88, skin_tone: 82, hair_type: 86, hair: 84,
    beard_type: 87, head_type: 81, estatura: 89, peso: 90,
    pos: 91, boots: 92, mangas: 93, foot: 94, nat: 83,
    ACC: 95, SPD: 96, STA: 97, STR: 98, TAC: 99, CON: 100,
    SHO: 101, CRO: 102, FK: 103, PAS: 104, HEA: 105,
    GKS: 106, GKH: 107, GKP: 108, guantes: 85
};
const STAT_ORDER = ['STR', 'STA', 'SPD', 'ACC', 'CON', 'PAS', 'CRO', 'SHO', 'HEA', 'TAC', 'FK', 'GKS', 'GKH', 'GKP'];
function calculatePlayerOvr(player) {
    const posCategory = getPositionCategory(player.pos);
    const profile = getDefaultProfileByPositionCategory(posCategory);
    const { weights, bonus, multiplier } = profile;
    let weightedSum = 0;
    let totalWeight = 0;
    let maxStat = 0;
    for (let i = 0; i < STAT_ORDER.length; i++) {
        const stat = player[STAT_ORDER[i]];
        weightedSum += weights[i] * stat;
        totalWeight += weights[i];
        if (stat > maxStat) {
            maxStat = stat;
        }
    }
    const denominator = bonus + totalWeight;
    if (denominator <= 0) {
        return 0;
    }
    const raw = Math.floor((bonus * maxStat + weightedSum) * multiplier / denominator);
    return Math.max(0, Math.min(100, raw));
}
exports.calculatePlayerOvr = calculatePlayerOvr;
const RATING_MULTIPLIER_BITS = 0x3f833333;
const DEFAULT_MULTIPLIER = ieee754ToFloat(RATING_MULTIPLIER_BITS);
const DEFAULT_PROFILES = {
    gk: { weights: [2, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 12, 12, 12], bonus: 0, multiplier: DEFAULT_MULTIPLIER },
    def: { weights: [10, 4, 4, 0, 4, 2, 2, 2, 10, 30, 0, 0, 0, 0], bonus: 22, multiplier: DEFAULT_MULTIPLIER },
    mid: { weights: [10, 4, 0, 0, 35, 35, 0, 0, 0, 8, 0, 0, 0, 0], bonus: 15, multiplier: DEFAULT_MULTIPLIER },
    att: { weights: [8, 0, 10, 0, 30, 5, 0, 40, 0, 0, 0, 0, 0, 0], bonus: 12, multiplier: DEFAULT_MULTIPLIER }
};
function ieee754ToFloat(bits) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setUint32(0, bits, false);
    return new DataView(buf).getFloat32(0, false);
}
function getPositionCategory(position) {
    if (position === 0) {
        return 0;
    }
    if (position === 8) {
        return 2;
    }
    if (position === 16 || position === 17) {
        return 3;
    }
    if (position >= 1 && position <= 10) {
        return 1;
    }
    if (position >= 11 && position <= 18) {
        return 2;
    }
    return 3;
}
function getDefaultProfileByPositionCategory(posCategory) {
    switch (posCategory) {
        case 0:
            return DEFAULT_PROFILES.gk;
        case 1:
            return DEFAULT_PROFILES.def;
        case 2:
            return DEFAULT_PROFILES.mid;
        default:
            return DEFAULT_PROFILES.att;
    }
}
let PlayerService = class PlayerService {
    constructor(fileHandleStorage) {
        this.fileHandleStorage = fileHandleStorage;
        this.storageKey = 'players-dat';
        this.playerIdOffset = 0x0c;
        this.hiddenFromTransferMarketOffset = 0x6e;
        this.isIconLegendOffset = 0x6f;
        this.birthDayOffset = 0x70;
        this.birthMonthOffset = 0x74;
        this.playerStride = 112;
        this.yearOffset = 120;
        this.totalPlayersOffset = 8;
        this.binaryData = null;
        this.fileHandle = null;
        this.profiles = DEFAULT_PROFILES;
    }
    formatPlayerId(index) {
        return this.getStoredPlayerId(index).toString(16).toUpperCase().padStart(4, '0');
    }
    findPlayerIndexByName(name) {
        const normalizedName = this.normalizePlayerName(name);
        if (!normalizedName) {
            return -1;
        }
        const compactName = normalizedName.replace(/\s+/g, '');
        const total = this.totalPlayers;
        for (let index = 0; index < total; index += 1) {
            const playerName = this.normalizePlayerName(this.getPlayerNameByIndex(index) ?? '');
            if (!playerName) {
                continue;
            }
            if (playerName === normalizedName || playerName.replace(/\s+/g, '') === compactName) {
                return index;
            }
        }
        const normalizedTokens = normalizedName.split(' ').filter((token) => token.length > 0);
        if (normalizedTokens.length === 1) {
            let matchedIndex = -1;
            for (let index = 0; index < total; index += 1) {
                const playerName = this.normalizePlayerName(this.getPlayerNameByIndex(index) ?? '');
                if (!playerName) {
                    continue;
                }
                const playerTokens = playerName.split(' ').filter((token) => token.length > 0);
                if (!playerTokens.includes(normalizedTokens[0])) {
                    continue;
                }
                if (matchedIndex !== -1) {
                    return -1;
                }
                matchedIndex = index;
            }
            return matchedIndex;
        }
        if (normalizedTokens.length < 2) {
            return -1;
        }
        const targetLastToken = normalizedTokens[normalizedTokens.length - 1];
        const targetInitial = normalizedTokens[0][0];
        let surnameOnlyMatch = -1;
        for (let index = 0; index < total; index += 1) {
            const playerName = this.normalizePlayerName(this.getPlayerNameByIndex(index) ?? '');
            if (!playerName) {
                continue;
            }
            if (playerName !== targetLastToken) {
                continue;
            }
            if (surnameOnlyMatch !== -1) {
                surnameOnlyMatch = -1;
                break;
            }
            surnameOnlyMatch = index;
        }
        if (surnameOnlyMatch !== -1) {
            return surnameOnlyMatch;
        }
        for (let index = 0; index < total; index += 1) {
            const playerName = this.normalizePlayerName(this.getPlayerNameByIndex(index) ?? '');
            if (!playerName) {
                continue;
            }
            const playerTokens = playerName.split(' ').filter((token) => token.length > 0);
            if (playerTokens.length < 2) {
                continue;
            }
            if (playerTokens[playerTokens.length - 1] === targetLastToken && playerTokens[0][0] === targetInitial) {
                return index;
            }
        }
        return -1;
    }
    parsePlayerId(value) {
        const parsed = Number.parseInt(value.trim(), 16);
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 0xffff) {
            return -1;
        }
        return this.findPlayerIndexByStoredId(parsed);
    }
    findPlayerIndexByStoredId(storedId) {
        if (!Number.isFinite(storedId) || storedId < 0 || storedId > 0xffff) {
            return -1;
        }
        const total = this.totalPlayers;
        for (let index = 0; index < total; index += 1) {
            if (this.getStoredPlayerId(index) === storedId) {
                return index;
            }
        }
        return -1;
    }
    normalizePlayerName(value) {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }
    getPlayerNameByIndex(index) {
        if (!this.binaryData || index < 0 || index >= this.totalPlayers) {
            return null;
        }
        return this.readPlayer(index).name || null;
    }
    getStoredPlayerId(index) {
        if (!this.binaryData || index < 0 || index >= this.totalPlayers) {
            return index;
        }
        const view = new DataView(this.binaryData.buffer);
        const base = index * this.playerStride;
        return view.getUint16(base + this.playerIdOffset, true);
    }
    get totalPlayers() {
        if (!this.binaryData) {
            return 0;
        }
        const headerTotal = new DataView(this.binaryData.buffer).getUint16(this.totalPlayersOffset, true);
        const derivedTotal = this.getDerivedPlayerCount(this.binaryData.byteLength);
        // Prefer the derived count to avoid trusting corrupted headers that can cause out-of-bounds access.
        if (derivedTotal > 0) {
            return derivedTotal;
        }
        return headerTotal;
    }
    getDerivedPlayerCount(byteLength) {
        if (!Number.isFinite(byteLength) || byteLength < this.yearOffset + 2) {
            return 0;
        }
        return Math.floor((byteLength - (this.yearOffset + 2)) / this.playerStride) + 1;
    }
    replacePlayers(players, options = {}) {
        if (!this.binaryData) {
            throw new Error('No file loaded');
        }
        const previousTotal = this.totalPlayers;
        const templateRecord = this.captureTemplateRecord(options.templatePlayerIndex, previousTotal);
        const replaced = Math.min(players.length, 0xffff);
        const nextTotal = replaced;
        const requiredLength = nextTotal > 0
            ? (nextTotal - 1) * this.playerStride + this.yearOffset + 2
            : this.totalPlayersOffset + 2;
        if (this.binaryData.byteLength !== requiredLength) {
            const nextBinaryData = new Uint8Array(requiredLength);
            const copyLength = Math.min(this.binaryData.byteLength, requiredLength);
            nextBinaryData.set(this.binaryData.subarray(0, copyLength));
            this.binaryData = nextBinaryData;
        }
        const headerView = new DataView(this.binaryData.buffer);
        headerView.setUint16(this.totalPlayersOffset, nextTotal, true);
        if (templateRecord) {
            for (let index = 0; index < replaced; index++) {
                this.seedPlayerRecord(index, templateRecord);
            }
        }
        for (let index = 0; index < replaced; index++) {
            this.writePlayer(index, players[index]);
        }
        return { replaced, previousTotal, nextTotal };
    }
    captureTemplateRecord(templatePlayerIndex, previousTotal) {
        if (templatePlayerIndex === undefined || templatePlayerIndex < 0 || templatePlayerIndex >= previousTotal || !this.binaryData) {
            return null;
        }
        const templateBase = templatePlayerIndex * this.playerStride;
        return new Uint8Array(this.binaryData.slice(templateBase, templateBase + this.playerStride));
    }
    seedPlayerRecord(index, templateRecord) {
        if (!this.binaryData) {
            return;
        }
        const targetBase = index * this.playerStride;
        this.binaryData.set(templateRecord, targetBase);
    }
    async loadFile(fileHandle) {
        if (!window.showOpenFilePicker) {
            throw new Error('Your browser does not support File System Access API. Use Chrome.');
        }
        let nextHandle = fileHandle;
        if (!nextHandle) {
            const handles = await window.showOpenFilePicker({
                multiple: false,
                types: [{ description: 'DAT Files', accept: { 'application/octet-stream': ['.dat'] } }]
            });
            nextHandle = handles[0];
        }
        const file = await nextHandle.getFile();
        const buffer = await file.arrayBuffer();
        this.fileHandle = nextHandle;
        this.binaryData = new Uint8Array(pako.inflate(new Uint8Array(buffer)));
        await this.fileHandleStorage.saveFileHandle(this.storageKey, nextHandle);
        return file.name;
    }
    async tryRestoreLastFile() {
        const storedHandle = await this.fileHandleStorage.getFileHandle(this.storageKey);
        if (!storedHandle || !(await this.hasReadPermission(storedHandle))) {
            return null;
        }
        try {
            return await this.loadFile(storedHandle);
        }
        catch {
            this.binaryData = null;
            this.fileHandle = null;
            await this.fileHandleStorage.deleteFileHandle(this.storageKey);
            return null;
        }
    }
    async saveToSameFile(player, idx) {
        if (!this.fileHandle || !this.binaryData)
            throw new Error('No file loaded');
        this.writePlayer(idx, player);
        const writable = await this.fileHandle.createWritable();
        await writable.write(pako.deflate(this.binaryData));
        await writable.close();
    }
    async saveCurrentToSameFile() {
        if (!this.fileHandle || !this.binaryData) {
            throw new Error('No file loaded');
        }
        const writable = await this.fileHandle.createWritable();
        await writable.write(pako.deflate(this.binaryData));
        await writable.close();
    }
    async downloadFile() {
        if (!this.binaryData)
            return;
        const blob = new Blob([pako.deflate(this.binaryData)], { type: 'application/octet-stream' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'players.dat';
        a.click();
    }
    readPlayer(idx) {
        const view = new DataView(this.binaryData.buffer);
        const base = idx * 112;
        const nameArr = new Uint8Array(this.binaryData.buffer.slice(base + 48, base + 80));
        const name = new TextDecoder('utf-16').decode(nameArr).replace(/\0/g, '').trim();
        const hiddenFromTransferMarket = view.getUint8(base + this.hiddenFromTransferMarketOffset);
        const isIconLegend = view.getUint8(base + this.isIconLegendOffset);
        const canReadBirthFields = this.birthMonthOffset + 4 <= this.playerStride;
        const birthDay = canReadBirthFields ? view.getUint32(base + this.birthDayOffset, true) : 1;
        const birthMonth = canReadBirthFields ? view.getUint32(base + this.birthMonthOffset, true) : 1;
        const year = view.getUint16(base + 120, true);
        const player = { name, hiddenFromTransferMarket, isIconLegend, birthDay, birthMonth, year };
        for (const key of Object.keys(exports.OFFSET_MAP)) {
            player[key] = view.getUint8(base + exports.OFFSET_MAP[key]);
        }
        return player;
    }
    writePlayer(idx, player) {
        const view = new DataView(this.binaryData.buffer);
        const base = idx * 112;
        const truncatedName = player.name.slice(0, 16);
        player.name = truncatedName;
        for (let i = 0; i < 16; i++) {
            view.setUint16(base + 48 + i * 2, i < truncatedName.length ? truncatedName.charCodeAt(i) : 0, true);
        }
        view.setUint16(base + this.playerIdOffset, idx, true);
        view.setUint8(base + this.hiddenFromTransferMarketOffset, player.hiddenFromTransferMarket ?? 0);
        view.setUint8(base + this.isIconLegendOffset, player.isIconLegend ?? 0);
        const canWriteBirthFields = this.birthMonthOffset + 4 <= this.playerStride;
        if (canWriteBirthFields) {
            view.setUint32(base + this.birthDayOffset, player.birthDay, true);
            view.setUint32(base + this.birthMonthOffset, player.birthMonth, true);
        }
        for (const key of Object.keys(exports.OFFSET_MAP)) {
            view.setUint8(base + exports.OFFSET_MAP[key], player[key]);
        }
        view.setUint16(base + 120, player.year, true);
    }
    searchPlayer(query) {
        const q = query.trim().toLowerCase();
        if (!q) {
            return -1;
        }
        const total = this.totalPlayers;
        for (let i = 0; i < total; i++) {
            const nameArr = new Uint8Array(this.binaryData.buffer.slice(i * 112 + 48, i * 112 + 80));
            const name = new TextDecoder('utf-16').decode(nameArr).toLowerCase();
            const playerId = this.formatPlayerId(i).toLowerCase();
            if (name.includes(q) || playerId.includes(q))
                return i;
        }
        return -1;
    }
    calculateOVR(player) {
        const posCategory = getPositionCategory(player.pos);
        const { weights, bonus, multiplier } = this.getProfileByPositionCategory(posCategory);
        let weightedSum = 0;
        let totalWeight = 0;
        let maxStat = 0;
        for (let i = 0; i < STAT_ORDER.length; i++) {
            const stat = player[STAT_ORDER[i]];
            weightedSum += weights[i] * stat;
            totalWeight += weights[i];
            if (stat > maxStat) {
                maxStat = stat;
            }
        }
        const denominator = bonus + totalWeight;
        if (denominator <= 0) {
            return 0;
        }
        const raw = Math.floor((bonus * maxStat + weightedSum) * multiplier / denominator);
        return Math.max(0, Math.min(100, raw));
    }
    getOvrTuningConfig() {
        return [
            {
                category: 'gk',
                label: 'GK',
                weights: [...this.profiles.gk.weights],
                bonus: this.profiles.gk.bonus,
                multiplier: this.profiles.gk.multiplier
            },
            {
                category: 'def',
                label: 'DEF',
                weights: [...this.profiles.def.weights],
                bonus: this.profiles.def.bonus,
                multiplier: this.profiles.def.multiplier
            },
            {
                category: 'mid',
                label: 'MID',
                weights: [...this.profiles.mid.weights],
                bonus: this.profiles.mid.bonus,
                multiplier: this.profiles.mid.multiplier
            },
            {
                category: 'att',
                label: 'ATT',
                weights: [...this.profiles.att.weights],
                bonus: this.profiles.att.bonus,
                multiplier: this.profiles.att.multiplier
            }
        ];
    }
    setRatingMultiplier(category, multiplier) {
        if (!Number.isFinite(multiplier) || multiplier <= 0) {
            return;
        }
        this.profiles[category].multiplier = multiplier;
    }
    setOvrProfile(category, profile) {
        const currentProfile = this.profiles[category];
        if (profile.weights) {
            currentProfile.weights = [...profile.weights];
        }
        if (profile.bonus !== undefined && Number.isFinite(profile.bonus)) {
            currentProfile.bonus = profile.bonus;
        }
        if (profile.multiplier !== undefined) {
            this.setRatingMultiplier(category, profile.multiplier);
        }
    }
    getProfileByPositionCategory(posCategory) {
        switch (posCategory) {
            case 0:
                return this.profiles.gk;
            case 1:
                return this.profiles.def;
            case 2:
                return this.profiles.mid;
            default:
                return this.profiles.att;
        }
    }
    appendPlayers(players) {
        if (!this.binaryData || players.length === 0) {
            return [];
        }
        const prevTotal = this.totalPlayers;
        const count = Math.min(players.length, Math.max(0, 0xffff - prevTotal));
        if (count === 0) {
            return [];
        }
        const nextTotal = prevTotal + count;
        const requiredLength = (nextTotal - 1) * this.playerStride + this.yearOffset + 2;
        const nextBinaryData = new Uint8Array(requiredLength);
        nextBinaryData.set(this.binaryData.subarray(0, Math.min(this.binaryData.byteLength, requiredLength)));
        this.binaryData = nextBinaryData;
        const view = new DataView(this.binaryData.buffer);
        view.setUint16(this.totalPlayersOffset, nextTotal, true);
        const templateRecord = prevTotal > 0 ? this.captureTemplateRecord(0, prevTotal) : null;
        const newIndices = [];
        for (let i = 0; i < count; i++) {
            const index = prevTotal + i;
            if (templateRecord) {
                this.seedPlayerRecord(index, templateRecord);
            }
            this.writePlayer(index, players[i]);
            newIndices.push(index);
        }
        return newIndices;
    }
    async hasReadPermission(fileHandle) {
        if (!fileHandle || typeof fileHandle.queryPermission !== 'function') {
            return false;
        }
        return (await fileHandle.queryPermission({ mode: 'read' })) === 'granted';
    }
};
PlayerService = __decorate([
    (0, core_1.Injectable)({ providedIn: 'root' })
], PlayerService);
exports.PlayerService = PlayerService;
