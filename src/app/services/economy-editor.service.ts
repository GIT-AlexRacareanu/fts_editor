import { Injectable } from '@angular/core';

declare const pako: any;

/**
 * Handles the FTS "managermode_economy.dat" container format:
 *   - Whole 32-bit little-endian words are XOR-encrypted with a fixed key.
 *   - The decrypted payload is a standard zlib (deflate) stream wrapping XML.
 *
 * Any trailing bytes that do not complete a full 4-byte word are left as-is,
 * mirroring the behaviour of the original game files.
 */
@Injectable({ providedIn: 'root' })
export class EconomyEditorService {
  private static readonly KEY = 0x53d392af;

  /** Decrypt + decompress a raw .dat file into its XML text. */
  decryptToXml(fileBytes: Uint8Array): string {
    if (!fileBytes || fileBytes.length === 0) {
      throw new Error('The selected file is empty.');
    }

    if (typeof pako === 'undefined') {
      throw new Error('Compression library (pako) is not available.');
    }

    // Work on a copy so the original bytes stay intact.
    const working = fileBytes.slice();
    this.applyXor(working);

    const decompressed: Uint8Array = pako.inflate(working);
    const xml = new TextDecoder('utf-8').decode(decompressed).trim();
    return xml;
  }

  /** Compress + encrypt XML text back into the raw .dat byte layout. */
  encryptFromXml(xmlText: string): Uint8Array {
    const trimmed = (xmlText ?? '').trim();
    if (!trimmed) {
      throw new Error('The XML content is empty.');
    }

    if (typeof pako === 'undefined') {
      throw new Error('Compression library (pako) is not available.');
    }

    const xmlBytes = new TextEncoder().encode(trimmed);
    const compressed: Uint8Array = pako.deflate(xmlBytes);

    // Encrypt over a padded buffer (multiple of 4) so DataView word writes are safe,
    // then trim back to the real compressed length.
    const paddedLength = Math.ceil(compressed.length / 4) * 4;
    const buffer = new Uint8Array(paddedLength);
    buffer.set(compressed);

    this.applyXor(buffer);

    return buffer.slice(0, compressed.length);
  }

  /**
   * XOR every complete 32-bit little-endian word in `bytes` with the fixed key.
   * The XOR is its own inverse, so the same routine encrypts and decrypts.
   */
  private applyXor(bytes: Uint8Array): void {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const numWords = Math.floor(bytes.length / 4);
    for (let i = 0; i < numWords; i++) {
      const offset = i * 4;
      const value = view.getUint32(offset, true);
      view.setUint32(offset, (value ^ EconomyEditorService.KEY) >>> 0, true);
    }
  }
}
