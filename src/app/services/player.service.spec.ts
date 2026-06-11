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
  });

  it('derives player count from the file length when more records exist than the header says', () => {
    const service = new PlayerService({} as any);
    const binaryData = new Uint8Array(122 + 2 * 112);
    const view = new DataView(binaryData.buffer);

    view.setUint16(8, 13364, true);
    service.binaryData = binaryData;

    expect(service.totalPlayers).toBe(3);
  });

  it('treats LM and RM as midfielders for OVR calculation', () => {
    const service = new PlayerService({} as any);
    const stats = {
      STR: 64,
      STA: 78,
      SPD: 75,
      ACC: 77,
      TAC: 63,
      CON: 81,
      SHO: 61,
      CRO: 84,
      FK: 73,
      PAS: 80,
      HEA: 58,
      GKS: 20,
      GKH: 20,
      GKP: 20
    };

    const cmOvr = service.calculateOVR(createPlayer('CM', { pos: 11, ...stats }));
    const rmOvr = service.calculateOVR(createPlayer('RM', { pos: 16, ...stats }));
    const lmOvr = service.calculateOVR(createPlayer('LM', { pos: 17, ...stats }));

    expect(rmOvr).toBe(cmOvr);
    expect(lmOvr).toBe(cmOvr);
  });

  it('finds players by normalized names and common abbreviated variants', () => {
    const service = new PlayerService({} as any);
    service.binaryData = new Uint8Array(234);

    service.replacePlayers([
      createPlayer('Mohamed Salah'),
      createPlayer('Luka Modric')
    ]);

    expect(service.findPlayerIndexByName('mohamed salah')).toBe(0);
    expect(service.findPlayerIndexByName('M. Salah')).toBe(0);
    expect(service.findPlayerIndexByName('Luka Modric')).toBe(1);
  });

  it('keeps header count aligned with byte length after bulk replacement', () => {
    const service = new PlayerService({} as any);
    service.binaryData = new Uint8Array(234);

    const replacement: Player[] = [
      createPlayer('Imported One'),
      createPlayer('Imported Two'),
      createPlayer('Imported Three')
    ];

    const result = service.replacePlayers(replacement);
    const view = new DataView(service.binaryData!.buffer);
    const headerTotal = view.getUint16(8, true);
    const expectedLength = (result.nextTotal - 1) * 112 + 122;

    expect(result.nextTotal).toBe(3);
    expect(headerTotal).toBe(3);
    expect(service.binaryData!.byteLength).toBe(expectedLength);
    expect(service.totalPlayers).toBe(3);
  });

  it('can reopen the replaced binary payload through the same inflate/decode path', async () => {
    const service = new PlayerService({ saveFileHandle: async () => {} } as any);
    service.binaryData = new Uint8Array(234);
    service.replacePlayers([
      createPlayer('Imported A', { pos: 11 }),
      createPlayer('Imported B', { pos: 19 })
    ]);

    const reopenedPayload = new Uint8Array(service.binaryData!);
    (globalThis as any).pako = {
      deflate: (input: Uint8Array) => input,
      inflate: (input: Uint8Array) => input
    };

    const fakeHandle = {
      getFile: async () => ({
        name: 'players.dat',
        arrayBuffer: async () => reopenedPayload.buffer.slice(0)
      })
    };

    const reopened = new PlayerService({ saveFileHandle: async () => {} } as any);
    await reopened.loadFile(fakeHandle);

    expect(reopened.totalPlayers).toBe(2);
    expect(reopened.readPlayer(0).name).toContain('Imported A');
    expect(reopened.readPlayer(1).name).toContain('Imported B');
  });
});

function seedTemplateRecord(binaryData: Uint8Array, index: number, value: number): void {
  const base = index * 112;
  const offsets = [0, 10, 47, 80, 109, 111];

  offsets.forEach((offset) => {
    binaryData[base + offset] = value;
  });
}

function createPlayer(name: string, overrides: Partial<Player> = {}): Player {
  return {
    name,
    pos: 0,
    foot: 0,
    nat: 0,
    estatura: 180,
    peso: 75,
    birthDay: 1,
    birthMonth: 1,
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
    GKP: 0,
    ...overrides
  };
}