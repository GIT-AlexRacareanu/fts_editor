import { Component, OnInit } from '@angular/core';
import { FORMATION_PRESETS, FormationPreset } from './data/formations';
import { NATIONALITY_NAMES_BY_ID, NATIONALITY_OPTIONS } from './data/nationalities';
import { Player } from './models/player.model';
import { TeamRecord, TeamSlot } from './models/team-editor.model';
import { TeamsDatRecord } from './models/teams-dat.model';
import { ImportedPlayerRecord, PlayerImportService } from './services/player-import.service';
import { PlayerService } from './services/player.service';
import { TeamEditorService } from './services/team-editor.service';
import { TeamsDatService } from './services/teams-dat.service';

const FORMATION_VALUE_BY_ID: Record<number, string> = {
  0: '4-4-2',
  1: '4-3-3',
  2: '4-2-4',
  3: '5-4-1',
  4: '5-3-2',
  5: '3-5-2',
  6: '3-4-3',
  7: '4-5-1',
  8: '4-2-3-1(a)',
  9: '4-2-3-1(b)',
  10: '4-3-1-2',
  11: '4-4-1-1(a)',
  12: '4-4-1-1(b)',
  13: '3-4-1-2',
  14: '4-1-2-1-2',
  15: '1-4-3-2',
  16: '3-4-2-1',
  17: '4-3-2-1',
  18: '5-2-1-2',
  19: '5-2-2-1'
};

const FORMATION_BY_VALUE = new Map(FORMATION_PRESETS.map((formation) => [formation.value, formation]));

interface FormationSketchPlayer {
  slotIndex: number;
  playerIdHex: string;
  playerName?: string;
  shirtNumber: number;
  position: number;
  positionLabel: string;
}

interface FormationSketchSlot {
  slotKey: string;
  top: string;
  left: string;
  targetPosition: number;
  targetPositionLabel: string;
  player?: FormationSketchPlayer;
}

interface FormationSketch {
  formation: FormationPreset;
  slots: FormationSketchSlot[];
  reservePlayers: FormationSketchPlayer[];
  sourceLabel: string;
}

