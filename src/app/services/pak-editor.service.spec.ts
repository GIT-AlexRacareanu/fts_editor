import { PakEditorService } from './pak-editor.service';

const MAGIC = [0x00, 0x4b, 0x50, 0x58];

function buildSyntheticPak(
  files: Array<{ name: string; data: Uint8Array; directory?: string }>,
  folderNames: string[] = ['']
): Uint8Array {
  // Single-root layout: all files belong to folder 0 unless directory provided.
  // For simplicity, this helper supports a single root folder containing all files.
  const HEADER = 16;
  const FOLDER_REC = 20;
  const FILE_REC = 24;

  const folderCount = folderNames.length;
  const fileCount = files.length;

  // Build name table: folder names first, then file names.
  const encoder = new TextEncoder();
  const nameChunks: Array<{ key: string; offset: number; bytes: Uint8Array }> = [];
  let nameCursor = 0;
  const nameOffsetByKey = new Map<string, number>();

  const addName = (key: string, value: string) => {
    if (nameOffsetByKey.has(key)) {
      return nameOffsetByKey.get(key)!;
    }
    const bytes = encoder.encode(value);
    const offset = nameCursor;
    nameChunks.push({ key, offset, bytes });
    nameOffsetByKey.set(key, offset);
    nameCursor += bytes.byteLength + 1; // + null terminator
    return offset;
  };

  const folderNameOffsets = folderNames.map((fn, idx) => addName(`folder:${idx}`, fn));
  const fileNameOffsets = files.map((f, idx) => addName(`file:${idx}`, f.name));

  const nameTableLength = nameCursor;
  const nameTable = new Uint8Array(nameTableLength);
  for (const chunk of nameChunks) {
    nameTable.set(chunk.bytes, chunk.offset);
    nameTable[chunk.offset + chunk.bytes.byteLength] = 0;
  }

  const metadataLength = HEADER + folderCount * FOLDER_REC + fileCount * FILE_REC + nameTableLength;

  // Compute data offsets.
  let dataCursor = metadataLength;
  const fileOffsets = files.map((f) => {
    const offset = dataCursor;
    dataCursor += f.data.byteLength;
    return offset;
  });

  const total = dataCursor;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  for (let i = 0; i < MAGIC.length; i += 1) {
    out[i] = MAGIC[i];
  }
  view.setUint32(4, folderCount, true);
  view.setUint32(8, fileCount, true);
  view.setUint32(12, 0, true);

  let cursor = HEADER;
  // Single root folder owns all files.
  view.setUint32(cursor, folderNameOffsets[0], true); // nameOffset
  view.setUint32(cursor + 4, fileCount, true); // fileCount
  view.setUint32(cursor + 8, 0, true); // folderCount
  view.setUint32(cursor + 12, 0, true); // firstFileIndex
  view.setUint32(cursor + 16, 0, true); // firstFolderIndex
  cursor += FOLDER_REC;

  for (let i = 0; i < fileCount; i += 1) {
    view.setUint32(cursor, fileNameOffsets[i], true); // nameOffset
    view.setUint32(cursor + 4, files[i].data.byteLength, true); // size
    view.setUint32(cursor + 8, fileOffsets[i], true); // offset
    view.setUint32(cursor + 12, 0, true); // compressionFlag
    view.setUint32(cursor + 16, 0, true); // crc
    view.setUint32(cursor + 20, files[i].data.byteLength, true); // compressedSize
    cursor += FILE_REC;
  }

  out.set(nameTable, cursor);
  cursor += nameTableLength;

  for (let i = 0; i < fileCount; i += 1) {
    out.set(files[i].data, fileOffsets[i]);
  }

  return out;
}

function makeService(): PakEditorService {
  const fileHandleStorage = {
    getFileHandle: async () => null,
    saveFileHandle: async () => undefined,
    deleteFileHandle: async () => undefined
  };
  return new PakEditorService(fileHandleStorage as any);
}

