import { Component, EventEmitter, Output } from '@angular/core';
import { EconomyEditorService } from '../services/economy-editor.service';

@Component({
  selector: 'app-economy-editor',
  templateUrl: './economy-editor.component.html',
  styleUrls: ['./economy-editor.component.scss']
})
export class EconomyEditorComponent {
  /** Raised when the user wants to leave the Economy Editor view. */
  @Output() readonly close = new EventEmitter<void>();

  xmlContent = '';
  fileName = '';
  hasContent = false;

  private logLines: string[] = ['Console: waiting for a file...'];

  constructor(private readonly economyService: EconomyEditorService) {}

  get logText(): string {
    return this.logLines.join('\n');
  }

  closeEditor(): void {
    this.close.emit();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.resetLog();
    this.xmlContent = '';
    this.hasContent = false;
    this.fileName = file.name;
    this.log(`File loaded: ${file.name} (${file.size} bytes)`);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      this.log('Decrypting and decompressing...');
      this.xmlContent = this.economyService.decryptToXml(bytes);
      this.hasContent = true;
      this.log('Done! You can edit the XML values below.');
    } catch (err) {
      this.hasContent = false;
      this.log(`[READ ERROR]: ${this.errorMessage(err)}`);
    } finally {
      // Allow re-selecting the same file again.
      input.value = '';
    }
  }

  saveAsDat(): void {
    if (!this.xmlContent.trim()) {
      this.log('[SAVE ERROR]: The XML content is empty.');
      return;
    }

    this.log('--- Re-encrypting ---');
    try {
      const datBytes = this.economyService.encryptFromXml(this.xmlContent);
      this.log(`Encrypted file ready (${datBytes.length} bytes).`);
      this.downloadBlob(datBytes, this.downloadName('.dat'), 'application/octet-stream');
      this.log('SUCCESS! Encrypted .dat downloaded.');
    } catch (err) {
      this.log(`[SAVE ERROR]: ${this.errorMessage(err)}`);
    }
  }

  downloadXmlBackup(): void {
    if (!this.xmlContent.trim()) {
      return;
    }
    this.downloadBlob(this.xmlContent, this.downloadName('.xml'), 'text/xml;charset=utf-8');
    this.log('XML backup downloaded.');
  }

  private downloadName(extension: string): string {
    const base = (this.fileName || 'managermode_economy').replace(/\.[^.]+$/, '');
    return `${base}${extension}`;
  }

  private downloadBlob(data: BlobPart, fileName: string, mimeType: string): void {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  private resetLog(): void {
    this.logLines = ['Console:'];
  }

  private log(message: string): void {
    this.logLines.push(message);
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return String(err);
  }
}
