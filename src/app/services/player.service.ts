import { Injectable } from '@angular/core';
import { Player } from '../models/player.model';

declare const pako: any;

export const OFFSET_MAP: Record<string, number> = {
  skin: 88, skin_tone: 82, hair_type: 86, hair: 84,
  beard_type: 87, head_type: 81, estatura: 89, peso: 90,
  pos: 91, boots: 92, mangas: 93, foot: 94, nat: 83,
  ACC: 95, SPD: 96, STA: 97, STR: 98, TAC: 99, CON: 100,
  SHO: 101, CRO: 102, FK: 103, PAS: 104, HEA: 105,
  GKS: 106, GKH: 107, GKP: 108, guantes: 85
};

@Injectable({ providedIn: 'root' })
export class PlayerService {
  binaryData: Uint8Array | null = null;
  fileHandle: any = null;
  readonly PAGE_SIZE = 30;

  get totalPlayers(): number {
    if (!this.binaryData) return 0;
    return new DataView(this.binaryData.buffer).getUint16(8, true);
  }

  async loadFile(): Promise<void> {
    if (!(window as any).showOpenFilePicker) {
      throw new Error('Your browser does not support File System Access API. Use Chrome.');
    }
    const handles = await (window as any).showOpenFilePicker({
      multiple: false,
      types: [{ description: 'DAT Files', accept: { 'application/octet-stream': ['.dat'] } }]
    });
    this.fileHandle = handles[0];
    const file = await this.fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    this.binaryData = new Uint8Array(pako.inflate(new Uint8Array(buffer)));
  }

  async saveToSameFile(player: Player, idx: number): Promise<void> {
    if (!this.fileHandle || !this.binaryData) throw new Error('No file loaded');
    this.writePlayer(idx, player);
    const writable = await this.fileHandle.createWritable();
    await writable.write(pako.deflate(this.binaryData));
    await writable.close();
  }

  async downloadFile(): Promise<void> {
    if (!this.binaryData) return;
    const blob = new Blob([pako.deflate(this.binaryData)], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'players.dat';
    a.click();
  }

  getPageOptions(page: number): { label: string; value: number }[] {
    const total = this.totalPlayers;
    const result: { label: string; value: number }[] = [];
    for (let i = page * this.PAGE_SIZE; i < Math.min((page + 1) * this.PAGE_SIZE, total); i++) {
      result.push({ label: `Index ${i}`, value: i });
    }
    return result;
  }

  readPlayer(idx: number): Player {
    const view = new DataView(this.binaryData!.buffer);
    const base = idx * 112;
    const nameArr = new Uint8Array(this.binaryData!.buffer.slice(base + 48, base + 80));
    const name = new TextDecoder('utf-16').decode(nameArr).replace(/\0/g, '').trim();
    const year = view.getUint16(base + 120, true);
    const player: any = { name, year };
    for (const key of Object.keys(OFFSET_MAP)) {
      player[key] = view.getUint8(base + OFFSET_MAP[key]);
    }
    return player as Player;
  }

  writePlayer(idx: number, player: Player): void {
    const view = new DataView(this.binaryData!.buffer);
    const base = idx * 112;
    for (let i = 0; i < 16; i++) {
      view.setUint16(base + 48 + i * 2, i < player.name.length ? player.name.charCodeAt(i) : 0, true);
    }
    for (const key of Object.keys(OFFSET_MAP)) {
      view.setUint8(base + OFFSET_MAP[key], (player as any)[key]);
    }
    view.setUint16(base + 120, player.year, true);
  }

  searchPlayer(query: string): number {
    const q = query.toLowerCase();
    const total = this.totalPlayers;
    for (let i = 0; i < total; i++) {
      const nameArr = new Uint8Array(this.binaryData!.buffer.slice(i * 112 + 48, i * 112 + 80));
      const name = new TextDecoder('utf-16').decode(nameArr).toLowerCase();
      if (name.includes(q)) return i;
    }
    return -1;
  }

  calculateOVR(player: Player): number {
    const avgSpd = (player.ACC + player.SPD) / 2;
    const getBlock = (stats: number[]) => {
      const best = Math.max(...stats);
      const avg = stats.reduce((a, b) => a + b) / stats.length;
      return (best * 7 + avg) / 8;
    };

    let ovr = 0;
    const pos = player.pos;

    if (pos === 0) {
      const avgGK = (player.GKS + player.GKH + player.GKP) / 3;
      ovr = ((avgGK * 8) + player.STA + avgSpd) / 10;
    } else if (pos >= 1 && pos <= 7) {
      const bSpeed = getBlock([avgSpd, player.STR]);
      const bTech = getBlock([player.SHO, player.HEA, player.STA]);
      const bSkill = getBlock([player.PAS, player.CON, player.TAC]);
      if (pos >= 3 && pos <= 7) {
        ovr = (Math.min(bSkill, bTech) + bSpeed * 2 + Math.max(bSkill, bTech) * 5) / 8;
      } else {
        ovr = (bSkill * 7 + bSpeed) / 8;
      }
    } else if (pos >= 8 && pos <= 18) {
      const bPass = getBlock([player.PAS, player.CON]);
      const bPhys = getBlock([avgSpd, player.STR, player.TAC]);
      if (pos >= 8 && pos <= 10) {
        ovr = (bPhys * 0.75 + bPass * 7.25) / 8;
      } else {
        ovr = (bPass * 7 + bPhys) / 8;
      }
    } else {
      const bPhys = getBlock([avgSpd, player.STR, player.CON]);
      const bTech = getBlock([player.SHO, player.HEA, player.STA]);
      if (pos >= 16 && pos <= 17) {
        ovr = (bTech * 7 + bPhys) / 8;
      } else {
        ovr = (bPhys + (bTech * 1.5) + (player.PAS / 2)) / 3;
      }
    }

    return Math.max(1, Math.min(99, Math.round(ovr)));
  }
}
