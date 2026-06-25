import { Injectable } from '@angular/core';

import { XlcEntry, XlcLocaleValue } from '../models/xlc-editor.model';
import { FileHandleStorageService } from './file-handle-storage.service';

const FILE_MAGIC = 'XGSL';
const HEADER_LOCALE_HINT_OFFSET = 0x0c;
const FIRST_ENTRY_OFFSET = 0x20;
const MAX_LOCALE_PAIR_COUNT = 32;
const MAX_REASONABLE_KEY_COUNT = 50000;
const MAX_KEY_BYTE_LENGTH = 4096;
const FIRST_KEY_SCAN_LIMIT = 0x400;
const DEFAULT_LOCALE_ID = 0;

interface LocaleDirectoryEntry {
  localeId: number;
  blockStart: number;
}

interface ParsedStringValue {
  value: string;
  originalByteLength: number;
  maxByteLength: number;
  sharedReferenceCount: number;
}

interface ParsedStringRecord {
  offset: number;
  value: string;
  originalByteLength: number;
  maxByteLength: number;
}

interface ParsedXlcFile {
  entries: XlcEntry[];
  stringValues: Map<number, ParsedStringValue>;
  valuesStartOffset: number;
}

@Injectable({ providedIn: 'root' })
export class XlcEditorService {
  private readonly storageKey = 'teamnames-xlc';
  private readonly decoder = new TextDecoder('utf-16le');

  fileHandle: any = null;
  binaryData: Uint8Array | null = null;
  entries: XlcEntry[] = [];
  hasPendingChanges = false;

