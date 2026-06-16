/// <reference types="jasmine" />

import { XlcEditorService } from './xlc-editor.service';

describe('XlcEditorService', () => {
  it('prefers the first non-empty locale for direct key lookup', async () => {
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_1', ['', 'Arsenal']],
      ['TXT_TEAMNAMESHORT_1', ['', 'ARS']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));

    expect(service.getValueByKey('TXT_TEAMNAMELONG_1')).toBe('Arsenal');
    expect(service.getLocaleValueByKey('TXT_TEAMNAMELONG_1')?.localeId).toBe(1);
  });

  it('parses directory-based locale blocks so team names become visible', async () => {
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_1', ['Arsenal', 'Arsenal FR']],
      ['TXT_TEAMNAMESHORT_1', ['ARS', 'ARS FR']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));

    expect(service.entries.length).toBe(2);
    expect(service.getValueByKey('TXT_TEAMNAMELONG_1')).toBe('Arsenal');
    expect(service.entries[0].locales.length).toBe(2);
    expect(service.entries[0].locales[1].value).toBe('Arsenal FR');
  });

  it('parses long-key section then short-key section across six locale blocks', async () => {
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_500', ['Arsenal EN', 'Arsenal ES', 'Arsenal IT', 'Arsenal DE', 'Arsenal FR', 'Arsenal PT']],
      ['TXT_TEAMNAMELONG_501', ['Chelsea EN', 'Chelsea ES', 'Chelsea IT', 'Chelsea DE', 'Chelsea FR', 'Chelsea PT']],
      ['TXT_TEAMNAMESHORT_500', ['ARS', 'ARS ES', 'ARS IT', 'ARS DE', 'ARS FR', 'ARS PT']],
      ['TXT_TEAMNAMESHORT_501', ['CHE', 'CHE ES', 'CHE IT', 'CHE DE', 'CHE FR', 'CHE PT']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));

    expect(service.entries.map((entry) => entry.key)).toEqual([
      'TXT_TEAMNAMELONG_500',
      'TXT_TEAMNAMELONG_501',
      'TXT_TEAMNAMESHORT_500',
      'TXT_TEAMNAMESHORT_501'
    ]);
    expect(service.entries[0].locales.length).toBe(6);
    expect(service.entries[0].locales[0].value).toBe('Arsenal EN');
    expect(service.entries[0].locales[5].value).toBe('Arsenal PT');
    expect(service.entries[2].locales[0].value).toBe('ARS');
    expect(service.entries[2].locales[5].value).toBe('ARS PT');
    expect(service.getValueByKey('TXT_TEAMNAMELONG_500')).toBe('Arsenal EN');
    expect(service.getValueByKey('TXT_TEAMNAMESHORT_501')).toBe('CHE');
  });

  it('serializes edited names without appending visible padding characters', async () => {
    const { bytes, valuesStartOffset } = buildSimpleXlc([
      ['TXT_TEAMNAMELONG_1', 'Arsenal'],
      ['TXT_TEAMNAMESHORT_1', 'ARS']
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));
    service.updateValueByKey('TXT_TEAMNAMELONG_1', 'Roma');

    const serialized = (service as any).getSerializedData() as Uint8Array;

    expect((service as any).valuesStartOffset).toBe(valuesStartOffset);

    const firstValue = readUtf16Value(serialized, valuesStartOffset);
    const secondValue = readUtf16Value(serialized, firstValue.nextOffset);

    expect(firstValue.rawValue).toBe('Roma');
    expect(secondValue.rawValue).toBe('ARS');
  });

  it('allows longer long names to grow the serialized value table', async () => {
    const { bytes } = buildSimpleXlc([
      ['TXT_TEAMNAMELONG_1', 'Arsenal'],
      ['TXT_TEAMNAMESHORT_1', 'ARS']
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));
    service.updateValueByKey('TXT_TEAMNAMELONG_1', 'Real Valladolid Club de Futbol');

    const serialized = (service as any).getSerializedData() as Uint8Array;
    const firstValue = readUtf16Value(serialized, (service as any).valuesStartOffset);
    const secondValue = readUtf16Value(serialized, firstValue.nextOffset);

    expect(serialized.byteLength).toBeGreaterThan(bytes.byteLength);
    expect(firstValue.rawValue).toBe('Real Valladolid Club de Futbol');
    expect(secondValue.rawValue).toBe('ARS');
  });

  it('updates all locale values for the same key across nine languages', async () => {
    const localeValues = ['Arsenal EN', 'Arsenal ES', 'Arsenal IT', 'Arsenal DE', 'Arsenal FR', 'Arsenal PT', 'Arsenal NL', 'Arsenal JP', 'Arsenal US'];
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_500', localeValues],
      ['TXT_TEAMNAMESHORT_500', ['ARS', 'ARS', 'ARS', 'ARS', 'ARS', 'ARS', 'ARS', 'ARS', 'ARS']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));
    service.updateValueByKey('TXT_TEAMNAMELONG_500', 'Roma');

    const entry = service.entries.find((candidate) => candidate.key === 'TXT_TEAMNAMELONG_500');

    expect(entry).toBeTruthy();
    expect(entry?.locales.length).toBe(9);
    expect(entry?.locales.every((locale) => locale.value === 'Roma')).toBeTrue();
  });

  it('serializes multi-locale team-name edits back into all nine language blocks', async () => {
    const localeValues = ['Arsenal EN', 'Arsenal ES', 'Arsenal IT', 'Arsenal DE', 'Arsenal FR', 'Arsenal PT', 'Arsenal NL', 'Arsenal JP', 'Arsenal US'];
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_500', localeValues],
      ['TXT_TEAMNAMESHORT_500', ['ARS', 'ARS', 'ARS', 'ARS', 'ARS', 'ARS', 'ARS', 'ARS', 'ARS']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));
    service.updateValueByKey('TXT_TEAMNAMELONG_500', 'Roma');

    const serialized = (service as any).getSerializedData() as Uint8Array;
    const reloadedService = new XlcEditorService(createStorageStub() as any);
    await reloadedService.loadFile(createFileHandle(serialized, 'ftsteamnames.xlc'));

    const reloadedEntry = reloadedService.entries.find((candidate) => candidate.key === 'TXT_TEAMNAMELONG_500');

    expect(reloadedEntry).toBeTruthy();
    expect(reloadedEntry?.locales.length).toBe(9);
    expect(reloadedEntry?.locales.every((locale) => locale.value === 'Roma')).toBeTrue();
  });

  it('preserves nine distinct locale blocks in the serialized XGSL layout', async () => {
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_500', ['Arsenal EN', 'Arsenal ES', 'Arsenal IT', 'Arsenal DE', 'Arsenal FR', 'Arsenal PT', 'Arsenal NL', 'Arsenal JP', 'Arsenal US']],
      ['TXT_TEAMNAMESHORT_500', ['ARS', 'ARE', 'ARI', 'ARD', 'ARF', 'ARP', 'ARN', 'ARJ', 'ARU']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));
    service.updateValueByKey('TXT_TEAMNAMELONG_500', 'Roma');
    service.updateValueByKey('TXT_TEAMNAMESHORT_500', 'ROM');

    const serialized = (service as any).getSerializedData() as Uint8Array;
    const view = new DataView(serialized.buffer, serialized.byteOffset, serialized.byteLength);
    const localeCount = view.getUint32(0x0c, true);
    const blockStarts = Array.from({ length: localeCount }, (_, index) => view.getUint32(0x20 + index * 8, true));

    expect(localeCount).toBe(9);
    expect(new Set(blockStarts).size).toBe(9);

    blockStarts.forEach((blockStart) => {
      const firstValue = readUtf16Value(serialized, blockStart);
      const secondValue = readUtf16Value(serialized, firstValue.nextOffset);

      expect(firstValue.rawValue).toBe('Roma');
      expect(secondValue.rawValue).toBe('ROM');
    });
  });

  it('appends eight exact copies of the first names block during multi-locale save', async () => {
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_500', ['Arsenal EN', 'Arsenal ES', 'Arsenal IT', 'Arsenal DE', 'Arsenal FR', 'Arsenal PT', 'Arsenal NL', 'Arsenal JP', 'Arsenal US']],
      ['TXT_TEAMNAMESHORT_500', ['ARS', 'ARE', 'ARI', 'ARD', 'ARF', 'ARP', 'ARN', 'ARJ', 'ARU']],
      ['TXT_TEAMNAMELONG_501', ['Chelsea EN', 'Chelsea ES', 'Chelsea IT', 'Chelsea DE', 'Chelsea FR', 'Chelsea PT', 'Chelsea NL', 'Chelsea JP', 'Chelsea US']],
      ['TXT_TEAMNAMESHORT_501', ['CHE', 'CHS', 'CHI', 'CHD', 'CHF', 'CHP', 'CHN', 'CHJ', 'CHU']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));
    service.updateValueByKey('TXT_TEAMNAMELONG_500', 'Roma');
    service.updateValueByKey('TXT_TEAMNAMESHORT_500', 'ROM');

    const serialized = (service as any).getSerializedData() as Uint8Array;
    const view = new DataView(serialized.buffer, serialized.byteOffset, serialized.byteLength);
    const localeCount = view.getUint32(0x0c, true);
    const blockStarts = Array.from({ length: localeCount }, (_, index) => view.getUint32(0x20 + index * 8, true));
    const blockByteLength = blockStarts[1] - blockStarts[0];
    const firstBlock = serialized.slice(blockStarts[0], blockStarts[0] + blockByteLength);

    expect(localeCount).toBe(9);

    for (let index = 1; index < localeCount; index += 1) {
      const block = serialized.slice(blockStarts[index], blockStarts[index] + blockByteLength);
      expect(Array.from(block)).toEqual(Array.from(firstBlock));
    }

    const firstValue = readUtf16Value(firstBlock, 0);
    const secondValue = readUtf16Value(firstBlock, firstValue.nextOffset);
    const thirdValue = readUtf16Value(firstBlock, secondValue.nextOffset);
    const fourthValue = readUtf16Value(firstBlock, thirdValue.nextOffset);

    expect(firstValue.rawValue).toBe('Roma');
    expect(secondValue.rawValue).toBe('Chelsea EN');
    expect(thirdValue.rawValue).toBe('ROM');
    expect(fourthValue.rawValue).toBe('CHE');
  });

  it('keeps grouped long-key and short-key sections inside each saved block', async () => {
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_500', ['Arsenal EN', 'Arsenal ES', 'Arsenal IT', 'Arsenal DE', 'Arsenal FR', 'Arsenal PT', 'Arsenal NL', 'Arsenal JP', 'Arsenal US']],
      ['TXT_TEAMNAMELONG_501', ['Chelsea EN', 'Chelsea ES', 'Chelsea IT', 'Chelsea DE', 'Chelsea FR', 'Chelsea PT', 'Chelsea NL', 'Chelsea JP', 'Chelsea US']],
      ['TXT_TEAMNAMESHORT_500', ['ARS', 'ARE', 'ARI', 'ARD', 'ARF', 'ARP', 'ARN', 'ARJ', 'ARU']],
      ['TXT_TEAMNAMESHORT_501', ['CHE', 'CHS', 'CHI', 'CHD', 'CHF', 'CHP', 'CHN', 'CHJ', 'CHU']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));

    const serialized = (service as any).getSerializedData() as Uint8Array;
    const firstBlockStart = new DataView(serialized.buffer, serialized.byteOffset, serialized.byteLength).getUint32(0x20, true);
    const firstValue = readUtf16Value(serialized, firstBlockStart);
    const secondValue = readUtf16Value(serialized, firstValue.nextOffset);
    const thirdValue = readUtf16Value(serialized, secondValue.nextOffset);
    const fourthValue = readUtf16Value(serialized, thirdValue.nextOffset);

    expect(firstValue.rawValue).toBe('Arsenal EN');
    expect(secondValue.rawValue).toBe('Chelsea EN');
    expect(thirdValue.rawValue).toBe('ARS');
    expect(fourthValue.rawValue).toBe('CHE');
  });

  it('uses the compact grouped block with no extra serializer-added tail for each duplicated block', async () => {
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_500', ['Arsenal EN', 'Arsenal ES', 'Arsenal IT', 'Arsenal DE', 'Arsenal FR', 'Arsenal PT', 'Arsenal NL', 'Arsenal JP', 'Arsenal US']],
      ['TXT_TEAMNAMESHORT_500', ['ARS', 'ARE', 'ARI', 'ARD', 'ARF', 'ARP', 'ARN', 'ARJ', 'ARU']],
      ['TXT_TEAMNAMELONG_501', ['Chelsea EN', 'Chelsea ES', 'Chelsea IT', 'Chelsea DE', 'Chelsea FR', 'Chelsea PT', 'Chelsea NL', 'Chelsea JP', 'Chelsea US']],
      ['TXT_TEAMNAMESHORT_501', ['CHE', 'CHS', 'CHI', 'CHD', 'CHF', 'CHP', 'CHN', 'CHJ', 'CHU']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));
    service.updateValueByKey('TXT_TEAMNAMELONG_500', 'Roma');
    service.updateValueByKey('TXT_TEAMNAMESHORT_500', 'ROM');

    const serialized = (service as any).getSerializedData() as Uint8Array;
    const view = new DataView(serialized.buffer, serialized.byteOffset, serialized.byteLength);
    const localeCount = view.getUint32(0x0c, true);
    const blockStart = view.getUint32(0x20, true);
    const nextBlockStart = view.getUint32(0x28, true);
    const blockLength = nextBlockStart - blockStart;
    const expectedBlockLength = encodeUtf16LeNullTerminated('Roma').byteLength
      + encodeUtf16LeNullTerminated('Chelsea EN').byteLength
      + encodeUtf16LeNullTerminated('ROM').byteLength
      + encodeUtf16LeNullTerminated('CHE').byteLength;

    expect(localeCount).toBe(9);
    expect(blockLength).toBe(expectedBlockLength);
    expect(serialized.byteLength).toBe(blockStart + blockLength * localeCount);
  });

  it('parses legacy repeated-block files as nine preserved locales', async () => {
    const bytes = buildLegacyRepeatedBlockXlc([
      ['TXT_TEAMNAMELONG_0', 'Arsenal'],
      ['TXT_TEAMNAMESHORT_0', 'ARS'],
      ['TXT_TEAMNAMELONG_1', 'Chelsea'],
      ['TXT_TEAMNAMESHORT_1', 'CHE']
    ], 9);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));

    expect(service.entries.length).toBe(4);
    expect(service.entries[0].locales.length).toBe(9);
    expect(service.entries[0].locales.every((locale) => locale.value === 'Arsenal')).toBeTrue();
    expect(service.entries[1].locales.every((locale) => locale.value === 'ARS')).toBeTrue();
  });

  it('duplicates saved blocks back-to-back without adding a new separator tail', async () => {
    const bytes = buildDirectoryXlc([
      ['TXT_TEAMNAMELONG_500', ['Arsenal EN', 'Arsenal ES', 'Arsenal IT', 'Arsenal DE', 'Arsenal FR', 'Arsenal PT', 'Arsenal NL', 'Arsenal JP', 'Arsenal US']],
      ['TXT_TEAMNAMESHORT_500', ['ARS', 'ARE', 'ARI', 'ARD', 'ARF', 'ARP', 'ARN', 'ARJ', 'ARU']]
    ]);
    const service = new XlcEditorService(createStorageStub() as any);

    await service.loadFile(createFileHandle(bytes, 'ftsteamnames.xlc'));

    const serialized = (service as any).getSerializedData() as Uint8Array;
    const view = new DataView(serialized.buffer, serialized.byteOffset, serialized.byteLength);
    const firstBlockStart = view.getUint32(0x20, true);
    const secondBlockStart = view.getUint32(0x28, true);
    const firstBlock = serialized.slice(firstBlockStart, secondBlockStart);
    const expectedBlockLength = encodeUtf16LeNullTerminated('Arsenal EN').byteLength
      + encodeUtf16LeNullTerminated('ARS').byteLength;

    expect(firstBlock.byteLength).toBe(expectedBlockLength);
  });
});

