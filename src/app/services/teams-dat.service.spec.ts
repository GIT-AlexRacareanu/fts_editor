/// <reference types="jasmine" />

import { TeamsDatService } from './teams-dat.service';

const FILE_HEADER_SIZE = 12;
const TEAM_BLOCK_SIZE = 4356;
const KIT_COLOR_START_OFFSET = 0x18;
const KIT_STYLE_START_OFFSET = 0xBC;
const SPONSOR_TYPE_OFFSET = 0x100;
const KIT_MANUFACTURER_OFFSET = 0x104;
const EUROPEAN_COMPETITION_OFFSET = 0x124;

describe('TeamsDatService', () => {
  it('parses the four kit palettes from the team block color area', () => {
    const service = new TeamsDatService({} as any);
    const teamDataBytes = new Uint8Array(TEAM_BLOCK_SIZE);
    const view = new DataView(teamDataBytes.buffer);

    view.setUint32(0, 99, true);
    teamDataBytes[KIT_COLOR_START_OFFSET] = 0x0A;
    teamDataBytes[KIT_COLOR_START_OFFSET + 1] = 0xFF;
    teamDataBytes[KIT_COLOR_START_OFFSET + 2] = 0xFF;
    teamDataBytes[KIT_COLOR_START_OFFSET + 3] = 0x7F;

    service.fileHeaderBytes = new Uint8Array(FILE_HEADER_SIZE);
    service.teamDataBytes = teamDataBytes;
    service.records = [(service as any).parseRecord(0)];

    const record = service.records[0];

    expect(record.kits.length).toBe(4);
    expect(record.kits[0].label).toBe('Home');
    expect(record.kits[0].colors.length).toBe(10);
    expect(record.kits[0].colors[0].hex).toBe('#FFFF0A');
    expect(record.kits[0].colors[0].rawHex).toBe('0AFFFF7F');
    expect(record.kits[0].colors[0].fileOffset).toBe(0x24);
  });

  it('updates a kit color without overwriting the fourth byte', () => {
    const service = new TeamsDatService({} as any);
    const teamDataBytes = new Uint8Array(TEAM_BLOCK_SIZE);
    const view = new DataView(teamDataBytes.buffer);

    view.setUint32(0, 99, true);
    teamDataBytes[KIT_COLOR_START_OFFSET] = 0xAA;
    teamDataBytes[KIT_COLOR_START_OFFSET + 1] = 0xBB;
    teamDataBytes[KIT_COLOR_START_OFFSET + 2] = 0xCC;
    teamDataBytes[KIT_COLOR_START_OFFSET + 3] = 0x7F;

    service.fileHeaderBytes = new Uint8Array(FILE_HEADER_SIZE);
    service.teamDataBytes = teamDataBytes;
    service.records = [(service as any).parseRecord(0)];

    const updated = service.updateKitColor(0, 0, 0, '#112233');

    expect(teamDataBytes[KIT_COLOR_START_OFFSET]).toBe(0x33);
    expect(teamDataBytes[KIT_COLOR_START_OFFSET + 1]).toBe(0x22);
    expect(teamDataBytes[KIT_COLOR_START_OFFSET + 2]).toBe(0x11);
    expect(teamDataBytes[KIT_COLOR_START_OFFSET + 3]).toBe(0x7F);
    expect(updated.kits[0].colors[0].hex).toBe('#112233');
    expect(updated.kits[0].colors[0].rawHex).toBe('3322117F');
  });

  it('writes modified kit colors back through saveToSameFile and clears the pending flag', async () => {
    const service = new TeamsDatService({} as any);
    const headerBytes = new Uint8Array(FILE_HEADER_SIZE);
    const teamDataBytes = new Uint8Array(TEAM_BLOCK_SIZE);
    const view = new DataView(teamDataBytes.buffer);
    const writes: ArrayBuffer[] = [];

    view.setUint32(0, 99, true);
    teamDataBytes[KIT_COLOR_START_OFFSET + 3] = 0x7F;

    service.fileHeaderBytes = headerBytes;
    service.teamDataBytes = teamDataBytes;
    service.records = [(service as any).parseRecord(0)];
    service.fileHandle = {
      createWritable: async () => ({
        write: async (value: ArrayBuffer) => { writes.push(value); },
        close: async () => {}
      })
    };

    service.updateKitColor(0, 0, 0, '#112233');
    expect(service.hasPendingChanges).toBeTrue();

    await service.saveToSameFile();

    expect(service.hasPendingChanges).toBeFalse();
    expect(writes.length).toBe(1);

    const savedBytes = new Uint8Array(writes[0]);
    expect(savedBytes[0x24]).toBe(0x33);
    expect(savedBytes[0x25]).toBe(0x22);
    expect(savedBytes[0x26]).toBe(0x11);
    expect(savedBytes[0x27]).toBe(0x7F);
  });

  it('parses kit style ids from the style block after the color area gap', () => {
    const service = new TeamsDatService({} as any);
    const teamDataBytes = new Uint8Array(TEAM_BLOCK_SIZE);
    const view = new DataView(teamDataBytes.buffer);

    view.setUint32(0, 99, true);
    view.setUint32(KIT_STYLE_START_OFFSET, 9, true);
    view.setUint32(KIT_STYLE_START_OFFSET + 4, 5, true);
    view.setUint32(KIT_STYLE_START_OFFSET + 8, 1, true);
    view.setUint32(KIT_STYLE_START_OFFSET + 12, 15, true);

    service.fileHeaderBytes = new Uint8Array(FILE_HEADER_SIZE);
    service.teamDataBytes = teamDataBytes;
    service.records = [(service as any).parseRecord(0)];

    expect(service.records[0].kits.map((kit) => kit.styleId)).toEqual([9, 5, 1, 15]);
    expect(service.records[0].kits[0].styleLabel).toBe('Sleeves');
    expect(service.records[0].kits[3].styleFileOffset).toBe(0xD4);
  });

  it('updates a kit style id in place and marks teams.dat dirty', () => {
    const service = new TeamsDatService({} as any);
    const teamDataBytes = new Uint8Array(TEAM_BLOCK_SIZE);
    const view = new DataView(teamDataBytes.buffer);

    view.setUint32(0, 99, true);

    service.fileHeaderBytes = new Uint8Array(FILE_HEADER_SIZE);
    service.teamDataBytes = teamDataBytes;
    service.records = [(service as any).parseRecord(0)];

    const updated = service.updateKitStyle(0, 2, 14);

    expect(view.getUint32(KIT_STYLE_START_OFFSET + 8, true)).toBe(14);
    expect(updated.kits[2].styleId).toBe(14);
    expect(updated.kits[2].styleLabel).toBe('Gradient B');
    expect(service.hasPendingChanges).toBeTrue();
  });

  it('parses sponsor type and kit manufacturer from the team block metadata area', () => {
    const service = new TeamsDatService({} as any);
    const teamDataBytes = new Uint8Array(TEAM_BLOCK_SIZE);
    const view = new DataView(teamDataBytes.buffer);

    view.setUint32(0, 99, true);
    view.setUint32(SPONSOR_TYPE_OFFSET, 12, true);
    view.setUint32(KIT_MANUFACTURER_OFFSET, 34, true);

    service.fileHeaderBytes = new Uint8Array(FILE_HEADER_SIZE);
    service.teamDataBytes = teamDataBytes;
    service.records = [(service as any).parseRecord(0)];

    expect(service.records[0].sponsorType).toBe(12);
    expect(service.records[0].kitManufacturer).toBe(34);
  });

  it('updates sponsor type and kit manufacturer through updateRecord', () => {
    const service = new TeamsDatService({} as any);
    const teamDataBytes = new Uint8Array(TEAM_BLOCK_SIZE);
    const view = new DataView(teamDataBytes.buffer);

    view.setUint32(0, 99, true);

    service.fileHeaderBytes = new Uint8Array(FILE_HEADER_SIZE);
    service.teamDataBytes = teamDataBytes;
    service.records = [(service as any).parseRecord(0)];

    const updated = service.updateRecord(0, { sponsorType: 21, kitManufacturer: 42 });

    expect(view.getUint32(SPONSOR_TYPE_OFFSET, true)).toBe(21);
    expect(view.getUint32(KIT_MANUFACTURER_OFFSET, true)).toBe(42);
    expect(updated.sponsorType).toBe(21);
    expect(updated.kitManufacturer).toBe(42);
    expect(service.hasPendingChanges).toBeTrue();
  });

  it('parses european competition from the team block metadata area', () => {
    const service = new TeamsDatService({} as any);
    const teamDataBytes = new Uint8Array(TEAM_BLOCK_SIZE);
    const view = new DataView(teamDataBytes.buffer);

    view.setUint32(0, 99, true);
    view.setUint32(EUROPEAN_COMPETITION_OFFSET, 2, true);

    service.fileHeaderBytes = new Uint8Array(FILE_HEADER_SIZE);
    service.teamDataBytes = teamDataBytes;
    service.records = [(service as any).parseRecord(0)];

    expect(service.records[0].europeanCompetition).toBe(2);
  });

  it('updates european competition through updateRecord', () => {
    const service = new TeamsDatService({} as any);
    const teamDataBytes = new Uint8Array(TEAM_BLOCK_SIZE);
    const view = new DataView(teamDataBytes.buffer);

    view.setUint32(0, 99, true);

    service.fileHeaderBytes = new Uint8Array(FILE_HEADER_SIZE);
    service.teamDataBytes = teamDataBytes;
    service.records = [(service as any).parseRecord(0)];

    const updated = service.updateRecord(0, { europeanCompetition: 1 });

    expect(view.getUint32(EUROPEAN_COMPETITION_OFFSET, true)).toBe(1);
    expect(updated.europeanCompetition).toBe(1);
    expect(service.hasPendingChanges).toBeTrue();
  });
});