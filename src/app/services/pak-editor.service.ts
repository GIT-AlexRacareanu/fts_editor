import { Injectable } from '@angular/core';

import { FileHandleStorageService } from './file-handle-storage.service';

declare const pako: any;

const HEADER_SIZE = 16;
const FOLDER_RECORD_SIZE = 20;
const FILE_RECORD_SIZE = 24;
const MAGIC_BYTES = [0x00, 0x4b, 0x50, 0x58] as const;

interface PakFolderRecord {
  nameOffset: number;
  fileCount: number;
  folderCount: number;
  firstFileIndex: number;
  firstFolderIndex: number;
}

interface PakFileRecord {
  nameOffset: number;
  size: number;
  offset: number;
  compressionFlag: number;
  crc: number;
  compressedSize: number;
}

export interface PakEntry {
  index: number;
  path: string;
  name: string;
  directory: string;
  size: number;
  offset: number;
  compressed: boolean;
  compressedSize: number;
  compressionFlag: number;
  crc: number;
}

interface ParsedPakFile {
  entries: PakEntry[];
  folderRecords: PakFolderRecord[];
  fileRecords: PakFileRecord[];
  metadataTailBytes: Uint8Array;
  headerDummy: number;
}

@Injectable({ providedIn: 'root' })
export class PakEditorService {
  private readonly storageKey = 'fts15-pak';
  private readonly textDecoder = new TextDecoder();

  fileHandle: any = null;
  binaryData: Uint8Array | null = null;
  entries: PakEntry[] = [];
  hasPendingChanges = false;

  private folderRecords: PakFolderRecord[] = [];
  private fileRecords: PakFileRecord[] = [];
  private metadataTailBytes = new Uint8Array(0);
  private headerDummy = 0;
  private readonly modifiedEntryBytes = new Map<number, Uint8Array>();

  constructor(private readonly fileHandleStorage: FileHandleStorageService) {}

  get hasData(): boolean {
    return this.binaryData !== null && this.entries.length > 0;
  }

  async loadFile(fileHandle?: any): Promise<string> {
    if (!(window as any).showOpenFilePicker) {
      throw new Error('Your browser does not support File System Access API. Use Chrome.');
    }

    let nextHandle = fileHandle;

    if (!nextHandle) {
      const handles = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [{ description: 'FTS PAK Files', accept: { 'application/octet-stream': ['.pak', '.xpk', '.kpx'] } }]
      });