describe('PakEditorService addEntry header/index integrity', () => {
  it('round-trips a newly added logo entry through serialize + reparse', () => {
    const dataA = new Uint8Array([10, 11, 12, 13]);
    const dataB = new Uint8Array([20, 21]);
    const pak = buildSyntheticPak([
      { name: 't1.png', data: dataA },
      { name: 't1_thumb.png', data: dataB }
    ]);

    const service = makeService();
    service.loadFromBytes(pak, 'teams.pak');

    expect(service.entries.length).toBe(2);

    const newMain = new Uint8Array([30, 31, 32, 33, 34]);
    const newThumb = new Uint8Array([40, 41, 42]);
    service.addEntry('t2.png', newMain);
    service.addEntry('t2_thumb.png', newThumb);

    expect(service.entries.length).toBe(4);

    const serialized = service.exportCurrentFileBytes();

    // Re-parse the serialized bytes into a fresh service instance.
    const reloaded = makeService();
    reloaded.loadFromBytes(serialized, 'teams.pak');

    // Header file count must now be 4.
    const view = new DataView(serialized.buffer, serialized.byteOffset, serialized.byteLength);
    expect(view.getUint32(8, true)).toBe(4);

    expect(reloaded.entries.length).toBe(4);

    const reMain = reloaded.getTeamLogoEntry(2, 'main');
    const reThumb = reloaded.getTeamLogoEntry(2, 'thumb');
    expect(reMain).withContext('t2.png entry should exist after reparse').not.toBeNull();
    expect(reThumb).withContext('t2_thumb.png entry should exist after reparse').not.toBeNull();

    expect(Array.from(reloaded.extractEntry(reMain!))).toEqual(Array.from(newMain));
    expect(Array.from(reloaded.extractEntry(reThumb!))).toEqual(Array.from(newThumb));

    // Existing entries must remain intact.
    const reOld = reloaded.getTeamLogoEntry(1, 'main');
    expect(reOld).not.toBeNull();
    expect(Array.from(reloaded.extractEntry(reOld!))).toEqual(Array.from(dataA));
  });

  it('keeps every file name resolvable after adding an entry (name table integrity)', () => {
    const pak = buildSyntheticPak([
      { name: 't10.png', data: new Uint8Array([1, 2, 3]) },
      { name: 't10_thumb.png', data: new Uint8Array([4, 5]) },
      { name: 't11.png', data: new Uint8Array([6, 7, 8, 9]) }
    ]);

    const service = makeService();
    service.loadFromBytes(pak, 'teams.pak');
    service.addEntry('t99.png', new Uint8Array([50, 51, 52]));

    const serialized = service.exportCurrentFileBytes();
    const reloaded = makeService();
    reloaded.loadFromBytes(serialized, 'teams.pak');

    const names = reloaded.entries.map((e) => e.name).sort();
    expect(names).toEqual(['t10.png', 't10_thumb.png', 't11.png', 't99.png'].sort());

    // None of the names should be empty/garbled.
    for (const entry of reloaded.entries) {
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });
});

function buildNestedLogosPak(
  logoFiles: Array<{ name: string; data: Uint8Array }>
): Uint8Array {
  // Layout: root folder (no files, 1 subfolder) + "logos" subfolder holding all files.
  const HEADER = 16;
  const FOLDER_REC = 20;
  const FILE_REC = 24;
  const encoder = new TextEncoder();

  const folderCount = 2;
  const fileCount = logoFiles.length;

  // Name table: root name "", logos folder name "logos", then file names.
  const names: string[] = ['', 'logos', ...logoFiles.map((f) => f.name)];
  const nameOffsets: number[] = [];
  let nameCursor = 0;
  const nameBytes: Array<{ offset: number; bytes: Uint8Array }> = [];
  for (const n of names) {
    const bytes = encoder.encode(n);
    nameOffsets.push(nameCursor);
    nameBytes.push({ offset: nameCursor, bytes });
    nameCursor += bytes.byteLength + 1;
  }
  const nameTable = new Uint8Array(nameCursor);
  for (const nb of nameBytes) {
    nameTable.set(nb.bytes, nb.offset);
    nameTable[nb.offset + nb.bytes.byteLength] = 0;
  }

  const metadataLength = HEADER + folderCount * FOLDER_REC + fileCount * FILE_REC + nameCursor;
  let dataCursor = metadataLength;
  const fileOffsets = logoFiles.map((f) => {
    const o = dataCursor;
    dataCursor += f.data.byteLength;
    return o;
  });

  const out = new Uint8Array(dataCursor);
  const view = new DataView(out.buffer);
  for (let i = 0; i < MAGIC.length; i += 1) {
    out[i] = MAGIC[i];
  }
  view.setUint32(4, folderCount, true);
  view.setUint32(8, fileCount, true);
  view.setUint32(12, 0, true);

  let cursor = HEADER;
  // Folder 0: root, no files, 1 subfolder pointing at folder index 1.
  view.setUint32(cursor, nameOffsets[0], true);
  view.setUint32(cursor + 4, 0, true); // fileCount
  view.setUint32(cursor + 8, 1, true); // folderCount
  view.setUint32(cursor + 12, 0, true); // firstFileIndex
  view.setUint32(cursor + 16, 1, true); // firstFolderIndex
  cursor += FOLDER_REC;
  // Folder 1: logos, owns all files.
  view.setUint32(cursor, nameOffsets[1], true);
  view.setUint32(cursor + 4, fileCount, true); // fileCount
  view.setUint32(cursor + 8, 0, true); // folderCount
  view.setUint32(cursor + 12, 0, true); // firstFileIndex
  view.setUint32(cursor + 16, 0, true); // firstFolderIndex
  cursor += FOLDER_REC;

  for (let i = 0; i < fileCount; i += 1) {
    view.setUint32(cursor, nameOffsets[2 + i], true);
    view.setUint32(cursor + 4, logoFiles[i].data.byteLength, true);
    view.setUint32(cursor + 8, fileOffsets[i], true);
    view.setUint32(cursor + 12, 0, true);
    view.setUint32(cursor + 16, 0, true);
    view.setUint32(cursor + 20, logoFiles[i].data.byteLength, true);
    cursor += FILE_REC;
  }

  out.set(nameTable, cursor);
  cursor += nameCursor;
  for (let i = 0; i < fileCount; i += 1) {
    out.set(logoFiles[i].data, fileOffsets[i]);
  }
  return out;
}

describe('PakEditorService addEntry with nested logo folder', () => {
  it('adds a new logo into the correct subfolder and round-trips', () => {
    const pak = buildNestedLogosPak([
      { name: 't1.png', data: new Uint8Array([1, 1, 1]) },
      { name: 't1_thumb.png', data: new Uint8Array([2, 2]) }
    ]);

    const service = makeService();
    service.loadFromBytes(pak, 'teams.pak');

    const existing = service.entries.find((e) => e.name === 't1.png');
    expect(existing!.directory).toBe('logos');

    const newMain = new Uint8Array([9, 9, 9, 9]);
    service.addEntry('t2.png', newMain);

    const serialized = service.exportCurrentFileBytes();
    const reloaded = makeService();
    reloaded.loadFromBytes(serialized, 'teams.pak');

    const reMain = reloaded.entries.find((e) => e.name === 't2.png');
    expect(reMain).withContext('new logo should exist after reparse').toBeDefined();
    expect(reMain!.directory).withContext('new logo must land in logos subfolder').toBe('logos');
    expect(Array.from(reloaded.extractEntry(reMain!))).toEqual(Array.from(newMain));

    // All original names must still resolve and not be garbled.
    const names = reloaded.entries.map((e) => e.name).sort();
    expect(names).toEqual(['t1.png', 't1_thumb.png', 't2.png'].sort());
  });
});