function buildSimpleXlc(entries: Array<[string, string]>): {
  bytes: Uint8Array;
  valuesStartOffset: number;
} {
  const keyBytes = entries.map(([key]) => encodeUtf16LeNullTerminated(key));
  const valueBytes = entries.map(([, value]) => encodeUtf16LeNullTerminated(value));
  const valuesStartOffset = 0x28 + keyBytes.reduce((sum, value) => sum + value.byteLength, 0);
  const totalLength = valuesStartOffset + valueBytes.reduce((sum, value) => sum + value.byteLength, 0);
  const bytes = new Uint8Array(totalLength);
  const view = new DataView(bytes.buffer);

  bytes[0] = 'X'.charCodeAt(0);
  bytes[1] = 'G'.charCodeAt(0);
  bytes[2] = 'S'.charCodeAt(0);
  bytes[3] = 'L'.charCodeAt(0);
  view.setUint32(0x0c, 1, true);
  view.setUint32(0x20, valuesStartOffset, true);
  view.setUint32(0x24, 0, true);

  let cursor = 0x28;
  keyBytes.forEach((key) => {
    bytes.set(key, cursor);
    cursor += key.byteLength;
  });

  valueBytes.forEach((value) => {
    bytes.set(value, cursor);
    cursor += value.byteLength;
  });

  return { bytes, valuesStartOffset };
}

