/// <reference types="jasmine" />

import { Player } from '../models/player.model';
import { PlayerService } from './player.service';

describe('PlayerService', () => {
  it('seeds each replaced record from the template player before writing imported fields', () => {
    const service = new PlayerService({} as any);
    const binaryData = new Uint8Array(234);
    const view = new DataView(binaryData.buffer);

    view.setUint16(8, 2, true);

    seedTemplateRecord(binaryData, 0, 0x11);
    seedTemplateRecord(binaryData, 1, 0x77);

    service.binaryData = binaryData;

    const players: Player[] = [createPlayer('Player One'), createPlayer('Player Two')];

    service.replacePlayers(players, { templatePlayerIndex: 0 });

    expect(binaryData[112]).toBe(0x11);
    expect(binaryData[122]).toBe(0x11);
    expect(binaryData[159]).toBe(0x11);
    expect(binaryData[192]).toBe(0x11);
    expect(binaryData[221]).toBe(0x11);
    expect(binaryData[223]).toBe(0x11);
  });

  it('derives player count from the file length when more records exist than the header says', () => {
    const service = new PlayerService({} as any);
    const binaryData = new Uint8Array(122 + 2 * 112);
    const view = new DataView(binaryData.buffer);

    view.setUint16(8, 13364, true);
    service.binaryData = binaryData;

    expect(service.totalPlayers).toBe(3);
  });
});

function seedTemplateRecord(binaryData: Uint8Array, index: number, value: number): void {
  const base = index * 112;
  const offsets = [0, 10, 47, 80, 109, 111];

  offsets.forEach((offset) => {
    binaryData[base + offset] = value;
  });
}

function createPlayer(name: string): Player {
  return {
    name,
    pos: 0,
    foot: 0,
    nat: 0,
    estatura: 180,
    peso: 75,
    year: 2000,
    skin: 0,
    skin_tone: 0,
    head_type: 0,
    hair_type: 0,
    hair: 0,
    beard_type: 0,
    boots: 0,
    mangas: 0,
    guantes: 0,
    ACC: 0,
    SPD: 0,
    STA: 0,
    STR: 0,
    TAC: 0,
    CON: 0,
    SHO: 0,
    CRO: 0,
    FK: 0,
    PAS: 0,
    HEA: 0,
    GKS: 0,
    GKH: 0,
    GKP: 0
  };
}