      nextHandle = handles[0];
    }

    this.fileHandle = nextHandle;
    const file = await nextHandle.getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    console.log('[Pak] file picked:', file.name, 'size:', bytes.byteLength, 'bytes');
    const parsed = this.parseFile(bytes);
    console.log('[Pak] parse complete. entries:', parsed.entries.length);
    this.applyParsedState(bytes, parsed);
    this.hasPendingChanges = false;

    await this.fileHandleStorage.saveFileHandle(this.storageKey, nextHandle);

    return file.name;
  }

  loadFromBytes(bytes: Uint8Array, fileName = 'teams.pak'): string {
    console.log('[Pak] file picked:', fileName, 'size:', bytes.byteLength, 'bytes');
    const parsed = this.parseFile(bytes);
    console.log('[Pak] parse complete. entries:', parsed.entries.length);

    this.fileHandle = null;
    this.applyParsedState(bytes, parsed);
    this.hasPendingChanges = false;
    return fileName;
  }

  async tryRestoreLastFile(): Promise<string | null> {
    const storedHandle = await this.fileHandleStorage.getFileHandle<any>(this.storageKey);

    if (!storedHandle) {
      console.log('[Pak] no remembered PAK handle found.');
      return null;
    }

    console.log('[Pak] remembered PAK handle found. Checking permissions...');

    const hasPermission = await this.hasReadPermission(storedHandle);

    if (!hasPermission) {
      console.warn('[Pak] remembered PAK handle exists but read permission was not granted.');
      return null;
    }

    try {
      console.log('[Pak] restoring remembered PAK handle.');
      return await this.loadFile(storedHandle);
    } catch (error) {
      console.error('[Pak] failed to restore remembered PAK handle. Clearing stored handle.', error);
      this.clearLoadedFile();
      await this.fileHandleStorage.deleteFileHandle(this.storageKey);
      return null;
    }
  }

  clearLoadedFile(): void {
    this.fileHandle = null;
    this.binaryData = null;
    this.entries = [];
    this.folderRecords = [];
    this.fileRecords = [];
    this.metadataTailBytes = new Uint8Array(0);
    this.headerDummy = 0;
    this.modifiedEntryBytes.clear();
    this.hasPendingChanges = false;
  }

  getTeamLogoEntry(teamId: number, variant: 'main' | 'thumb' = 'main'): PakEntry | null {
    const expectedName = (variant === 'thumb' ? `t${teamId}_thumb.png` : `t${teamId}.png`).toLowerCase();
    return this.entries.find((entry) => entry.name.toLowerCase() === expectedName) ?? null;
  }

  replaceEntry(entry: PakEntry, bytes: Uint8Array): void {
    const normalizedBytes = new Uint8Array(bytes);
    const nextSize = normalizedBytes.byteLength;
    const targetEntry = this.entries.find((candidate) => candidate.index === entry.index);

    if (!targetEntry) {
      throw new Error(`PAK entry not found: ${entry.path}`);
    }

    this.modifiedEntryBytes.set(entry.index, normalizedBytes);
    targetEntry.size = nextSize;
    targetEntry.compressed = false;
    targetEntry.compressedSize = nextSize;
    targetEntry.compressionFlag = 0;
    targetEntry.crc = this.computeCrc32(normalizedBytes);
    this.hasPendingChanges = true;
  }

  addEntry(name: string, data: Uint8Array): void {
    if (!this.hasData) {
      throw new Error('No PAK file loaded.');
    }

    if (data.byteLength === 0) {
      throw new Error('Cannot add empty entry.');
    }

    // Find the folder that contains logo entries (typically t0.png, t1.png, etc.)
    let targetFolder = this.folderRecords[0];
    const existingLogoEntry = this.entries.find((e) => /^t\d+\.png$/i.test(e.name));
    if (existingLogoEntry && existingLogoEntry.directory) {
      const folderRecord = this.folderRecords.find((f) => {
        const folderName = this.readNullTerminatedString(this.metadataTailBytes, f.nameOffset);
        return folderName === existingLogoEntry.directory;
      });
      if (folderRecord) {
        targetFolder = folderRecord;
      }
    }

    const insertionIndex = targetFolder.firstFileIndex + targetFolder.fileCount;

    // Append name to metadataTailBytes
    const nameBytes = new TextEncoder().encode(name);
    const newMetadata = new Uint8Array(this.metadataTailBytes.byteLength + nameBytes.byteLength + 1);
    newMetadata.set(this.metadataTailBytes);
    newMetadata.set(nameBytes, this.metadataTailBytes.byteLength);
    newMetadata[this.metadataTailBytes.byteLength + nameBytes.byteLength] = 0;
    const nameOffset = this.metadataTailBytes.byteLength;
    this.metadataTailBytes = newMetadata;

    // Renumber existing entries with index >= insertionIndex
    this.entries.forEach((entry) => {
      if (entry.index >= insertionIndex) {
        entry.index += 1;
      }
    });

    // Renumber modifiedEntryBytes map
    const newModifiedMap = new Map<number, Uint8Array>();
    this.modifiedEntryBytes.forEach((value, key) => {
      const newKey = key >= insertionIndex ? key + 1 : key;
      newModifiedMap.set(newKey, value);
    });
    this.modifiedEntryBytes.clear();
    newModifiedMap.forEach((value, key) => this.modifiedEntryBytes.set(key, value));

    // Insert new file record
    const newFileRecord: PakFileRecord = {
      nameOffset,
      size: data.byteLength,
      offset: 0,
      compressionFlag: 0,
      crc: this.computeCrc32(data),
      compressedSize: data.byteLength
    };
    this.fileRecords.splice(insertionIndex, 0, newFileRecord);

    // Update folder records
    targetFolder.fileCount += 1;
    this.folderRecords.forEach((folder) => {
      if (folder !== targetFolder && folder.firstFileIndex >= insertionIndex) {
        folder.firstFileIndex += 1;
      }
    });

    // Add new entry
    const entryPath = targetFolder === this.folderRecords[0]
      ? name
      : this.readNullTerminatedString(this.metadataTailBytes, targetFolder.nameOffset) + '/' + name;
    const normalizedPath = entryPath.replace(/^\/*/, '');
    const lastSlash = normalizedPath.lastIndexOf('/');
    const newEntry: PakEntry = {
      index: insertionIndex,
      path: normalizedPath,
      name,
      directory: lastSlash >= 0 ? normalizedPath.slice(0, lastSlash) : '',
      size: data.byteLength,
      offset: 0,
      compressed: false,
      compressedSize: data.byteLength,
      compressionFlag: 0,
      crc: this.computeCrc32(data)
    };
    this.entries.push(newEntry);

    this.modifiedEntryBytes.set(insertionIndex, new Uint8Array(data));
    this.hasPendingChanges = true;
  }

  removeEntry(name: string): void {
    if (!this.hasData) {
      throw new Error('No PAK file loaded.');
    }

    const entryIndex = this.entries.findIndex((e) => e.name === name);
    if (entryIndex < 0) {
      throw new Error(`Entry '${name}' not found in PAK file.`);
    }

    const entry = this.entries[entryIndex];
    const fileIndex = this.fileRecords.findIndex(
      (record) => this.readNullTerminatedString(this.metadataTailBytes, record.nameOffset) === name
    );

    if (fileIndex >= 0) {
      // Remove from fileRecords
      this.fileRecords.splice(fileIndex, 1);

      // Renumber entries and file records with index > fileIndex
      this.entries.forEach((e) => {
        if (e.index > fileIndex) {
          e.index -= 1;
        }
      });

      const newModifiedMap = new Map<number, Uint8Array>();
      this.modifiedEntryBytes.forEach((value, key) => {
        if (key > fileIndex) {
          newModifiedMap.set(key - 1, value);
        } else if (key !== fileIndex) {
          newModifiedMap.set(key, value);
        }
      });
      this.modifiedEntryBytes.clear();
      newModifiedMap.forEach((value, key) => this.modifiedEntryBytes.set(key, value));

      // Update folder records
      this.folderRecords.forEach((folder) => {
        if (folder.firstFileIndex > fileIndex) {
          folder.firstFileIndex -= 1;
        } else if (folder.firstFileIndex <= fileIndex && fileIndex < folder.firstFileIndex + folder.fileCount) {
          folder.fileCount -= 1;
        }
      });

      // Remove from entries array
      this.entries.splice(entryIndex, 1);
      this.hasPendingChanges = true;
    }
  }

  async saveToSameFile(): Promise<void> {
    if (!this.fileHandle || !this.binaryData) {
      throw new Error('No PAK file loaded');
    }

    const serialized = this.getSerializedData();
    const writable = await this.fileHandle.createWritable();
    await writable.write(serialized);
    await writable.close();

    const reparsed = this.parseFile(serialized);
    this.applyParsedState(serialized, reparsed);
    this.hasPendingChanges = false;
  }

  exportCurrentFileBytes(): Uint8Array {
    return this.getSerializedData();
  }

  extractEntry(entry: PakEntry): Uint8Array {
    if (!this.binaryData) {
      throw new Error('No PAK file loaded.');
    }

    const modifiedEntryBytes = this.modifiedEntryBytes.get(entry.index);

    if (modifiedEntryBytes) {
      return new Uint8Array(modifiedEntryBytes);
    }

    const safeCompressedSize = entry.compressed ? entry.compressedSize : entry.size;
    const endOffset = entry.offset + safeCompressedSize;

    if (entry.offset < 0 || safeCompressedSize < 0 || endOffset > this.binaryData.byteLength) {
      throw new Error(`PAK entry is out of bounds: ${entry.path}`);
    }

    const payload = this.binaryData.subarray(entry.offset, endOffset);

    if (!entry.compressed) {
      return new Uint8Array(payload);
    }

    if (this.matchesKnownFileSignature(entry.name, payload)) {
      console.log('[Pak] using raw payload despite compression flag for entry:', entry.path);
      return new Uint8Array(payload);
    }

    try {
      const inflated = new Uint8Array(pako.inflate(payload));

      if (this.isCredibleExtractedPayload(entry, inflated)) {
        return inflated;
      }

      console.warn('[Pak] zlib inflate produced an unexpected payload for entry:', entry.path, 'size:', inflated.byteLength);
    } catch (error) {
      console.warn('[Pak] zlib inflate failed for entry:', entry.path, error);
    }

    try {
      const inflatedRaw = new Uint8Array(pako.inflateRaw(payload));

      if (this.isCredibleExtractedPayload(entry, inflatedRaw)) {
        return inflatedRaw;
      }

      console.warn('[Pak] raw inflate produced an unexpected payload for entry:', entry.path, 'size:', inflatedRaw.byteLength);
    } catch (error) {
      console.warn('[Pak] raw inflate failed for entry:', entry.path, error);
    }

    console.warn('[Pak] falling back to raw payload after failed/invalid inflate for entry:', entry.path);
    return new Uint8Array(payload);
  }

  private isCredibleExtractedPayload(entry: PakEntry, bytes: Uint8Array): boolean {
    if (this.matchesKnownFileSignature(entry.name, bytes)) {
      return true;
    }

    return bytes.byteLength === entry.size;
  }

  private matchesKnownFileSignature(fileName: string, bytes: Uint8Array): boolean {
    if (/\.png$/i.test(fileName)) {
      return bytes.byteLength >= 8
        && bytes[0] === 0x89
        && bytes[1] === 0x50
        && bytes[2] === 0x4e
        && bytes[3] === 0x47
        && bytes[4] === 0x0d
        && bytes[5] === 0x0a
        && bytes[6] === 0x1a
        && bytes[7] === 0x0a;
    }

    if (/\.jpe?g$/i.test(fileName)) {
      return bytes.byteLength >= 3
        && bytes[0] === 0xff
        && bytes[1] === 0xd8
        && bytes[2] === 0xff;
    }

    if (/\.gif$/i.test(fileName)) {
      return bytes.byteLength >= 6
        && bytes[0] === 0x47
        && bytes[1] === 0x49
        && bytes[2] === 0x46
        && bytes[3] === 0x38
        && (bytes[4] === 0x37 || bytes[4] === 0x39)
        && bytes[5] === 0x61;
    }

    if (/\.webp$/i.test(fileName)) {
      return bytes.byteLength >= 12
        && bytes[0] === 0x52
        && bytes[1] === 0x49
        && bytes[2] === 0x46
        && bytes[3] === 0x46
        && bytes[8] === 0x57
        && bytes[9] === 0x45
        && bytes[10] === 0x42
        && bytes[11] === 0x50;
    }

    return false;
  }

  exportEntry(entry: PakEntry): void {
    const blob = new Blob([this.extractEntry(entry)], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = entry.name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async exportAllEntriesToDirectory(directoryHandle?: any): Promise<number> {
    if (!this.hasData) {
      throw new Error('No PAK file loaded.');
    }

    let targetDirectoryHandle = directoryHandle;

    if (!targetDirectoryHandle) {
      if (!(window as any).showDirectoryPicker) {
        throw new Error('Your browser does not support the Directory Picker API. Use Chrome.');
      }

      targetDirectoryHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    }

    for (const entry of this.entries) {
      await this.writeEntryToDirectory(targetDirectoryHandle, entry);
    }

    return this.entries.length;
  }

  private parseFile(bytes: Uint8Array): ParsedPakFile {
    this.validateHeader(bytes);

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const folderCount = view.getUint32(4, true);
    const fileCount = view.getUint32(8, true);
    const headerDummy = view.getUint32(12, true);
    console.log('[Pak] header parsed. folders:', folderCount, 'files:', fileCount);

    const folderBase = HEADER_SIZE;
    const fileBase = folderBase + folderCount * FOLDER_RECORD_SIZE;
    const nameBase = fileBase + fileCount * FILE_RECORD_SIZE;

    if (folderCount <= 0 || fileCount < 0) {
      throw new Error('Invalid PAK directory counts.');
    }

    if (nameBase > bytes.byteLength) {
      throw new Error('Invalid PAK: directory tables exceed file length.');
    }

    const fileRecords = this.readFileRecords(view, fileCount);
    const folderRecords = this.readFolderRecords(view, folderCount);
    const firstDataOffset = fileRecords.reduce((lowestOffset, record) => Math.min(lowestOffset, record.offset), bytes.byteLength);
    const metadataTailStart = fileBase + fileCount * FILE_RECORD_SIZE;
    const metadataTailBytes = bytes.slice(metadataTailStart, firstDataOffset);

    const entries: PakEntry[] = [];
    this.collectFolderEntries(0, '', folderRecords, fileRecords, nameBase, bytes, entries);

    return {
      entries: entries.sort((left, right) => left.path.localeCompare(right.path)),
      folderRecords,
      fileRecords,
      metadataTailBytes,
      headerDummy
    };
  }

  private applyParsedState(bytes: Uint8Array, parsed: ParsedPakFile): void {
    this.binaryData = bytes;
    this.entries = parsed.entries;
    this.folderRecords = parsed.folderRecords;
    this.fileRecords = parsed.fileRecords;
    this.metadataTailBytes = parsed.metadataTailBytes;
    this.headerDummy = parsed.headerDummy;
    this.modifiedEntryBytes.clear();
  }

  private getSerializedData(): Uint8Array {
    if (!this.binaryData) {
      throw new Error('No PAK file loaded.');
    }

    const metadataLength = HEADER_SIZE
      + this.folderRecords.length * FOLDER_RECORD_SIZE
      + this.fileRecords.length * FILE_RECORD_SIZE
      + this.metadataTailBytes.byteLength;

    const payloads: Uint8Array[] = [];
    const nextFileRecords: PakFileRecord[] = [];
    let nextOffset = metadataLength;

    for (let index = 0; index < this.fileRecords.length; index += 1) {
      const originalRecord = this.fileRecords[index];
      const entry = this.entries.find((candidate) => candidate.index === index);

      if (!originalRecord || !entry) {
        throw new Error(`PAK file record is missing for index ${index}.`);
      }

      const payload = this.modifiedEntryBytes.get(index)
        ?? this.binaryData.subarray(originalRecord.offset, originalRecord.offset + (originalRecord.compressionFlag !== 0 ? originalRecord.compressedSize : originalRecord.size));

      const storedPayload = new Uint8Array(payload);
      payloads.push(storedPayload);

      nextFileRecords.push({
        nameOffset: originalRecord.nameOffset,
        size: entry.size,
        offset: nextOffset,
        compressionFlag: entry.compressionFlag,
        crc: entry.crc,
        compressedSize: entry.compressed ? entry.compressedSize : storedPayload.byteLength
      });

      nextOffset += storedPayload.byteLength;
    }

    const serialized = new Uint8Array(nextOffset);
    const view = new DataView(serialized.buffer);

    for (let index = 0; index < MAGIC_BYTES.length; index += 1) {
      serialized[index] = MAGIC_BYTES[index];
    }

    view.setUint32(4, this.folderRecords.length, true);
    view.setUint32(8, this.fileRecords.length, true);
    // header[12] is the size (in bytes) of the name/string table, NOT a dummy.
    // The game (CXGSFileSystem_PAK::Initialise) reads exactly this many bytes after
    // the file records into the name buffer; every nameOffset is relative to it.
    // When entries are added, metadataTailBytes (the name table) grows, so this MUST
    // track its length, otherwise new entries' names fall outside the buffer and the
    // game can't find them (e.g. new-team logos never load).
    view.setUint32(12, this.metadataTailBytes.byteLength, true);

    let cursor = HEADER_SIZE;

    for (const folderRecord of this.folderRecords) {
      view.setUint32(cursor, folderRecord.nameOffset, true);
      view.setUint32(cursor + 4, folderRecord.fileCount, true);
      view.setUint32(cursor + 8, folderRecord.folderCount, true);
      view.setUint32(cursor + 12, folderRecord.firstFileIndex, true);
      view.setUint32(cursor + 16, folderRecord.firstFolderIndex, true);
      cursor += FOLDER_RECORD_SIZE;
    }

    for (const fileRecord of nextFileRecords) {
      view.setUint32(cursor, fileRecord.nameOffset, true);
      view.setUint32(cursor + 4, fileRecord.size, true);
      view.setUint32(cursor + 8, fileRecord.offset, true);
      view.setUint32(cursor + 12, fileRecord.compressionFlag, true);
      view.setUint32(cursor + 16, fileRecord.crc, true);
      view.setUint32(cursor + 20, fileRecord.compressedSize, true);
      cursor += FILE_RECORD_SIZE;
    }

    serialized.set(this.metadataTailBytes, cursor);
    cursor += this.metadataTailBytes.byteLength;

    for (const payload of payloads) {
      serialized.set(payload, cursor);
      cursor += payload.byteLength;
    }

    return serialized;
  }

  private computeCrc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;

    for (const byte of bytes) {
      crc ^= byte;

      for (let bit = 0; bit < 8; bit += 1) {
        const lsb = crc & 1;
        crc >>>= 1;

        if (lsb !== 0) {
          crc ^= 0xedb88320;
        }
      }
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  private validateHeader(bytes: Uint8Array): void {
    if (bytes.byteLength < HEADER_SIZE) {
      throw new Error('Invalid PAK: file is too small.');
    }

    for (let index = 0; index < MAGIC_BYTES.length; index += 1) {
      if (bytes[index] !== MAGIC_BYTES[index]) {
        throw new Error('Unsupported PAK header. Expected KPX/XPK format.');
      }
    }
  }

  private readFolderRecords(view: DataView, folderCount: number): PakFolderRecord[] {
    const records: PakFolderRecord[] = [];
    let cursor = HEADER_SIZE;

    for (let index = 0; index < folderCount; index += 1) {
      records.push({
        nameOffset: view.getUint32(cursor, true),
        fileCount: view.getUint32(cursor + 4, true),
        folderCount: view.getUint32(cursor + 8, true),
        firstFileIndex: view.getUint32(cursor + 12, true),
        firstFolderIndex: view.getUint32(cursor + 16, true)
      });
      cursor += FOLDER_RECORD_SIZE;
    }

    return records;
  }

  private readFileRecords(view: DataView, fileCount: number): PakFileRecord[] {
    const records: PakFileRecord[] = [];
    let cursor = HEADER_SIZE;
    cursor += view.getUint32(4, true) * FOLDER_RECORD_SIZE;

    for (let index = 0; index < fileCount; index += 1) {
      records.push({
        nameOffset: view.getUint32(cursor, true),
        size: view.getUint32(cursor + 4, true),
        offset: view.getUint32(cursor + 8, true),
        compressionFlag: view.getUint32(cursor + 12, true),
        crc: view.getUint32(cursor + 16, true),
        compressedSize: view.getUint32(cursor + 20, true)
      });
      cursor += FILE_RECORD_SIZE;
    }

    return records;
  }

  private collectFolderEntries(
    folderIndex: number,
    parentPath: string,
    folderRecords: PakFolderRecord[],
    fileRecords: PakFileRecord[],
    nameBase: number,
    bytes: Uint8Array,
    entries: PakEntry[]
  ): void {
    const folder = folderRecords[folderIndex];

    if (!folder) {
      throw new Error(`Invalid PAK folder reference: ${folderIndex}`);
    }

    const folderName = this.readNullTerminatedString(bytes, nameBase + folder.nameOffset);
    const currentPath = this.combinePath(parentPath, folderName);

    for (let index = 0; index < folder.fileCount; index += 1) {
      const fileIndex = folder.firstFileIndex + index;
      const fileRecord = fileRecords[fileIndex];

      if (!fileRecord) {
        throw new Error(`Invalid PAK file reference: ${fileIndex}`);
      }

      const name = this.readNullTerminatedString(bytes, nameBase + fileRecord.nameOffset);
      const path = this.combinePath(currentPath, name);
      const normalizedPath = path.replace(/^\/+/, '');
      const lastSlash = normalizedPath.lastIndexOf('/');

      entries.push({
        index: fileIndex,
        path: normalizedPath,
        name,
        directory: lastSlash >= 0 ? normalizedPath.slice(0, lastSlash) : '',
        size: fileRecord.size,
        offset: fileRecord.offset,
        compressed: fileRecord.compressionFlag !== 0,
        compressedSize: fileRecord.compressedSize,
        compressionFlag: fileRecord.compressionFlag,
        crc: fileRecord.crc
      });
    }

    for (let index = 0; index < folder.folderCount; index += 1) {
      this.collectFolderEntries(
        folder.firstFolderIndex + index,
        currentPath,
        folderRecords,
        fileRecords,
        nameBase,
        bytes,
        entries
      );
    }
  }

  private combinePath(left: string, right: string): string {
    if (!right) {
      return left;
    }

    if (!left) {
      return right;
    }

    return `${left}/${right}`;
  }

  private readNullTerminatedString(bytes: Uint8Array, offset: number): string {
    if (offset < 0 || offset >= bytes.byteLength) {
      return '';
    }

    let end = offset;

    while (end < bytes.byteLength && bytes[end] !== 0) {
      end += 1;
    }

    return this.textDecoder.decode(bytes.subarray(offset, end));
  }

  private async writeEntryToDirectory(rootDirectoryHandle: any, entry: PakEntry): Promise<void> {
    const segments = entry.path.split('/').filter((segment) => segment.length > 0);

    if (segments.length === 0) {
      return;
    }

    let currentDirectoryHandle = rootDirectoryHandle;

    for (const segment of segments.slice(0, -1)) {
      currentDirectoryHandle = await currentDirectoryHandle.getDirectoryHandle(segment, { create: true });
    }

    const fileHandle = await currentDirectoryHandle.getFileHandle(segments[segments.length - 1], { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(this.extractEntry(entry));
    await writable.close();
  }

  private async hasReadPermission(fileHandle: any): Promise<boolean> {
    if (typeof fileHandle?.queryPermission !== 'function') {
      return true;
    }

    const queriedPermission = await fileHandle.queryPermission({ mode: 'read' });

    if (queriedPermission === 'granted') {
      return true;
    }

    if (typeof fileHandle.requestPermission !== 'function') {
      return false;
    }

    const requestedPermission = await fileHandle.requestPermission({ mode: 'read' });
    return requestedPermission === 'granted';
  }
}