function buildDirectoryXlc(entries: Array<[string, string[]]>): Uint8Array {
  const localeCount = entries[0]?.[1].length ?? 0;

  if (localeCount < 1) {
    throw new Error('Expected at least one locale value.');
  }

  const keyBytes = entries.map(([key]) => encodeUtf16LeNullTerminated(key));
  const keyTableStart = 0x20 + localeCount * 8;
  const keyTableLength = keyBytes.reduce((sum, value) => sum + value.byteLength, 0);
  const blockStarts: number[] = [];
  const valueBlocks = Array.from({ length: localeCount }, (_, localeIndex) => {
    const blockStart = (localeIndex === 0 ? keyTableStart + keyTableLength : 0);
    blockStarts.push(blockStart);
    return entries.map(([, localeValues]) => encodeUtf16LeNullTerminated(localeValues[localeIndex] ?? ''));
  });

  for (let localeIndex = 1; localeIndex < localeCount; localeIndex += 1) {
    const previousBlock = valueBlocks[localeIndex - 1];
    const previousStart = blockStarts[localeIndex - 1];
    const previousLength = previousBlock.reduce((sum, value) => sum + value.byteLength, 0);
    blockStarts[localeIndex] = previousStart + previousLength;
  }

  const totalLength = blockStarts[localeCount - 1]
    + valueBlocks[localeCount - 1].reduce((sum, value) => sum + value.byteLength, 0);
  const bytes = new Uint8Array(totalLength);
  const view = new DataView(bytes.buffer);

  bytes[0] = 'X'.charCodeAt(0);
  bytes[1] = 'G'.charCodeAt(0);
  bytes[2] = 'S'.charCodeAt(0);
  bytes[3] = 'L'.charCodeAt(0);
  view.setUint32(0x0c, localeCount, true);

  blockStarts.forEach((blockStart, localeIndex) => {
    const pairOffset = 0x20 + localeIndex * 8;
    view.setUint32(pairOffset, blockStart, true);
    view.setUint32(pairOffset + 4, localeIndex, true);
  });

  let cursor = keyTableStart;
  keyBytes.forEach((key) => {
    bytes.set(key, cursor);
    cursor += key.byteLength;
  });

  blockStarts.forEach((blockStart, localeIndex) => {
    let blockCursor = blockStart;
    valueBlocks[localeIndex].forEach((value) => {
      bytes.set(value, blockCursor);
      blockCursor += value.byteLength;
    });
  });

  return bytes;
}