  private stringValues = new Map<number, ParsedStringValue>();
  private localeByKey = new Map<string, XlcLocaleValue>();
  private valuesStartOffset = 0;

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
        types: [{ description: 'XLC String Files', accept: { 'application/octet-stream': ['.xlc', '.xl', '.bin'] } }]
      });

      nextHandle = handles[0];
    }

    this.fileHandle = nextHandle;
    const file = await nextHandle.getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = this.parseFile(bytes);
    this.applyParsedState(bytes, parsed);
    this.hasPendingChanges = false;

    await this.fileHandleStorage.saveFileHandle(this.storageKey, nextHandle);

    return file.name;
  }

  loadFromBytes(bytes: Uint8Array, fileName = 'ftsteamnames.xlc'): string {
    this.fileHandle = null;
    const parsed = this.parseFile(bytes);
    this.applyParsedState(bytes, parsed);
    this.hasPendingChanges = false;
    return fileName;
  }

  async tryRestoreLastFile(): Promise<string | null> {
    const storedHandle = await this.fileHandleStorage.getFileHandle<any>(this.storageKey);

    if (!storedHandle || !(await this.hasReadPermission(storedHandle))) {
      return null;
    }

    try {
      return await this.loadFile(storedHandle);
    } catch {
      this.resetState();
      await this.fileHandleStorage.deleteFileHandle(this.storageKey);
      return null;
    }
  }

  async saveToSameFile(): Promise<void> {
    if (!this.fileHandle || !this.binaryData) {
      throw new Error('No XLC file loaded');
    }

    const serialized = this.getSerializedData();
    const writable = await this.fileHandle.createWritable();
    await writable.write(serialized);
    await writable.close();
    this.applyParsedState(serialized, this.parseFile(serialized));
    this.hasPendingChanges = false;
  }

  exportCurrentFileBytes(): Uint8Array {
    return this.getSerializedData();
  }

  clearLoadedFile(): void {
    this.resetState();
  }

  exportFile(fileName = 'teamnames_export.xlc'): void {
    if (!this.binaryData) {
      return;
    }

    const blob = new Blob([this.getSerializedData()], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  updateValue(offset: number, nextValue: string): void {
    const stringValue = this.stringValues.get(offset);

    if (!stringValue) {
      throw new Error(`Unknown string offset 0x${offset.toString(16).toUpperCase()}.`);
    }

    const encodedLength = this.encodeUtf16LeValueRecord(nextValue).byteLength;

    if (encodedLength < 8) {
      throw new Error(`Invalid encoded length for offset 0x${offset.toString(16).toUpperCase()}.`);
    }

    stringValue.value = nextValue;
    this.entries.forEach((entry) => {
      entry.locales.forEach((locale) => {
        if (locale.offset === offset) {
          locale.value = nextValue;
          this.localeByKey.set(entry.key, locale);
        }
      });
    });
    this.hasPendingChanges = true;
  }

  getLocaleValueByKey(key: string): XlcLocaleValue | null {
    return this.localeByKey.get(key) ?? null;
  }

  getValueByKey(key: string): string | null {
    return this.getLocaleValueByKey(key)?.value ?? null;
  }

  updateValueByKey(key: string, nextValue: string): void {
    const entry = this.entries.find((candidate) => candidate.key === key);

    if (!entry || entry.locales.length === 0) {
      throw new Error(`XLC key not found: ${key}.`);
    }

    const uniqueOffsets = new Set(entry.locales.map((locale) => locale.offset));

    uniqueOffsets.forEach((offset) => {
      this.updateValue(offset, nextValue);
    });
  }

  addKey(key: string, value: string): void {
    if (!this.hasData) {
      throw new Error('No XLC file loaded');
    }

    if (this.entries.find((e) => e.key === key)) {
      return;
    }

    const encodedKey = this.encodeUtf16LeNullTerminated(key);
    const newBinary = new Uint8Array(this.binaryData!.byteLength + encodedKey.byteLength);
    newBinary.set(this.binaryData!.subarray(0, this.valuesStartOffset));
    newBinary.set(encodedKey, this.valuesStartOffset);
    newBinary.set(this.binaryData!.subarray(this.valuesStartOffset), this.valuesStartOffset + encodedKey.byteLength);
    this.binaryData = newBinary;
    this.valuesStartOffset += encodedKey.byteLength;

    const localeCount = this.entries[0]?.locales.length ?? 1;
    const newLocales: XlcLocaleValue[] = Array.from({ length: localeCount }, (_, localeIndex) => {
      const baseLocale = this.entries[0]?.locales[localeIndex];
      return {
        localeId: baseLocale?.localeId ?? localeIndex,
        localeLabel: baseLocale?.localeLabel ?? `Locale ${localeIndex}`,
        offset: -(this.entries.length + 1),
        maxByteLength: 0,
        originalByteLength: 0,
        sharedReferenceCount: 1,
        value
      };
    });

    const newEntry: XlcEntry = {
      index: this.entries.length,
      key,
      locales: newLocales
    };
    this.entries.push(newEntry);
    this.localeByKey.set(key, newLocales[0]);
    this.stringValues.set(newLocales[0].offset, {
      value,
      originalByteLength: 0,
      maxByteLength: 0,
      sharedReferenceCount: 1
    });
    this.hasPendingChanges = true;
  }

  removeKey(key: string): void {
    if (!this.hasData) {
      throw new Error('No XLC file loaded');
    }

    const entryIndex = this.entries.findIndex((e) => e.key === key);
    if (entryIndex < 0) {
      return;
    }

    const entry = this.entries[entryIndex];
    if (entry.locales.length > 0) {
      const firstLocale = entry.locales[0];
      this.stringValues.delete(firstLocale.offset);
      this.localeByKey.delete(key);
    }

    this.entries.splice(entryIndex, 1);
    this.hasPendingChanges = true;
  }

  private parseFile(bytes: Uint8Array): ParsedXlcFile {
    if (bytes.byteLength < FIRST_ENTRY_OFFSET + 2) {
      throw new Error('Invalid XLC: file is too small.');
    }

    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== FILE_MAGIC) {
      throw new Error(`Invalid XLC: expected ${FILE_MAGIC} header, got ${magic || 'unknown'}.`);
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const localeHint = view.getUint32(HEADER_LOCALE_HINT_OFFSET, true);

    try {
      return this.expandRepeatedSingleBlockParse(bytes, this.parseDirectoryBasedFile(bytes, localeHint));
    } catch {
      // Fall back to the legacy single-locale layout when the directory-based parse does not fit.
    }

    return this.expandRepeatedSingleBlockParse(bytes, this.parseLegacySingleLocaleFile(bytes, localeHint));
  }

  private expandRepeatedSingleBlockParse(bytes: Uint8Array, parsed: ParsedXlcFile): ParsedXlcFile {
    if (parsed.entries.length === 0 || parsed.entries.some((entry) => entry.locales.length !== 1)) {
      return parsed;
    }

    const repeatedBlocks = this.parseRepeatedLegacyBlocks(bytes, parsed.valuesStartOffset, parsed.entries.length);

    if (repeatedBlocks.length <= 1) {
      return parsed;
    }

    const keys = parsed.entries.map((entry) => entry.key);
    const locales = repeatedBlocks.map((block, index) => ({ localeId: index, blockStart: block.blockStart }));
    const blockRecords = new Map<number, ParsedStringRecord[]>(
      repeatedBlocks.map((block) => [block.blockStart, block.records])
    );
    const offsetUsage = this.buildOffsetUsage(locales, blockRecords, keys.length);
    const stringValues = this.buildStringValueMap(blockRecords, offsetUsage);
    const entries = this.buildEntries(keys, locales, blockRecords, stringValues);

    return {
      entries,
      stringValues,
      valuesStartOffset: parsed.valuesStartOffset
    };
  }

  private parseDirectoryBasedFile(bytes: Uint8Array, localeHint: number): ParsedXlcFile {
    const firstKeyOffset = this.findFirstKeyOffset(bytes, localeHint);
    const locales = this.parseLocaleDirectory(bytes, firstKeyOffset);
    const firstBlockStart = Math.min(...locales.map((locale) => locale.blockStart));

    if (!Number.isFinite(firstBlockStart) || firstBlockStart <= firstKeyOffset) {
      throw new Error('Unsupported XLC layout: locale block starts before the key table ends.');
    }

    const keys = this.parseKeys(bytes, firstKeyOffset, firstBlockStart);

    const blockRecords = this.parseLocaleBlocks(bytes, locales, keys.length);
    const offsetUsage = this.buildOffsetUsage(locales, blockRecords, keys.length);
    const stringValues = this.buildStringValueMap(blockRecords, offsetUsage);
    const entries = this.buildEntries(keys, locales, blockRecords, stringValues);

    return { entries, stringValues, valuesStartOffset: firstBlockStart };
  }

  private parseLegacySingleLocaleFile(bytes: Uint8Array, localeHint: number): ParsedXlcFile {
    const firstKeyOffset = this.findFirstKeyOffset(bytes, localeHint);
    const parsedKeys = this.parseKeyDirectoryUntilValues(bytes, firstKeyOffset);
    const repeatedBlocks = this.parseRepeatedLegacyBlocks(bytes, parsedKeys.valuesStartOffset, parsedKeys.keys.length);

    if (repeatedBlocks.length > 1) {
      const locales = repeatedBlocks.map((block, index) => ({ localeId: index, blockStart: block.blockStart }));
      const blockRecords = new Map<number, ParsedStringRecord[]>(
        repeatedBlocks.map((block) => [block.blockStart, block.records])
      );
      const offsetUsage = this.buildOffsetUsage(locales, blockRecords, parsedKeys.keys.length);
      const stringValues = this.buildStringValueMap(blockRecords, offsetUsage);
      const entries = this.buildEntries(parsedKeys.keys, locales, blockRecords, stringValues);

      return { entries, stringValues, valuesStartOffset: parsedKeys.valuesStartOffset };
    }

    const valueRecords = repeatedBlocks[0]?.records ?? this.parseValueRecords(bytes, parsedKeys.valuesStartOffset, parsedKeys.keys.length);
    const stringValues = this.buildStringValueMapFromRecords(valueRecords);
    const entries = this.buildSingleLocaleEntries(parsedKeys.keys, valueRecords, stringValues);

    return { entries, stringValues, valuesStartOffset: parsedKeys.valuesStartOffset };
  }
  private applyParsedState(bytes: Uint8Array, parsed: ParsedXlcFile): void {
    this.binaryData = bytes;
    this.entries = parsed.entries;
    this.stringValues = parsed.stringValues;
    this.localeByKey = this.buildLocaleByKeyMap(parsed.entries);
    this.valuesStartOffset = parsed.valuesStartOffset;
  }


  private findFirstKeyOffset(bytes: Uint8Array, localeHint: number): number {
    const candidateOffsets = new Set<number>();

    [localeHint - 1, localeHint, localeHint + 1].forEach((pairCount) => {
      if (pairCount >= 1 && pairCount <= MAX_LOCALE_PAIR_COUNT) {
        candidateOffsets.add(FIRST_ENTRY_OFFSET + pairCount * 8);
      }
    });

    for (let offset = FIRST_ENTRY_OFFSET + 8; offset <= Math.min(bytes.byteLength - 2, FIRST_KEY_SCAN_LIMIT); offset += 8) {
      candidateOffsets.add(offset);
    }

    for (const offset of candidateOffsets) {
      const keyRead = this.readUtf16LeNullTerminated(bytes, offset, MAX_KEY_BYTE_LENGTH);

      if (keyRead && this.isResourceKey(keyRead.value)) {
        return offset;
      }
    }

    throw new Error('Unsupported XLC layout: could not locate the first key string.');
  }

  private parseKeyDirectoryUntilValues(bytes: Uint8Array, startOffset: number): { keys: string[]; valuesStartOffset: number } {
    const keys: string[] = [];
    let cursor = startOffset;

    while (cursor < bytes.byteLength) {
      const keyRead = this.readUtf16LeNullTerminated(bytes, cursor, MAX_KEY_BYTE_LENGTH);

      if (!keyRead) {
        throw new Error(`Unsupported XLC layout: unterminated key at 0x${cursor.toString(16).toUpperCase()}.`);
      }

      if (!this.isResourceKey(keyRead.value)) {
        break;
      }

      keys.push(keyRead.value);
      cursor = keyRead.nextOffset;

      if (keys.length > MAX_REASONABLE_KEY_COUNT) {
        throw new Error(`Unsupported XLC layout: unreasonable key count ${keys.length}.`);
      }
    }

    if (keys.length === 0) {
      throw new Error('Unsupported XLC layout: no resource keys were found.');
    }

    return { keys, valuesStartOffset: cursor };
  }

  private parseValueRecords(bytes: Uint8Array, startOffset: number, expectedValueCount: number): ParsedStringRecord[] {
    const records: ParsedStringRecord[] = [];
    let cursor = startOffset;

    for (let index = 0; index < expectedValueCount; index += 1) {
      const stringRead = this.readUtf16LeNullTerminated(bytes, cursor, bytes.byteLength - cursor, true);

      if (!stringRead) {
        throw new Error(`Unsupported XLC layout: value table ended before ${expectedValueCount} strings were read.`);
      }

      records.push({
        offset: cursor,
        value: stringRead.value,
        originalByteLength: stringRead.originalByteLength,
        maxByteLength: 0
      });
      cursor = stringRead.nextOffset;
    }

    records.forEach((record, index) => {
      const nextOffset = records[index + 1]?.offset ?? bytes.byteLength;
      record.maxByteLength = nextOffset - record.offset;
    });

    return records;
  }

  private parseRepeatedLegacyBlocks(
    bytes: Uint8Array,
    startOffset: number,
    expectedValueCount: number
  ): Array<{ blockStart: number; records: ParsedStringRecord[] }> {
    const blocks: Array<{ blockStart: number; records: ParsedStringRecord[] }> = [];
    let cursor = startOffset;

    while (cursor < bytes.byteLength) {
      const blockStart = cursor;
      const records: ParsedStringRecord[] = [];

      for (let index = 0; index < expectedValueCount; index += 1) {
        const stringRead = this.readUtf16LeNullTerminated(bytes, cursor, bytes.byteLength - cursor, true);

        if (!stringRead) {
          return blocks.length > 0 ? blocks : [];
        }

        records.push({
          offset: cursor,
          value: stringRead.value,
          originalByteLength: stringRead.originalByteLength,
          maxByteLength: 0
        });
        cursor = stringRead.nextOffset;
      }

      records.forEach((record, index) => {
        const nextOffset = records[index + 1]?.offset ?? cursor;
        record.maxByteLength = nextOffset - record.offset;
      });

      blocks.push({ blockStart, records });

      if (cursor >= bytes.byteLength) {
        break;
      }
    }

    return blocks;
  }

  private buildStringValueMapFromRecords(records: ParsedStringRecord[]): Map<number, ParsedStringValue> {
    const stringValues = new Map<number, ParsedStringValue>();

    records.forEach((record) => {
      stringValues.set(record.offset, {
        value: record.value,
        originalByteLength: record.originalByteLength,
        maxByteLength: record.maxByteLength,
        sharedReferenceCount: 1
      });
    });

    return stringValues;
  }

  private buildSingleLocaleEntries(
    keys: string[],
    valueRecords: ParsedStringRecord[],
    stringValues: Map<number, ParsedStringValue>
  ): XlcEntry[] {
    return keys.map((key, index) => {
      const record = valueRecords[index];

      if (!record) {
        throw new Error(`Unsupported XLC layout: missing value for key ${key}.`);
      }

      const stringValue = stringValues.get(record.offset);
      if (!stringValue) {
        throw new Error(`Unsupported XLC layout: missing decoded string at 0x${record.offset.toString(16).toUpperCase()}.`);
      }

      const locale: XlcLocaleValue = {
        localeId: DEFAULT_LOCALE_ID,
        localeLabel: 'Default',
        offset: record.offset,
        maxByteLength: stringValue.maxByteLength,
        originalByteLength: stringValue.originalByteLength,
        sharedReferenceCount: 1,
        value: stringValue.value
      };

      return {
        index,
        key,
        locales: [locale]
      };
    });
  }

  private buildLocaleByKeyMap(entries: XlcEntry[]): Map<string, XlcLocaleValue> {
    const localeByKey = new Map<string, XlcLocaleValue>();

    entries.forEach((entry) => {
      const locale = this.getPreferredLocale(entry.locales);

      if (locale) {
        localeByKey.set(entry.key, locale);
      }
    });

    return localeByKey;
  }

  private getPreferredLocale(locales: XlcLocaleValue[]): XlcLocaleValue | null {
    if (!locales.length) {
      return null;
    }

    return locales.find((locale) => locale.value.trim().length > 0) ?? locales[0];
  }

  private parseLocaleDirectory(bytes: Uint8Array, firstKeyOffset: number): LocaleDirectoryEntry[] {
    const directoryByteLength = firstKeyOffset - FIRST_ENTRY_OFFSET;

    if (directoryByteLength <= 0 || directoryByteLength % 8 !== 0) {
      throw new Error('Unsupported XLC layout: locale directory size is invalid.');
    }

    const localeCount = directoryByteLength / 8;
    if (localeCount < 1 || localeCount > MAX_LOCALE_PAIR_COUNT) {
      throw new Error(`Unsupported XLC layout: unreasonable locale count ${localeCount}.`);
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const locales: LocaleDirectoryEntry[] = [];

    for (let index = 0; index < localeCount; index += 1) {
      const pairOffset = FIRST_ENTRY_OFFSET + index * 8;
      const blockStart = view.getUint32(pairOffset, true);
      const localeId = view.getUint32(pairOffset + 4, true);

      if (blockStart >= bytes.byteLength) {
        throw new Error(`Unsupported XLC layout: locale block offset 0x${blockStart.toString(16).toUpperCase()} is outside the file.`);
      }

      locales.push({ localeId, blockStart });
    }

    return locales;
  }

  private parseKeys(bytes: Uint8Array, startOffset: number, endOffset: number): string[] {
    const keys: string[] = [];
    let cursor = startOffset;

    while (cursor < endOffset) {
      const keyRead = this.readUtf16LeNullTerminated(bytes, cursor, endOffset - cursor);

      if (!keyRead || !this.isPlausibleKey(keyRead.value)) {
        throw new Error(`Unsupported XLC layout: invalid key string at 0x${cursor.toString(16).toUpperCase()}.`);
      }

      keys.push(keyRead.value);
      cursor = keyRead.nextOffset;
    }

    if (keys.length === 0 || keys.length > MAX_REASONABLE_KEY_COUNT) {
      throw new Error(`Unsupported XLC layout: unreasonable key count ${keys.length}.`);
    }

    return keys;
  }

  private parseLocaleBlocks(
    bytes: Uint8Array,
    locales: LocaleDirectoryEntry[],
    keyCount: number
  ): Map<number, ParsedStringRecord[]> {
    const uniqueStarts = Array.from(new Set(locales.map((locale) => locale.blockStart))).sort((left, right) => left - right);
    const blockRecords = new Map<number, ParsedStringRecord[]>();

    uniqueStarts.forEach((blockStart, index) => {
      const blockEnd = uniqueStarts[index + 1] ?? bytes.byteLength;
      blockRecords.set(blockStart, this.parseStringBlock(bytes, blockStart, blockEnd, keyCount));
    });

    return blockRecords;
  }

  private parseStringBlock(
    bytes: Uint8Array,
    blockStart: number,
    blockEnd: number,
    expectedStringCount: number
  ): ParsedStringRecord[] {
    const records: ParsedStringRecord[] = [];
    let cursor = blockStart;

    for (let index = 0; index < expectedStringCount; index += 1) {
      const stringRead = this.readUtf16LeNullTerminated(bytes, cursor, blockEnd - cursor);

      if (!stringRead) {
        throw new Error(`Unsupported XLC layout: locale block at 0x${blockStart.toString(16).toUpperCase()} ended before all strings were read.`);
      }

      records.push({
        offset: cursor,
        value: stringRead.value,
        originalByteLength: stringRead.originalByteLength,
        maxByteLength: 0
      });
      cursor = stringRead.nextOffset;
    }

    records.forEach((record, index) => {
      const nextOffset = records[index + 1]?.offset ?? blockEnd;
      record.maxByteLength = nextOffset - record.offset;
    });

    return records;
  }

  private buildOffsetUsage(
    locales: LocaleDirectoryEntry[],
    blockRecords: Map<number, ParsedStringRecord[]>,
    keyCount: number
  ): Map<number, number> {
    const offsetUsage = new Map<number, number>();

    locales.forEach((locale) => {
      const records = blockRecords.get(locale.blockStart);

      if (!records || records.length !== keyCount) {
        throw new Error(`Unsupported XLC layout: locale block 0x${locale.blockStart.toString(16).toUpperCase()} could not be mapped to the key list.`);
      }

      records.forEach((record) => {
        offsetUsage.set(record.offset, (offsetUsage.get(record.offset) ?? 0) + 1);
      });
    });

    return offsetUsage;
  }

  private buildStringValueMap(
    blockRecords: Map<number, ParsedStringRecord[]>,
    offsetUsage: Map<number, number>
  ): Map<number, ParsedStringValue> {
    const stringValues = new Map<number, ParsedStringValue>();

    blockRecords.forEach((records) => {
      records.forEach((record) => {
        if (stringValues.has(record.offset)) {
          return;
        }

        stringValues.set(record.offset, {
          value: record.value,
          originalByteLength: record.originalByteLength,
          maxByteLength: record.maxByteLength,
          sharedReferenceCount: offsetUsage.get(record.offset) ?? 1
        });
      });
    });

    return stringValues;
  }

  private buildEntries(
    keys: string[],
    locales: LocaleDirectoryEntry[],
    blockRecords: Map<number, ParsedStringRecord[]>,
    stringValues: Map<number, ParsedStringValue>
  ): XlcEntry[] {
    return keys.map((key, index) => ({
      index,
      key,
      locales: locales.map((locale) => {
        const record = blockRecords.get(locale.blockStart)?.[index];

        if (!record) {
          throw new Error(`Unsupported XLC layout: missing locale string for key ${key}.`);
        }

        const stringValue = stringValues.get(record.offset);
        if (!stringValue) {
          throw new Error(`Unsupported XLC layout: missing decoded string at 0x${record.offset.toString(16).toUpperCase()}.`);
        }

        const hydratedLocale: XlcLocaleValue = {
          localeId: locale.localeId,
          localeLabel: `Locale ${locale.localeId}`,
          offset: record.offset,
          maxByteLength: stringValue.maxByteLength,
          originalByteLength: stringValue.originalByteLength,
          sharedReferenceCount: stringValue.sharedReferenceCount,
          value: stringValue.value
        };

        return hydratedLocale;
      })
    }));
  }

  private getSerializedData(): Uint8Array {
    if (!this.binaryData) {
      throw new Error('No XLC file loaded');
    }

    const prefix = this.binaryData.slice(0, this.valuesStartOffset);
    const sortedEntries = [...this.entries].sort((left, right) => left.index - right.index);

    if (sortedEntries.length === 0) {
      return prefix;
    }

    const localeLayout = sortedEntries[0].locales.map((locale) => ({ localeId: locale.localeId }));

    if (localeLayout.length === 0) {
      throw new Error(`Missing locale for XLC key ${sortedEntries[0].key}.`);
    }

    sortedEntries.forEach((entry) => {
      if (entry.locales.length !== localeLayout.length) {
        throw new Error(`Inconsistent locale count for XLC key ${entry.key}.`);
      }

      entry.locales.forEach((locale, localeIndex) => {
        if (locale.localeId !== localeLayout[localeIndex].localeId) {
          throw new Error(`Inconsistent locale ordering for XLC key ${entry.key}.`);
        }
      });
    });

    const orderedEntries = localeLayout.length === 1
      ? sortedEntries
      : this.orderEntriesForSerializedNameBlock(sortedEntries);
    const canonicalBlock = localeLayout.length === 1
      ? this.buildSingleLocaleValueTable(orderedEntries)
      : this.buildCanonicalMultiLocaleBlock(orderedEntries, localeLayout.length);
    const totalValueBytes = canonicalBlock.byteLength * localeLayout.length;
    const output = new Uint8Array(prefix.byteLength + totalValueBytes);
    output.set(prefix, 0);

    const view = new DataView(output.buffer, output.byteOffset, output.byteLength);

    let cursor = prefix.byteLength;
    localeLayout.forEach((_, localeIndex) => {
      const pairOffset = FIRST_ENTRY_OFFSET + localeIndex * 8;
      view.setUint32(pairOffset, cursor, true);

      output.set(canonicalBlock, cursor);
      cursor += canonicalBlock.byteLength;
    });

    return output;
  }

  private buildSingleLocaleValueTable(entries: XlcEntry[]): Uint8Array {
    const records = entries.map((entry) => {
      const locale = entry.locales[0];

      if (!locale) {
        throw new Error(`Missing locale for XLC key ${entry.key}.`);
      }

      return this.encodeUtf16LeValueRecord(locale.value);
    });

    const totalByteLength = records.reduce((sum, record) => sum + record.byteLength, 0);
    const output = new Uint8Array(totalByteLength);
    let cursor = 0;

    records.forEach((record) => {
      output.set(record, cursor);
      cursor += record.byteLength;
    });

    return output;
  }

  private orderEntriesForSerializedNameBlock(entries: XlcEntry[]): XlcEntry[] {
    return [...entries].sort((left, right) => {
      const leftInfo = this.getSerializedNameBlockOrder(left.key, left.index);
      const rightInfo = this.getSerializedNameBlockOrder(right.key, right.index);

      if (leftInfo.nameOrder !== rightInfo.nameOrder) {
        return leftInfo.nameOrder - rightInfo.nameOrder;
      }

      if (leftInfo.teamId !== rightInfo.teamId) {
        return leftInfo.teamId - rightInfo.teamId;
      }

      return left.index - right.index;
    });
  }

  private getSerializedNameBlockOrder(
    key: string,
    fallbackIndex: number
  ): { teamId: number; nameOrder: number } {
    const match = /^TXT_TEAMNAME(LONG|MED|SHORT)_(\d+)$/u.exec(key);

    if (!match) {
      return {
        teamId: Number.MAX_SAFE_INTEGER,
        nameOrder: fallbackIndex
      };
    }

    const [, type, teamIdText] = match;
    const nameOrder = type === 'LONG'
      ? 0
      : type === 'MED'
        ? 1
        : 2;

    return {
      teamId: Number(teamIdText),
      nameOrder
    };
  }

  private buildCanonicalMultiLocaleBlock(entries: XlcEntry[], localeCount: number): Uint8Array {
    if (!this.binaryData) {
      throw new Error('No XLC file loaded');
    }

    const firstEntry = entries[0];
    const firstLocale = firstEntry?.locales[0];

    if (!firstLocale) {
      throw new Error('Missing locale data for canonical multi-locale block generation.');
    }

    const compactRecords = entries.map((entry) => {
      const locale = entry.locales[0];

      if (!locale) {
        throw new Error(`Missing locale for XLC key ${entry.key}.`);
      }

      return this.encodeUtf16LeValueRecord(locale.value);
    });
    const compactByteLength = compactRecords.reduce((sum, record) => sum + record.byteLength, 0);
    const output = new Uint8Array(compactByteLength);

    let cursor = 0;
    compactRecords.forEach((record) => {
      output.set(record, cursor);
      cursor += record.byteLength;
    });

    return output;
  }

  private readUtf16LeNullTerminated(
    bytes: Uint8Array,
    offset: number,
    maxByteLength = bytes.byteLength - offset,
    trimTrailingSpaces = false
  ): { value: string; nextOffset: number; originalByteLength: number } | null {
    const maxOffset = Math.min(bytes.byteLength, offset + maxByteLength);

    for (let cursor = offset; cursor + 1 < maxOffset; cursor += 2) {
      if (bytes[cursor] === 0 && bytes[cursor + 1] === 0) {
        const slice = bytes.slice(offset, cursor);
        const decodedValue = this.decoder.decode(slice);
        return {
          value: trimTrailingSpaces ? decodedValue.replace(/ +$/u, '') : decodedValue,
          nextOffset: cursor + 2,
          originalByteLength: (cursor + 2) - offset
        };
      }
    }

    return null;
  }

  private encodeUtf16LeNullTerminated(value: string): Uint8Array {
    const output = new Uint8Array((value.length + 1) * 2);

    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      output[index * 2] = codeUnit & 0xff;
      output[index * 2 + 1] = codeUnit >> 8;
    }

    return output;
  }

  private encodeUtf16LeValueRecord(value: string): Uint8Array {
    return this.encodeUtf16LeNullTerminated(value);
  }

  private isResourceKey(value: string): boolean {
    return this.isPlausibleKey(value) && value.startsWith('TXT_');
  }

  private isPlausibleKey(value: string): boolean {
    return value.length >= 2
      && value.length <= 120
      && /^[\u0020-\u007e]+$/.test(value)
      && /[A-Za-z]/.test(value);
  }

  private async hasReadPermission(fileHandle: any): Promise<boolean> {
    if (!fileHandle) {
      return false;
    }

    if (typeof fileHandle.queryPermission === 'function') {
      const permission = await fileHandle.queryPermission({ mode: 'read' });
      if (permission === 'granted') {
        return true;
      }
    }

    if (typeof fileHandle.requestPermission === 'function') {
      const permission = await fileHandle.requestPermission({ mode: 'read' });
      return permission === 'granted';
    }

    return false;
  }

  private resetState(): void {
    this.fileHandle = null;
    this.binaryData = null;
    this.entries = [];
    this.stringValues.clear();
    this.localeByKey.clear();
    this.valuesStartOffset = 0;
    this.hasPendingChanges = false;
  }
}
