import { Component } from '@angular/core';
import { Player } from './models/player.model';
import { TeamRecord, TeamSlot } from './models/team-editor.model';
import { PlayerService } from './services/player.service';
import { TeamEditorService } from './services/team-editor.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  selectedEditorTab = 0;
  selectedIndex = 0;
  player: Player = this.emptyPlayer();
  ovr = 0;
  ovrColor = '#cd7f32';
  showModal = false;
  modalTimer = 20;
  searchQuery = '';
  playerHexQuery = '';
  teamSearchQuery = '';
  selectedTeamOffset: number | null = null;
  displayedTeams: TeamRecord[] = [];
  private readonly teamPlayerNameCache = new Map<number, string | null>();

  readonly positions = [
    { value: 0, label: 'GK' }, { value: 1, label: 'LB' }, { value: 2, label: 'RB' },
    { value: 3, label: 'LSW' }, { value: 4, label: 'RSW' }, { value: 5, label: 'LCB' },
    { value: 6, label: 'CB' }, { value: 7, label: 'RCB' }, { value: 8, label: 'CDM' },
    { value: 9, label: 'RDM' }, { value: 10, label: 'LDM' }, { value: 11, label: 'CM' },
    { value: 12, label: 'LCM' }, { value: 13, label: 'RCM' }, { value: 14, label: 'LAM' },
    { value: 15, label: 'RAM' }, { value: 16, label: 'RM' }, { value: 17, label: 'LM' },
    { value: 18, label: 'CAM' }, { value: 19, label: 'ST' }, { value: 20, label: 'LW' },
    { value: 21, label: 'RW' }, { value: 22, label: 'CF' }
  ];

  readonly feet = [
    { value: 0, label: 'Right' }, { value: 1, label: 'Left' }, { value: 255, label: 'Default/Both' }
  ];

  readonly skinColors = [
    { value: 0, label: 'White' }, { value: 1, label: 'Reddish' }, { value: 2, label: 'Light Black' },
    { value: 3, label: 'Medium Black' }, { value: 4, label: 'Dark Black' }, { value: 5, label: 'Yellowish' }
  ];

  readonly skinTones = [
    { value: 255, label: 'Default' }, { value: 0, label: 'Level 0' }, { value: 1, label: 'Level 1' },
    { value: 2, label: 'Level 2' }, { value: 3, label: 'Level 3' }
  ];

  readonly headTypes = Array.from({ length: 8 }, (_, i) => ({ value: i, label: `${i}` }));

  readonly hairTypes = [
    { value: 0, label: 'Bald' }, { value: 1, label: 'Mohawk' }, { value: 2, label: 'Short/Receding' },
    { value: 3, label: 'Long Mohawk' }, { value: 4, label: 'Slicked Back' }, { value: 5, label: 'Shaved' },
    { value: 6, label: 'Short Straight' }, { value: 7, label: 'Medium Curly' }, { value: 8, label: 'Medium Straight' },
    { value: 9, label: 'Shoulder Curly' }, { value: 10, label: 'Short Mohawk' }, { value: 11, label: 'Ponytail' },
    { value: 12, label: 'Short Curly' }, { value: 13, label: 'Quiff' }, { value: 14, label: 'Shoulder Straight' },
    { value: 15, label: 'Dreadlocks' }, { value: 16, label: 'Afro' }
  ];

  readonly hairColors = [
    { value: 0, label: 'Black' }, { value: 1, label: 'Brown' }, { value: 2, label: 'Light Brown' },
    { value: 3, label: 'Dark Brown' }, { value: 4, label: 'Light Blonde' }, { value: 5, label: 'Dark Blonde' },
    { value: 6, label: 'Red' }, { value: 7, label: 'Grey' }
  ];

  readonly beardTypes = [
    { value: 0, label: 'None' }, { value: 1, label: 'Mustache' }, { value: 2, label: 'Goatee' },
    { value: 3, label: 'Lined' }, { value: 4, label: 'Full' }, { value: 5, label: 'Long Full' },
    { value: 6, label: 'Sideburns' }, { value: 7, label: 'Short Full' }
  ];

  readonly bootsColors = [
    { value: 0, label: 'Black' }, { value: 1, label: 'White' }, { value: 2, label: 'Gold' },
    { value: 3, label: 'Red' }, { value: 4, label: 'Blue' }, { value: 5, label: 'Pink' },
    { value: 6, label: 'Yellow' }, { value: 7, label: 'Orange' }, { value: 8, label: 'Purple' },
    { value: 9, label: 'Brown' }, { value: 10, label: 'Green' }, { value: 11, label: 'Random' }
  ];

  readonly sleeves = [
    { value: 255, label: 'Default' }, { value: 0, label: 'Random' },
    { value: 1, label: 'Short' }, { value: 2, label: 'Long' }
  ];

  readonly gloves = [
    { value: 5, label: 'None' }, { value: 0, label: 'Blue' }, { value: 1, label: 'Red' },
    { value: 2, label: 'Green' }, { value: 3, label: 'Yellow' }, { value: 4, label: 'Black' }
  ];

  constructor(
    public playerService: PlayerService,
    public teamEditorService: TeamEditorService
  ) {}

  get fileLoaded(): boolean {
    return this.playerService.binaryData !== null;
  }

  get currentPlayerHexId(): string {
    return this.playerService.formatPlayerId(this.selectedIndex);
  }

  get teamFileLoaded(): boolean {
    return this.teamEditorService.hasData;
  }

  get teamOptions(): { label: string; offset: number }[] {
    return this.teamEditorService.teamOptions;
  }

  async openFile(): Promise<void> {
    try {
      await this.playerService.loadFile();
      this.teamPlayerNameCache.clear();
      if (this.playerService.totalPlayers > 0) {
        this.loadPlayer(0);
      }
      this.displayedTeams = this.decorateTeamsWithPlayerNames(this.displayedTeams);
      alert('File loaded successfully!');
    } catch (err: any) {
      alert(err.message || 'File loading failed or was cancelled.');
    }
  }

  async openTeamFile(): Promise<void> {
    try {
      const fileName = await this.teamEditorService.loadFile();
      this.selectedTeamOffset = this.teamOptions.length > 0 ? this.teamOptions[0].offset : null;
      this.displayedTeams = this.selectedTeamOffset === null ? [] : this.decorateTeamsWithPlayerNames([this.teamEditorService.getTeam(this.selectedTeamOffset)]);
      alert(`Loaded team DB: ${fileName}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load team database.';
      alert(message);
    }
  }

  async saveTeam(): Promise<void> {
    if (!this.teamFileLoaded) {
      alert('No team database loaded!');
      return;
    }

    try {
      await this.teamEditorService.saveToSameFile();
      alert('Team changes applied and file overwritten successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed. Make sure you gave the browser permission to save changes.';
      alert(message);
    }
  }

  loadPlayer(idx: any): void {
    this.selectedIndex = +idx;
    this.playerHexQuery = this.currentPlayerHexId;
    this.player = this.playerService.readPlayer(+idx);
    this.updateOVR();
  }

  updateOVR(): void {
    if (!this.fileLoaded) return;
    const val = this.playerService.calculateOVR(this.player);
    this.ovr = val;
    if (val >= 90) this.ovrColor = '#00e5ff';
    else if (val >= 80) this.ovrColor = '#ffd700';
    else if (val >= 70) this.ovrColor = '#c0c0c0';
    else this.ovrColor = '#cd7f32';
  }

  async save(): Promise<void> {
    if (!this.fileLoaded) { alert('No file loaded!'); return; }
    try {
      await this.playerService.saveToSameFile(this.player, this.selectedIndex);
      alert('Changes applied and file overwritten successfully!');
    } catch (err: any) {
      alert(err.message || 'Save failed. Make sure you gave the browser permission to save changes.');
    }
  }

  searchPlayer(): void {
    if (!this.fileLoaded) return;
    const idx = this.playerService.searchPlayer(this.searchQuery);
    if (idx === -1) { alert('Player not found!'); return; }
    this.loadPlayer(idx);
  }

  jumpToPlayerHex(): void {
    if (!this.fileLoaded) {
      return;
    }

    const idx = this.playerService.parsePlayerId(this.playerHexQuery);
    if (idx === -1) {
      alert('Player hex ID not found.');
      return;
    }

    this.loadPlayer(idx);
  }

  loadSingleTeam(offset: number | null): void {
    if (offset === null) {
      this.displayedTeams = [];
      return;
    }

    this.selectedTeamOffset = offset;
    this.displayedTeams = this.decorateTeamsWithPlayerNames([this.teamEditorService.getTeam(offset)]);
  }

  searchTeams(): void {
    if (!this.teamFileLoaded) {
      alert('Load a team database first.');
      return;
    }

    if (!this.teamSearchQuery.trim()) {
      alert('Enter a player ID in hex.');
      return;
    }

    this.displayedTeams = this.decorateTeamsWithPlayerNames(this.teamEditorService.searchTeams(this.teamSearchQuery));

    if (this.displayedTeams.length === 0) {
      alert(`No matches for: ${this.teamSearchQuery.trim().toUpperCase()}`);
    }
  }

  updateTeamPlayerCount(team: TeamRecord, value: string | number): void {
    this.replaceDisplayedTeam(team.offset, this.teamEditorService.updatePlayerCount(team.offset, Number(value)));
  }

  updateTeamPlayerId(team: TeamRecord, slot: TeamSlot, value: string): void {
    this.replaceDisplayedTeam(team.offset, this.teamEditorService.updateSlot(team.offset, slot.index, { playerIdHex: value }));
  }

  updateTeamShirtNumber(team: TeamRecord, slot: TeamSlot, value: string | number): void {
    this.replaceDisplayedTeam(team.offset, this.teamEditorService.updateSlot(team.offset, slot.index, { shirtNumber: Number(value) }));
  }

  updateTeamPosition(team: TeamRecord, slot: TeamSlot, value: string | number): void {
    this.replaceDisplayedTeam(team.offset, this.teamEditorService.updateSlot(team.offset, slot.index, { position: Number(value) }));
  }

  addTeamSlot(team: TeamRecord): void {
    const updatedTeam = this.teamEditorService.addSlot(team.offset);

    if (!updatedTeam) {
      alert('This team already uses all 32 slots.');
      return;
    }

    this.replaceDisplayedTeam(team.offset, updatedTeam);
  }

  deleteTeamSlot(team: TeamRecord, slot: TeamSlot): void {
    if (slot.isEmpty) {
      return;
    }

    this.replaceDisplayedTeam(team.offset, this.teamEditorService.deleteSlot(team.offset, slot.index));
  }

  exportTeamDatabase(): void {
    if (!this.teamFileLoaded) {
      alert('No team database loaded!');
      return;
    }

    this.teamEditorService.exportFile();
  }

  startDownload(): void {
    this.showModal = true;
    this.modalTimer = 20;
    const interval = setInterval(() => {
      this.modalTimer--;
      if (this.modalTimer <= 0) {
        clearInterval(interval);
        this.playerService.downloadFile();
        this.showModal = false;
      }
    }, 1000);
  }

  private replaceDisplayedTeam(offset: number, updatedTeam: TeamRecord): void {
    const decoratedTeam = this.decorateTeamWithPlayerNames(updatedTeam);
    this.displayedTeams = this.displayedTeams.map((team) => team.offset === offset ? decoratedTeam : team);

    if (this.selectedTeamOffset === offset && !this.displayedTeams.some((team) => team.offset === offset)) {
      this.displayedTeams = [decoratedTeam];
    }
  }

  private decorateTeamsWithPlayerNames(teams: TeamRecord[]): TeamRecord[] {
    return teams.map((team) => this.decorateTeamWithPlayerNames(team));
  }

  private decorateTeamWithPlayerNames(team: TeamRecord): TeamRecord {
    return {
      ...team,
      slots: team.slots.map((slot) => ({
        ...slot,
        playerName: this.resolveTeamSlotPlayerName(slot)
      }))
    };
  }

  private resolveTeamSlotPlayerName(slot: TeamSlot): string | undefined {
    if (!this.fileLoaded || slot.isEmpty) {
      return undefined;
    }

    if (!this.teamPlayerNameCache.has(slot.playerId)) {
      this.teamPlayerNameCache.set(slot.playerId, this.playerService.getPlayerNameByIndex(slot.playerId));
    }

    return this.teamPlayerNameCache.get(slot.playerId) ?? undefined;
  }

  private emptyPlayer(): Player {
    return {
      name: '', pos: 0, foot: 0, nat: 0, estatura: 0, peso: 0, year: 0,
      skin: 0, skin_tone: 255, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 255, guantes: 5,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };
  }
}