function buildLegacyRepeatedBlockXlc(entries: Array<[string, string]>, repeatCount: number): Uint8Array {
  const keyBytes = entries.map(([key]) => encodeUtf16LeNullTerminated(key));
  const blockBytes = Array.from({ length: repeatCount }, () => entries.map(([, value]) => encodeUtf16LeNullTerminated(value)));
  const valuesStartOffset = 0x28 + keyBytes.reduce((sum, value) => sum + value.byteLength, 0);
  const totalValueLength = blockBytes.reduce(
    (sum, block) => sum + block.reduce((blockSum, value) => blockSum + value.byteLength, 0),
    0
  );
  const bytes = new Uint8Array(valuesStartOffset + totalValueLength);
  const view = new DataView(bytes.buffer);

  bytes[0] = 'X'.charCodeAt(0);
  bytes[1] = 'G'.charCodeAt(0);
  bytes[2] = 'S'.charCodeAt(0);
  bytes[3] = 'L'.charCodeAt(0);
  view.setUint32(0x0c, 1, true);
  view.setUint32(0x20, valuesStartOffset, true);
  view.setUint32(0x24, 0, true);

  let cursor = 0x28;
  keyBytes.forEach((key) => {
    bytes.set(key, cursor);
    cursor += key.byteLength;
  });

  blockBytes.forEach((block) => {
    block.forEach((value) => {
      bytes.set(value, cursor);
      cursor += value.byteLength;
    });
  });

  return bytes;
}

function createFileHandle(bytes: Uint8Array, name: string): any {
  return {
    getFile: async () => ({
      name,
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    })
  };
}

function createStorageStub(): { saveFileHandle: jasmine.Spy } {
  return {
    saveFileHandle: jasmine.createSpy('saveFileHandle').and.resolveTo()
  };
}

function encodeUtf16LeNullTerminated(value: string): Uint8Array {
  const output = new Uint8Array((value.length + 1) * 2);

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    output[index * 2] = codeUnit & 0xff;
    output[index * 2 + 1] = codeUnit >> 8;
  }

  return output;
}

function readUtf16Value(bytes: Uint8Array, offset: number): { rawValue: string; nextOffset: number } {
  for (let cursor = offset; cursor + 1 < bytes.byteLength; cursor += 2) {
    if (bytes[cursor] === 0 && bytes[cursor + 1] === 0) {
      return {
        rawValue: new TextDecoder('utf-16le').decode(bytes.slice(offset, cursor)),
        nextOffset: cursor + 2
      };
    }
  }

  throw new Error(`Missing UTF-16 terminator at ${offset}.`);
}