interface DbBrowsePlayer {
  index: number;
  hexId: string;
  name: string;
  ovr: number;
  position: number;
  positionLabel: string;
  nationalityId: number;
  clubs: string[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private readonly importAssetUrl = 'assets/import/fc-player-import.csv';

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
  dbSearchNameQuery = '';
  dbSearchNationalityQuery: number | null = null;
  dbBrowsePage = 1;
  importSearchQuery = '';
  importSourceFileName = '';
  showImportPicker = false;
  teamAddSearchQuery = '';
  selectedTeamAddPlayerIndex: number | null = null;
  teamAddPickerOffset: number | null = null;
  selectedTeamEditorOffset: number | null = null;
  selectedTeamEditorSlotIndex: number | null = null;
  selectedTeamOffset: number | null = null;
  selectedTeamsDatIndex: number | null = null;
  displayedTeams: TeamRecord[] = [];
  dbBrowsePlayers: DbBrowsePlayer[] = [];
  importedPlayers: ImportedPlayerRecord[] = [];
  selectedImportedPlayer: ImportedPlayerRecord | null = null;
  private readonly teamPlayerNameCache = new Map<number, string | null>();
  private readonly dbBrowsePageSize = 25;
  private readonly importSearchPageSize = 50;

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

  readonly formations = FORMATION_PRESETS;
  readonly formationIdOptions = Object.entries(FORMATION_VALUE_BY_ID)
    .map(([id, value]) => {
      const parsedId = Number(id);
      const formation = FORMATION_BY_VALUE.get(value);

      return {
        id: parsedId,
        label: formation ? `${formation.label} (ID ${parsedId})` : `${value} (ID ${parsedId})`
      };
    })
    .sort((left, right) => left.id - right.id);

  private readonly formationLaneLefts = ['14%', '31%', '50%', '69%', '86%'];
  private readonly fallbackPitchSlots: Array<{ top: string; left: string }> = [
    { top: '86%', left: '50%' },
    { top: '72%', left: '14%' },
    { top: '72%', left: '31%' },
    { top: '72%', left: '50%' },
    { top: '72%', left: '69%' },
    { top: '72%', left: '86%' },
    { top: '56%', left: '20%' },
    { top: '56%', left: '38%' },
    { top: '56%', left: '62%' },
    { top: '56%', left: '80%' },
    { top: '40%', left: '50%' }
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

  readonly nationalities = NATIONALITY_OPTIONS;

  constructor(
    public playerService: PlayerService,
    public playerImportService: PlayerImportService,
    public teamEditorService: TeamEditorService,
    public teamsDatService: TeamsDatService
  ) {}

  ngOnInit(): void {
    void this.initializeApp();
  }

  get fileLoaded(): boolean {
    return this.playerService.binaryData !== null;
  }

  get currentPlayerHexId(): string {
    return this.playerService.formatPlayerId(this.selectedIndex);
  }

  get teamFileLoaded(): boolean {
    return this.teamEditorService.hasData;
  }

  get importSourceLoaded(): boolean {
    return this.importedPlayers.length > 0;
  }

  get teamsDatLoaded(): boolean {
    return this.teamsDatService.hasData;
  }

  get selectedTeamsDatRecord(): TeamsDatRecord | null {
    if (!this.teamsDatLoaded || this.selectedTeamsDatIndex === null) {
      return null;
    }

    return this.teamsDatService.records[this.selectedTeamsDatIndex] ?? null;
  }

  get teamsDatOptions(): { value: number; label: string }[] {
    return this.teamsDatService.records.map((record) => {
      const stadiumLabel = record.stadiumName ? ` | ${record.stadiumName}` : '';
      return {
        value: record.index,
        label: `${record.teamLabel}${stadiumLabel}`
      };
    });
  }

  get teamOptions(): { label: string; offset: number }[] {
    return this.teamEditorService.teamOptions;
  }

  get filteredDbBrowsePlayers(): DbBrowsePlayer[] {
    const normalizedNameQuery = this.dbSearchNameQuery.trim().toLowerCase();
    const nationalityQuery = this.dbSearchNationalityQuery;

    return this.dbBrowsePlayers.filter((player) => {
      const matchesName = !normalizedNameQuery
        || player.name.toLowerCase().includes(normalizedNameQuery)
        || player.hexId.toLowerCase().includes(normalizedNameQuery);

      const matchesNationality = nationalityQuery === null
        || player.nationalityId === nationalityQuery;

      return matchesName && matchesNationality;
    });
  }

  get pagedDbBrowsePlayers(): DbBrowsePlayer[] {
    const startIndex = (this.dbBrowsePage - 1) * this.dbBrowsePageSize;
    return this.filteredDbBrowsePlayers.slice(startIndex, startIndex + this.dbBrowsePageSize);
  }

  get dbBrowseTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredDbBrowsePlayers.length / this.dbBrowsePageSize));
  }

  get dbBrowseRangeStart(): number {
    if (this.filteredDbBrowsePlayers.length === 0) {
      return 0;
    }

    return (this.dbBrowsePage - 1) * this.dbBrowsePageSize + 1;
  }

  get dbBrowseRangeEnd(): number {
    return Math.min(this.dbBrowsePage * this.dbBrowsePageSize, this.filteredDbBrowsePlayers.length);
  }

  get filteredImportedPlayers(): ImportedPlayerRecord[] {
    return this.playerImportService
      .searchPlayers(this.importedPlayers, this.importSearchQuery)
      .slice(0, this.importSearchPageSize);
  }

  get filteredTeamAddPlayers(): DbBrowsePlayer[] {
    const normalizedQuery = this.teamAddSearchQuery.trim().toLowerCase();

    return this.dbBrowsePlayers
      .filter((player) => !normalizedQuery
        || player.name.toLowerCase().includes(normalizedQuery)
        || player.hexId.toLowerCase().includes(normalizedQuery))
      .slice(0, this.importSearchPageSize);
  }

  async openImportPicker(): Promise<void> {
    if (!this.fileLoaded) {
      alert('Load PLAYERS.DAT first.');
      return;
    }

    if (!this.importSourceLoaded) {
      await this.loadImportSource(false, true);
    }

    if (!this.importSourceLoaded) {
      return;
    }

    this.showImportPicker = !this.showImportPicker;
  }

  async openFile(): Promise<void> {
    try {
      await this.playerService.loadFile();
      this.applyPlayerFileLoaded();
      alert('File loaded successfully!');
    } catch (err: any) {
      alert(err.message || 'File loading failed or was cancelled.');
    }
  }

  async openTeamFile(): Promise<void> {
    try {
      const fileName = await this.teamEditorService.loadFile();
      this.applyTeamFileLoaded();
      alert(`Loaded team DB: ${fileName}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load team database.';
      alert(message);
    }
  }

  async openTeamsDatFile(): Promise<void> {
    try {
      const fileName = await this.teamsDatService.loadFile();
      this.applyTeamsDatLoaded();
      alert(`Loaded teams.dat: ${fileName}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load teams.dat.';
      alert(message);
    }
  }

  async saveTeamsDat(): Promise<void> {
    if (!this.teamsDatLoaded) {
      alert('No teams.dat loaded!');
      return;
    }

    try {
      await this.teamsDatService.saveToSameFile();
      alert('teams.dat changes applied and file overwritten successfully!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed. Make sure you gave the browser permission to save changes.';
      alert(message);
    }
  }

  exportTeamsDat(): void {
    if (!this.teamsDatLoaded) {
      alert('No teams.dat loaded!');
      return;
    }

    this.teamsDatService.exportFile('teams.dat');
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

  openDbBrowsePlayer(index: number): void {
    this.selectedEditorTab = 0;

    setTimeout(() => {
      this.loadPlayer(index);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  exportDbBrowseCsv(): void {
    if (this.filteredDbBrowsePlayers.length === 0) {
      alert('No DB Search results to export.');
      return;
    }

    const header = ['hexId', 'name', 'ovr', 'position', 'nationalityId', 'nationality', 'clubs'];
    const rows = this.filteredDbBrowsePlayers.map((player) => [
      player.hexId,
      player.name || 'Unnamed Player',
      player.ovr.toString(),
      player.positionLabel,
      player.nationalityId.toString(),
      this.getNationalityLabel(player.nationalityId),
      player.clubs.join('; ')
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'db-search-export.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  resetDbBrowsePagination(): void {
    this.dbBrowsePage = 1;
  }

  goToPreviousDbBrowsePage(): void {
    if (this.dbBrowsePage > 1) {
      this.dbBrowsePage -= 1;
    }
  }

  goToNextDbBrowsePage(): void {
    if (this.dbBrowsePage < this.dbBrowseTotalPages) {
      this.dbBrowsePage += 1;
    }
  }

  private escapeCsvValue(value: string): string {
    const normalizedValue = value.replace(/"/g, '""');
    return `"${normalizedValue}"`;
  }

  private async initializeApp(): Promise<void> {
    await this.loadImportSource(false, false);
    await this.restoreRememberedFiles();
  }

  private async restoreRememberedFiles(): Promise<void> {
    const restoredPlayerFileName = await this.playerService.tryRestoreLastFile();

    if (restoredPlayerFileName) {
      this.applyPlayerFileLoaded();
    }

    const restoredTeamFileName = await this.teamEditorService.tryRestoreLastFile();

    if (restoredTeamFileName) {
      this.applyTeamFileLoaded();
    }

    const restoredTeamsDatFileName = await this.teamsDatService.tryRestoreLastFile();

    if (restoredTeamsDatFileName) {
      this.applyTeamsDatLoaded();
    }
  }

  private applyPlayerFileLoaded(): void {
    this.teamPlayerNameCache.clear();
    this.refreshDbBrowsePlayers();

    if (this.playerService.totalPlayers > 0) {
      this.loadPlayer(0);
    }

    this.displayedTeams = this.decorateTeamsWithPlayerNames(this.displayedTeams);
  }

  private applyTeamFileLoaded(): void {
    this.refreshDbBrowsePlayers();
    this.selectedTeamOffset = this.teamOptions.length > 0 ? this.teamOptions[0].offset : null;
    this.displayedTeams = this.selectedTeamOffset === null
      ? []
      : this.decorateTeamsWithPlayerNames([this.teamEditorService.getTeam(this.selectedTeamOffset)]);
  }

  private applyTeamsDatLoaded(): void {
    this.selectedTeamsDatIndex = this.teamsDatService.teamCount > 0 ? 0 : null;
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
      this.refreshPlayerLinkedViews(this.selectedIndex);
      alert('Changes applied and file overwritten successfully!');
    } catch (err: any) {
      alert(err.message || 'Save failed. Make sure you gave the browser permission to save changes.');
    }
  }

  async loadImportSource(showPicker = false, notify = false): Promise<void> {
    try {
      const response = await fetch(this.importAssetUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Import CSV not found at ${this.importAssetUrl}.`);
      }

      const csvText = await response.text();
      const importedPlayers = this.playerImportService.parseCsv(csvText);

      if (importedPlayers.length === 0) {
        alert('No importable players were found in the saved import CSV.');
        return;
      }

      this.importedPlayers = importedPlayers;
      this.importSourceFileName = this.importAssetUrl;
      this.importSearchQuery = '';
      this.selectedImportedPlayer = null;
      this.showImportPicker = showPicker;

      if (notify) {
        alert(`Loaded ${importedPlayers.length} source players from ${this.importAssetUrl}.`);
      }
    } catch (err: unknown) {
      const fallbackMessage = `Failed to load ${this.importAssetUrl}. Add your CSV there and try again.`;
      const message = err instanceof Error ? err.message : fallbackMessage;

      if (notify) {
        alert(message || fallbackMessage);
      }
    }
  }

  clearImportedPlayers(): void {
    this.importedPlayers = [];
    this.importSourceFileName = '';
    this.importSearchQuery = '';
    this.selectedImportedPlayer = null;
    this.showImportPicker = false;
  }

  importPlayer(record: ImportedPlayerRecord): void {
    if (!this.fileLoaded) {
      alert('Load PLAYERS.DAT first.');
      return;
    }

    this.player = this.playerImportService.mapImportedPlayer(record, this.player);
    this.updateOVR();
    this.selectedImportedPlayer = null;
    this.importSearchQuery = '';
    this.showImportPicker = false;
    alert(`Imported ${record.shortName} into FTS player ${this.currentPlayerHexId}.`);
  }

  importSelectedPlayer(): void {
    if (!this.selectedImportedPlayer) {
      return;
    }

    this.importPlayer(this.selectedImportedPlayer);
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

  toggleTeamAddPicker(team: TeamRecord): void {
    if (!this.teamFileLoaded) {
      alert('Load a team database first.');
      return;
    }

    if (!this.fileLoaded) {
      alert('Load PLAYERS.DAT first.');
      return;
    }

    if (this.teamAddPickerOffset === team.offset) {
      this.closeTeamAddPicker();
      return;
    }

    this.teamAddPickerOffset = team.offset;
    this.teamAddSearchQuery = '';
    this.selectedTeamAddPlayerIndex = null;
  }

  addSelectedPlayerToTeam(team: TeamRecord): void {
    if (this.teamAddPickerOffset !== team.offset || this.selectedTeamAddPlayerIndex === null) {
      return;
    }

    const selectedPlayer = this.dbBrowsePlayers.find((player) => player.index === this.selectedTeamAddPlayerIndex);

    if (!selectedPlayer) {
      alert('Choose a valid player to add.');
      return;
    }

    const updatedTeam = this.teamEditorService.addPlayer(team.offset, selectedPlayer.index, selectedPlayer.position);

    if (!updatedTeam) {
      alert('This team already uses all 32 slots.');
      return;
    }

    this.replaceDisplayedTeam(team.offset, updatedTeam);
    this.closeTeamAddPicker();
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

  closeTeamAddPicker(): void {
    this.teamAddPickerOffset = null;
    this.teamAddSearchQuery = '';
    this.selectedTeamAddPlayerIndex = null;
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

  getFormationSketch(team: TeamRecord): FormationSketch {
    const usedPlayers = team.slots.filter((slot) => !slot.isEmpty);
    const starters = team.slots
      .filter((slot) => !slot.isEmpty)
      .slice(0, 11);

    const resolvedFormation = this.resolveFormationForTeam(team);

    if (starters.length === 0) {
      return {
        formation: resolvedFormation.formation ?? this.formations[0],
        slots: [],
        reservePlayers: [],
        sourceLabel: resolvedFormation.sourceLabel
      };
    }

    const sketch = resolvedFormation.formation
      ? this.buildFormationSketch(starters, resolvedFormation.formation)
      : this.buildFirstElevenSketch(starters);

    return {
      ...sketch,
      reservePlayers: usedPlayers.slice(11).map((player) => this.toSketchPlayer(player)),
      sourceLabel: resolvedFormation.sourceLabel
    };
  }

  loadTeamsDatRecord(index: number | null): void {
    if (index === null) {
      this.selectedTeamsDatIndex = null;
      return;
    }

    this.selectedTeamsDatIndex = index;
  }

  updateTeamsDatNumberField(
    record: TeamsDatRecord,
    field: 'teamId' | 'leagueId' | 'rivalId' | 'attackOvr' | 'midfieldOvr' | 'defenseOvr'
    | 'captainRole' | 'leftCornerRole' | 'rightCornerRole' | 'penaltyRole' | 'freeKickRole',
    value: string | number
  ): void {
    const changes: Partial<Pick<TeamsDatRecord,
      'teamId' | 'leagueId' | 'rivalId' | 'attackOvr' | 'midfieldOvr' | 'defenseOvr'
      | 'captainRole' | 'leftCornerRole' | 'rightCornerRole' | 'penaltyRole' | 'freeKickRole'
    >> = {};

    changes[field] = Number(value);
    this.teamsDatService.updateRecord(record.index, changes);
  }

  updateTeamsDatFormation(record: TeamsDatRecord, value: string | number): void {
    this.teamsDatService.updateRecord(record.index, { formationId: Number(value) });
  }

  updateTeamsDatRegion(record: TeamsDatRecord, value: string): void {
    this.teamsDatService.updateRecord(record.index, { region: value });
  }

  selectTeamPlayer(team: TeamRecord, formationSketch: FormationSketch, slotIndex: number): void {
    if (this.selectedTeamEditorOffset === team.offset && this.selectedTeamEditorSlotIndex === slotIndex) {
      this.clearSelectedTeamPlayer();
      return;
    }

    if (this.selectedTeamEditorOffset === team.offset && this.selectedTeamEditorSlotIndex !== null) {
      this.swapFormationPlayers(team, formationSketch, this.selectedTeamEditorSlotIndex, slotIndex);
      return;
    }

    this.selectedTeamEditorOffset = team.offset;
    this.selectedTeamEditorSlotIndex = slotIndex;
  }

  clearSelectedTeamPlayer(): void {
    this.selectedTeamEditorOffset = null;
    this.selectedTeamEditorSlotIndex = null;
  }

  isSelectedTeamPlayer(team: TeamRecord, slotIndex: number): boolean {
    return this.selectedTeamEditorOffset === team.offset && this.selectedTeamEditorSlotIndex === slotIndex;
  }

  getSelectedTeamSlot(team: TeamRecord): TeamSlot | null {
    if (this.selectedTeamEditorOffset !== team.offset || this.selectedTeamEditorSlotIndex === null) {
      return null;
    }

    return team.slots.find((slot) => slot.index === this.selectedTeamEditorSlotIndex) ?? null;
  }

  updateSelectedTeamPlayerId(team: TeamRecord, value: string): void {
    const slot = this.getSelectedTeamSlot(team);

    if (!slot) {
      return;
    }

    this.updateTeamPlayerId(team, slot, value);
  }

  updateSelectedTeamShirtNumber(team: TeamRecord, value: string | number): void {
    const slot = this.getSelectedTeamSlot(team);

    if (!slot) {
      return;
    }

    this.updateTeamShirtNumber(team, slot, value);
  }

  updateSelectedTeamPosition(team: TeamRecord, value: string | number): void {
    const slot = this.getSelectedTeamSlot(team);

    if (!slot) {
      return;
    }

    this.updateTeamPosition(team, slot, value);
  }

  deleteSelectedTeamPlayer(team: TeamRecord): void {
    const slot = this.getSelectedTeamSlot(team);

    if (!slot) {
      return;
    }

    this.deleteTeamSlot(team, slot);
  }

  trackSketchPlayer(_: number, player: FormationSketchPlayer): number {
    return player.slotIndex;
  }

  trackSketchSlot(_: number, slot: FormationSketchSlot): string {
    return slot.slotKey;
  }

  private swapFormationPlayers(
    team: TeamRecord,
    formationSketch: FormationSketch,
    sourceSlotIndex: number,
    targetSlotIndex: number
  ): void {
    const orderedUsedPlayers = [
      ...formationSketch.slots.map((slot) => slot.player).filter((player): player is FormationSketchPlayer => Boolean(player)),
      ...formationSketch.reservePlayers
    ];

    const sourceOrderIndex = orderedUsedPlayers.findIndex((player) => player.slotIndex === sourceSlotIndex);
    const targetOrderIndex = orderedUsedPlayers.findIndex((player) => player.slotIndex === targetSlotIndex);

    if (sourceOrderIndex === -1 || targetOrderIndex === -1 || sourceOrderIndex === targetOrderIndex) {
      this.clearSelectedTeamPlayer();
      return;
    }

    const swappedPlayers = [...orderedUsedPlayers];
    [swappedPlayers[sourceOrderIndex], swappedPlayers[targetOrderIndex]] = [
      swappedPlayers[targetOrderIndex],
      swappedPlayers[sourceOrderIndex]
    ];

    const updatedTeam = this.teamEditorService.reorderUsedPlayers(
      team.offset,
      swappedPlayers.map((player) => player.slotIndex),
      formationSketch.slots.map((slot) => slot.targetPosition)
    );

    this.replaceDisplayedTeam(team.offset, updatedTeam);

    if (this.selectedTeamEditorOffset === team.offset) {
      this.clearSelectedTeamPlayer();
    }
  }

  private replaceDisplayedTeam(offset: number, updatedTeam: TeamRecord): void {
    const decoratedTeam = this.decorateTeamWithPlayerNames(updatedTeam);
    this.displayedTeams = this.displayedTeams.map((team) => team.offset === offset ? decoratedTeam : team);
    this.refreshDbBrowsePlayers();

    if (this.selectedTeamOffset === offset && !this.displayedTeams.some((team) => team.offset === offset)) {
      this.displayedTeams = [decoratedTeam];
    }

    if (this.selectedTeamEditorOffset === offset && this.selectedTeamEditorSlotIndex !== null) {
      const selectedSlot = decoratedTeam.slots.find((slot) => slot.index === this.selectedTeamEditorSlotIndex);

      if (!selectedSlot || selectedSlot.isEmpty) {
        this.clearSelectedTeamPlayer();
      }
    }
  }

  private refreshPlayerLinkedViews(playerIndex: number): void {
    this.teamPlayerNameCache.delete(playerIndex);

    if (this.displayedTeams.length > 0) {
      this.displayedTeams = this.decorateTeamsWithPlayerNames(this.displayedTeams);
    }

    this.refreshDbBrowsePlayers();
  }

  private refreshDbBrowsePlayers(): void {
    if (!this.fileLoaded) {
      this.dbBrowsePlayers = [];
      this.resetDbBrowsePagination();
      return;
    }

    const clubMap = this.teamFileLoaded ? this.teamEditorService.getPlayerClubMap() : new Map<number, string[]>();
    const players: DbBrowsePlayer[] = [];

    for (let index = 0; index < this.playerService.totalPlayers; index++) {
      const player = this.playerService.readPlayer(index);

      players.push({
        index,
        hexId: this.playerService.formatPlayerId(index),
        name: player.name,
        ovr: this.playerService.calculateOVR(player),
        position: player.pos,
        positionLabel: this.getPositionLabel(player.pos),
        nationalityId: player.nat,
        clubs: clubMap.get(index) ?? []
      });
    }

    this.dbBrowsePlayers = players.sort((left, right) => {
      if (right.ovr !== left.ovr) {
        return right.ovr - left.ovr;
      }

      return left.index - right.index;
    });
    this.resetDbBrowsePagination();
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

  private buildFormationSketch(players: TeamSlot[], formation: FormationPreset): FormationSketch {
    const matched = this.matchFormation(players, formation);
    return {
      formation: matched.formation,
      slots: matched.slots,
      reservePlayers: [],
      sourceLabel: 'teams.dat'
    };
  }

  private buildFirstElevenSketch(players: TeamSlot[]): FormationSketch {
    const slots: FormationSketchSlot[] = this.fallbackPitchSlots.map((pitchSlot, index) => {
      const player = players[index];

      if (!player) {
        return {
          slotKey: `fallback-${index}`,
          top: pitchSlot.top,
          left: pitchSlot.left,
          targetPosition: 0,
          targetPositionLabel: '--'
        };
      }

      return {
        slotKey: `fallback-${index}`,
        top: pitchSlot.top,
        left: pitchSlot.left,
        targetPosition: player.position,
        targetPositionLabel: this.getPositionLabel(player.position),
        player: this.toSketchPlayer(player)
      };
    });

    return {
      formation: this.formations[0],
      slots,
      reservePlayers: [],
      sourceLabel: 'First 11 players (teams.dat not loaded)'
    };
  }

  private resolveFormationForTeam(team: TeamRecord): {
    formation: FormationPreset | undefined;
    sourceLabel: string;
  } {
    if (this.teamsDatLoaded) {
      const formationId = this.teamsDatService.getFormationIdByTeamId(team.teamId);

      if (formationId !== null) {
        const formation = this.getFormationFromId(formationId);

        if (formation) {
          return {
            formation,
            sourceLabel: `teams.dat formation ID ${formationId}`
          };
        }
      }
    }

    return {
      formation: undefined,
      sourceLabel: 'First 11 players (teams.dat not loaded)'
    };
  }

  private getFormationFromId(formationId: number): FormationPreset | undefined {
    const formationValue = FORMATION_VALUE_BY_ID[formationId];
    if (!formationValue) {
      return undefined;
    }

    return FORMATION_BY_VALUE.get(formationValue);
  }

  private matchFormation(players: TeamSlot[], formation: FormationPreset): {
    formation: FormationPreset;
    slots: FormationSketchSlot[];
    score: number;
  } {
    const pitchLineTops = this.getPitchLineTops(formation.lines.length + 1);
    const remainingPlayers = [...players];
    const sketchSlots: FormationSketchSlot[] = [];
    let score = 0;

    const goalkeeper = this.pickBestPlayerForSlot(remainingPlayers, [0]);

    if (goalkeeper) {
      score += goalkeeper.rank;
      this.removeChosenPlayers(remainingPlayers, [goalkeeper.player]);
    }

    sketchSlots.push({
      slotKey: 'gk',
      top: pitchLineTops[0] ?? '86%',
      left: this.formationLaneLefts[2] ?? '50%',
      targetPosition: 0,
      targetPositionLabel: this.getPositionLabel(0),
      player: goalkeeper ? this.toSketchPlayer(goalkeeper.player) : undefined
    });

    formation.lines.forEach((line, lineIndex) => {
      line.slots.forEach((slot, slotIndex) => {
        const match = this.pickBestPlayerForSlot(remainingPlayers, slot.positions);
        const formationSlot: FormationSketchSlot = {
          slotKey: `${lineIndex}-${slotIndex}`,
          top: pitchLineTops[lineIndex + 1] ?? '50%',
          left: this.formationLaneLefts[slot.lane] ?? '50%',
          targetPosition: slot.positions[0],
          targetPositionLabel: this.getPositionLabel(slot.positions[0])
        };

        if (!match) {
          score += 500;
          sketchSlots.push(formationSlot);
          return;
        }

        score += match.rank;
        formationSlot.player = this.toSketchPlayer(match.player);
        sketchSlots.push(formationSlot);
        this.removeChosenPlayers(remainingPlayers, [match.player]);
      });
    });

    score += remainingPlayers.reduce((total, player) => total + 25 + (this.starterPositionOrder[player.position] ?? 25), 0);

    return {
      formation,
      slots: sketchSlots.slice(0, 11),
      score
    };
  }

  private getPitchLineTops(totalRows: number): string[] {
    const bottom = 88;
    const top = 12;

    if (totalRows <= 1) {
      return [`${bottom}%`];
    }

    const step = (bottom - top) / (totalRows - 1);

    return Array.from({ length: totalRows }, (_, index) => `${bottom - step * index}%`);
  }

  private pickBestPlayerForSlot(players: TeamSlot[], preferredPositions: number[]): { player: TeamSlot; rank: number } | undefined {
    return [...players]
      .map((player) => ({ player, rank: this.getSlotRank(player, preferredPositions) }))
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }

        if (left.player.shirtNumber !== right.player.shirtNumber) {
          return left.player.shirtNumber - right.player.shirtNumber;
        }

        return left.player.index - right.player.index;
      })[0];
  }

  private getSlotRank(player: TeamSlot, preferredPositions: number[]): number {
    const preferredRank = preferredPositions.indexOf(player.position);

    if (preferredRank !== -1) {
      return preferredRank;
    }

    return preferredPositions.length + 20 + (this.starterPositionOrder[player.position] ?? 20);
  }

  private removeChosenPlayers(players: TeamSlot[], chosenPlayers: TeamSlot[]): void {
    const chosenSlotIndexes = new Set(chosenPlayers.map((player) => player.index));

    for (let index = players.length - 1; index >= 0; index--) {
      if (chosenSlotIndexes.has(players[index].index)) {
        players.splice(index, 1);
      }
    }
  }

  private toSketchPlayer(player: TeamSlot): FormationSketchPlayer {
    return {
      slotIndex: player.index,
      playerIdHex: player.playerIdHex,
      playerName: player.playerName,
      shirtNumber: player.shirtNumber,
      position: player.position,
      positionLabel: this.getPositionLabel(player.position)
    };
  }

  private readonly starterPositionOrder: Record<number, number> = {
    0: 0,
    1: 1,
    3: 2,
    5: 3,
    6: 4,
    7: 5,
    4: 6,
    2: 7,
    10: 8,
    8: 9,
    9: 10,
    12: 11,
    11: 12,
    13: 13,
    17: 14,
    16: 15,
    14: 16,
    18: 17,
    15: 18,
    20: 19,
    22: 20,
    19: 21,
    21: 22
  };

  private getPositionLabel(positionValue: number): string {
    return this.positions.find((position) => position.value === positionValue)?.label ?? `POS ${positionValue}`;
  }

  getNationalityLabel(nationalityId: number): string {
    const nationalityName = NATIONALITY_NAMES_BY_ID[nationalityId];
    return nationalityName ? `${nationalityName} (${nationalityId})` : `Unknown (${nationalityId})`;
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
