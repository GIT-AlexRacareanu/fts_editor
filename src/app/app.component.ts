import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FORMATION_PRESETS, FormationPreset } from './data/formations';
import { NATIONALITY_NAMES_BY_ID, NATIONALITY_OPTIONS } from './data/nationalities';
import { Player } from './models/player.model';
import { TeamRecord, TeamSlot } from './models/team-editor.model';
import { TeamsDatRecord } from './models/teams-dat.model';
import { ImportedPlayerRecord, PlayerImportService } from './services/player-import.service';
import { OvrCategory, OvrTuningConfig, PlayerService } from './services/player.service';
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
const OVR_STAT_LABELS = ['STR', 'STA', 'SPD', 'ACC', 'CON', 'PAS', 'CRO', 'SHO', 'HEA', 'TAC', 'FK', 'GKS', 'GKH', 'GKP'] as const;

interface FormationSketchPlayer {
  slotIndex: number;
  playerIdHex: string;
  playerName?: string;
  shirtNumber: number;
  position: number;
  positionLabel: string;
  ovr: number;
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

interface PopupTeamContext {
  teamOffset: number;
  slotIndex: number;
}

type TeamsRoleField = 'captainRole' | 'leftCornerRole' | 'rightCornerRole' | 'penaltyRole' | 'freeKickRole';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  @ViewChild('popupNameInput') popupNameInput?: ElementRef<HTMLInputElement>;

  private readonly importAssetUrl = 'assets/import/fc-player-import.csv';

  // ─── App flow ────────────────────────────────────────────────
  showInitPage = true;
  activeMainTab = 0;

  // ─── Player Edit Popup ───────────────────────────────────────
  showPlayerEditPopup = false;
  popupPlayerIndex = 0;
  popupPlayer: Player = this.emptyPlayer();
  popupOvr = 0;
  popupOvrColor = '#cd7f32';
  popupSearchQuery = '';
  popupPlayerHexQuery = '';
  popupTeamContext: PopupTeamContext | null = null;
  ovrTuningConfig: OvrTuningConfig[] = [];

  // ─── Import ──────────────────────────────────────────────────
  importedPlayers: ImportedPlayerRecord[] = [];
  importSourceFileName = '';
  showImportPicker = false;
  importSearchQuery = '';
  importStatusMessage = '';
  isBulkImporting = false;

  // ─── Team Import ─────────────────────────────────────────────
  teamImportCsvTeam: string | null = null;
  teamImportCsvTeamSearch = '';
  isTeamImporting = false;
  teamImportStatusMessage = '';

  // ─── DB Browser ──────────────────────────────────────────────
  dbSearchNameQuery = '';
  dbSearchNationalityQuery: number | null = null;
  dbSearchPositionQuery: number | null = null;
  dbSearchTeamQuery: string | null = null;
  dbBrowsePage = 1;
  dbBrowsePlayers: DbBrowsePlayer[] = [];

  // ─── Team Editor ─────────────────────────────────────────────
  teamSearchQuery = '';
  selectedTeamOffset: number | null = null;
  selectedTeamsDatIndex: number | null = null;
  displayedTeams: TeamRecord[] = [];
  teamAddPickerOffset: number | null = null;
  teamAddSearchQuery = '';
  selectedTeamAddPlayerIndex: number | null = null;
  selectedTeamEditorOffset: number | null = null;
  selectedTeamEditorSlotIndex: number | null = null;
  swapModeActive = false;

  // ─── Shared ──────────────────────────────────────────────────
  private readonly teamPlayerNameCache = new Map<number, string | null>();
  private readonly dbBrowsePageSize = 25;
  private readonly importSearchPageSize = 50;
  private readonly importSearchMinLength = 3;

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
  readonly ovrStatLabels = OVR_STAT_LABELS;
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

  readonly leagueOptions = [
    { value: 0, label: 'england 1' },
    { value: 1, label: 'england 2' },
    { value: 2, label: 'france 1' },
    { value: 3, label: 'italy 1' },
    { value: 4, label: 'germany 1' },
    { value: 5, label: 'spain 1' },
    { value: 6, label: 'jap 1' },
    { value: 7, label: 'scottish 1' },
    { value: 8, label: 'usa 1' },
    { value: 9, label: 'european nations' },
    { value: 11, label: 'south american nations' },
    { value: 12, label: 'north american nations' },
    { value: 13, label: 'african nations' },
    { value: 14, label: 'rest of europe' },
    { value: 15, label: 'rest of asia' },
    { value: 16, label: 'rest of america' },
    { value: 17, label: 'classic teams' },
    { value: 19, label: 'france 2' },
    { value: 20, label: 'italy 2' },
    { value: 21, label: 'germany 2' },
    { value: 22, label: 'spain 2' },
    { value: 23, label: 'scottish 2' },
    { value: 24, label: 'netherlands' },
    { value: 25, label: 'netherlands 2' },
    { value: 26, label: 'jap 2' }
  ];

  readonly nationalities = NATIONALITY_OPTIONS;

  constructor(
    public playerService: PlayerService,
    public playerImportService: PlayerImportService,
    public teamEditorService: TeamEditorService,
    public teamsDatService: TeamsDatService
  ) {}

  ngOnInit(): void {
    this.ovrTuningConfig = this.playerService.getOvrTuningConfig();
    void this.initializeApp();
  }

  // ─── App flow ─────────────────────────────────────────────────

  get allFilesLoaded(): boolean {
    return this.fileLoaded && this.teamFileLoaded && this.teamsDatLoaded;
  }

  enterMainApp(): void {
    this.showInitPage = false;
  }

  goToInitPage(): void {
    this.showInitPage = true;
  }

  private checkAutoTransition(): void {
    if (this.allFilesLoaded) {
      this.showInitPage = false;
    }
  }

  // ─── File state getters ───────────────────────────────────────

  get fileLoaded(): boolean {
    return this.playerService.binaryData !== null;
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

    const baseRecord = this.teamsDatService.records[this.selectedTeamsDatIndex] ?? null;

    if (!baseRecord) {
      return null;
    }

    const selectedTeam = this.displayedTeams.find((team) => team.teamId === baseRecord.teamId);

    if (!selectedTeam) {
      return baseRecord;
    }

    return {
      ...baseRecord,
      captainRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'captainRole'),
      leftCornerRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'leftCornerRole'),
      rightCornerRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'rightCornerRole'),
      penaltyRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'penaltyRole'),
      freeKickRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'freeKickRole')
    };
  }

  get teamsDatOptions(): { value: number; label: string }[] {
    return this.teamsDatService.teamOptions;
  }

  // Stable list: rebuilt only when teams.dat data changes
  rivalOptions: { value: number; label: string }[] = [];

  private rebuildRivalOptions(): void {
    this.rivalOptions = this.teamsDatService.records.map((r) => ({ value: r.teamId, label: r.teamLabel }));
  }

  get teamOptions(): { label: string; offset: number }[] {
    return this.teamEditorService.teamOptions;
  }

  // ─── Player Edit Popup ────────────────────────────────────────

  get currentPopupHexId(): string {
    return this.playerService.formatPlayerId(this.popupPlayerIndex);
  }

  get ovrTuningOptions(): OvrTuningConfig[] {
    return this.ovrTuningConfig;
  }

  get popupTeamSlot(): TeamSlot | null {
    if (!this.popupTeamContext) {
      return null;
    }

    const team = this.displayedTeams.find((t) => t.offset === this.popupTeamContext!.teamOffset);

    if (!team) {
      return null;
    }

    return team.slots.find((s) => s.index === this.popupTeamContext!.slotIndex) ?? null;
  }

  openPlayerEditPopup(index: number, teamContext: PopupTeamContext | null = null): void {
    this.popupPlayerIndex = index;
    this.popupPlayer = this.playerService.readPlayer(index);
    this.popupPlayerHexQuery = this.currentPopupHexId;
    this.popupSearchQuery = '';
    this.popupTeamContext = teamContext;
    this.ovrTuningConfig = this.playerService.getOvrTuningConfig();
    this.showImportPicker = false;
    this.importSearchQuery = '';
    this.importStatusMessage = '';
    this.updatePopupOVR();
    this.showPlayerEditPopup = true;
  }

  closePlayerEditPopup(): void {
    this.showPlayerEditPopup = false;
    this.popupTeamContext = null;
    this.importStatusMessage = '';
  }

  updatePopupOVR(): void {
    const val = this.playerService.calculateOVR(this.popupPlayer);
    this.popupOvr = val;

    if (val >= 90) {
      this.popupOvrColor = '#00e5ff';
    } else if (val >= 80) {
      this.popupOvrColor = '#ffd700';
    } else if (val >= 70) {
      this.popupOvrColor = '#c0c0c0';
    } else {
      this.popupOvrColor = '#cd7f32';
    }
  }

  updateOvrWeight(category: OvrCategory, weightIndex: number, value: string | number): void {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return;
    }

    const currentConfig = this.ovrTuningConfig.find((config) => config.category === category);

    if (!currentConfig) {
      return;
    }

    const nextWeights = [...currentConfig.weights];
    nextWeights[weightIndex] = parsed;
    this.playerService.setOvrProfile(category, { weights: nextWeights });
    this.refreshOvrTuningState();
  }

  updateOvrBonus(category: OvrCategory, value: string | number): void {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return;
    }

    this.playerService.setOvrProfile(category, { bonus: parsed });
    this.refreshOvrTuningState();
  }

  updateOvrMultiplier(category: OvrCategory, value: string | number): void {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return;
    }

    this.playerService.setRatingMultiplier(category, parsed);
    this.refreshOvrTuningState();
  }

  applyPopupChanges(): void {
    if (!this.fileLoaded) {
      return;
    }

    this.playerService.writePlayer(this.popupPlayerIndex, this.popupPlayer);
    this.refreshPlayerLinkedViews(this.popupPlayerIndex);
  }

  searchPopupPlayer(): void {
    if (!this.fileLoaded) {
      return;
    }

    const idx = this.playerService.searchPlayer(this.popupSearchQuery);

    if (idx === -1) {
      alert('Player not found!');
      return;
    }

    this.openPlayerEditPopup(idx);
  }

  jumpPopupPlayerHex(): void {
    if (!this.fileLoaded) {
      return;
    }

    const idx = this.playerService.parsePlayerId(this.popupPlayerHexQuery);

    if (idx === -1) {
      alert('Player hex ID not found.');
      return;
    }

    this.openPlayerEditPopup(idx);
  }

  private refreshOvrTuningState(): void {
    this.ovrTuningConfig = this.playerService.getOvrTuningConfig();

    if (this.showPlayerEditPopup) {
      this.refreshPlayerLinkedViews(this.popupPlayerIndex);
      this.updatePopupOVR();
      return;
    }

    this.refreshDbBrowsePlayers();
  }

  // ─── Team slot editing from popup ────────────────────────────

  updatePopupTeamPlayerId(value: string): void {
    const ctx = this.popupTeamContext;

    if (!ctx) {
      return;
    }

    const team = this.displayedTeams.find((t) => t.offset === ctx.teamOffset);

    if (!team) {
      return;
    }

    this.replaceDisplayedTeam(team.offset, this.teamEditorService.updateSlot(team.offset, ctx.slotIndex, { playerIdHex: value }));

    // Reload popup stats for the newly assigned player
    const updatedTeam = this.displayedTeams.find((t) => t.offset === ctx.teamOffset);
    const updatedSlot = updatedTeam?.slots.find((s) => s.index === ctx.slotIndex);

    if (updatedSlot && !updatedSlot.isEmpty) {
      this.popupPlayerIndex = updatedSlot.playerId;
      this.popupPlayer = this.playerService.readPlayer(updatedSlot.playerId);
      this.popupPlayerHexQuery = this.playerService.formatPlayerId(updatedSlot.playerId);
      this.updatePopupOVR();
    }
  }

  updatePopupTeamShirt(value: string | number): void {
    const ctx = this.popupTeamContext;

    if (!ctx) {
      return;
    }

    const team = this.displayedTeams.find((t) => t.offset === ctx.teamOffset);

    if (!team) {
      return;
    }

    this.replaceDisplayedTeam(team.offset, this.teamEditorService.updateSlot(team.offset, ctx.slotIndex, { shirtNumber: Number(value) }));
  }

  updatePopupTeamPosition(value: string | number): void {
    const ctx = this.popupTeamContext;

    if (!ctx) {
      return;
    }

    const team = this.displayedTeams.find((t) => t.offset === ctx.teamOffset);

    if (!team) {
      return;
    }

    this.replaceDisplayedTeam(team.offset, this.teamEditorService.updateSlot(team.offset, ctx.slotIndex, { position: Number(value) }));
  }

  deletePopupTeamPlayer(): void {
    const ctx = this.popupTeamContext;

    if (!ctx) {
      return;
    }

    const team = this.displayedTeams.find((t) => t.offset === ctx.teamOffset);

    if (!team) {
      return;
    }

    const slot = team.slots.find((s) => s.index === ctx.slotIndex);

    if (!slot || slot.isEmpty) {
      return;
    }

    this.replaceDisplayedTeam(team.offset, this.teamEditorService.deleteSlot(team.offset, slot.index));
    this.closePlayerEditPopup();
  }

  // ─── Import ───────────────────────────────────────────────────

  async openImportPicker(): Promise<void> {
    if (!this.importSourceLoaded) {
      await this.loadImportSource(false, true);
    }

    if (!this.importSourceLoaded) {
      return;
    }

    this.showImportPicker = !this.showImportPicker;
  }

  importSelectedPlayer(record: ImportedPlayerRecord): void {
    this.popupPlayer = this.playerImportService.mapImportedPlayer(record, this.popupPlayer);
    this.updatePopupOVR();
    this.importSearchQuery = '';
    this.showImportPicker = false;
    this.importStatusMessage = `Imported ${record.shortName} into player ${this.currentPopupHexId}.`;
    this.focusPopupNameField();
  }

  get canSearchImportedPlayers(): boolean {
    return this.importSearchQuery.trim().length >= this.importSearchMinLength;
  }

  get filteredImportedPlayers(): ImportedPlayerRecord[] {
    if (!this.canSearchImportedPlayers) {
      return [];
    }

    return this.playerImportService
      .searchPlayers(this.importedPlayers, this.importSearchQuery)
      .slice(0, this.importSearchPageSize);
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

  // ─── Team Import ──────────────────────────────────────────────

  csvTeamPlayerCount(teamName: string): number {
    return this.playerImportService.filterByTeam(this.importedPlayers, teamName).length;
  }

  get csvTeamOptions(): string[] {
    return this.playerImportService.getAvailableTeamNames(this.importedPlayers);
  }

  get filteredCsvTeamOptions(): string[] {
    const q = this.teamImportCsvTeamSearch.trim().toLowerCase();
    if (!q) {
      return this.csvTeamOptions;
    }
    return this.csvTeamOptions.filter((t) => t.toLowerCase().includes(q));
  }

  get teamImportPreviewPlayers(): ImportedPlayerRecord[] {
    if (!this.teamImportCsvTeam) {
      return [];
    }

    return this.playerImportService.filterByTeam(this.importedPlayers, this.teamImportCsvTeam);
  }

  get teamImportMappedPreview(): Array<{
    shortName: string;
    futureIndex: number;
    futureHexId: string;
    positionLabel: string;
    ovr: number;
  }> {
    if (!this.teamImportCsvTeam || !this.fileLoaded) {
      return [];
    }

    const csvPlayers = this.playerImportService.filterByTeam(this.importedPlayers, this.teamImportCsvTeam);
    const cappedPlayers = csvPlayers.slice(0, 32);
    const baseIndex = this.playerService.totalPlayers;
    const templatePlayer = baseIndex > 0 ? this.playerService.readPlayer(0) : this.emptyPlayer();

    return cappedPlayers.map((p, i) => {
      const mapped = this.playerImportService.mapImportedPlayer(p, templatePlayer, { includeYear: false });
      const futureIndex = baseIndex + i;

      return {
        shortName: p.shortName,
        futureIndex,
        futureHexId: futureIndex.toString(16).toUpperCase().padStart(4, '0'),
        positionLabel: this.getPositionLabel(mapped.pos),
        ovr: this.playerService.calculateOVR(mapped)
      };
    });
  }

  selectCsvImportTeam(teamName: string): void {
    this.teamImportCsvTeam = teamName;
    this.teamImportCsvTeamSearch = teamName;
    this.teamImportStatusMessage = '';
  }

  clearCsvImportTeam(): void {
    this.teamImportCsvTeam = null;
    this.teamImportCsvTeamSearch = '';
    this.teamImportStatusMessage = '';
  }

  onTeamImportCsvTeamChange(): void {
    this.teamImportCsvTeam = null;
    this.teamImportStatusMessage = '';
  }

  onTeamImportCsvTeamInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.teamImportCsvTeamSearch = value;
    this.onTeamImportCsvTeamChange();
  }

  async importTeamFromCsv(): Promise<void> {
    if (!this.fileLoaded || !this.teamFileLoaded) {
      alert('Load PLAYERS.DAT and TEAMPLAYERLINKS first.');
      return;
    }

    if (!this.teamImportCsvTeam) {
      alert('Select a CSV team first.');
      return;
    }

    if (this.selectedTeamOffset === null) {
      alert('Select a game team in the Team Editor first.');
      return;
    }

    if (this.isTeamImporting) {
      return;
    }

    const csvPlayers = this.playerImportService.filterByTeam(this.importedPlayers, this.teamImportCsvTeam);

    if (csvPlayers.length === 0) {
      alert('No players found for the selected CSV team.');
      return;
    }

    const cappedCount = Math.min(csvPlayers.length, 32);
    const offset = this.selectedTeamOffset!;
    const targetTeam = this.teamOptions.find((t) => t.offset === offset);
    const targetLabel = targetTeam?.label ?? `offset ${offset}`;

    if (!confirm(
      `This will clear the "${targetLabel}" roster and append ${cappedCount} players from "${this.teamImportCsvTeam}" to PLAYERS.DAT. Continue?`
    )) {
      return;
    }

    this.isTeamImporting = true;

    try {
      const templatePlayer = this.playerService.totalPlayers > 0
        ? this.playerService.readPlayer(0)
        : this.emptyPlayer();
      const mappedPlayers = csvPlayers.slice(0, cappedCount).map((p) =>
        this.playerImportService.mapImportedPlayer(p, templatePlayer, { includeYear: false })
      );

      const newIndices = this.playerService.appendPlayers(mappedPlayers);

      this.teamEditorService.clearTeam(offset);

      for (let i = 0; i < newIndices.length; i++) {
        this.teamEditorService.addPlayer(offset, newIndices[i], mappedPlayers[i].pos ?? 0);
      }

      this.applyPlayerFileLoaded();

      if (this.selectedTeamOffset === offset) {
        this.loadSingleTeam(offset);
      }

      this.teamImportStatusMessage = `Imported ${newIndices.length} players for "${this.teamImportCsvTeam}" into ${targetLabel}.`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Team import failed.';
      alert(message);
    } finally {
      this.isTeamImporting = false;
    }
  }

  async bulkReplaceAllPlayersAndDownload(): Promise<void> {
    if (!this.fileLoaded) {
      alert('Load PLAYERS.DAT first.');
      return;
    }

    if (this.isBulkImporting) {
      return;
    }

    if (!this.importSourceLoaded) {
      await this.loadImportSource(false, true);
    }

    if (!this.importSourceLoaded) {
      return;
    }

    const sourcePlayers = this.importedPlayers;
    const shouldContinue = confirm(
      `This will fully replace PLAYERS.DAT players with ${sourcePlayers.length} imported players from ${this.importSourceFileName || this.importAssetUrl}, update the player count header, and download players.dat. Continue?`
    );

    if (!shouldContinue) {
      return;
    }

    this.isBulkImporting = true;

    try {
      const hasTemplatePlayer = this.playerService.totalPlayers > 0;
      const templatePlayer = hasTemplatePlayer ? this.playerService.readPlayer(0) : this.emptyPlayer();
      const mappedPlayers = sourcePlayers.map((sourcePlayer) =>
        this.playerImportService.mapImportedPlayer(sourcePlayer, templatePlayer, { includeYear: false })
      );

      const result = this.playerService.replacePlayers(
        mappedPlayers,
        hasTemplatePlayer ? { templatePlayerIndex: 0 } : {}
      );
      this.applyPlayerFileLoaded();
      await this.playerService.downloadFile();

      this.showImportPicker = false;
      this.importSearchQuery = '';
      this.importStatusMessage = `Bulk replace complete: roster replaced with ${result.replaced} imported players (${result.previousTotal} -> ${result.nextTotal}) and downloaded players.dat.`;

      if (mappedPlayers.length > result.replaced) {
        alert(`Only ${result.replaced} players were kept because players.dat supports a maximum of 65535 players.`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bulk import failed.';
      alert(message);
    } finally {
      this.isBulkImporting = false;
    }
  }

  private focusPopupNameField(): void {
    setTimeout(() => {
      this.popupNameInput?.nativeElement.focus();
      this.popupNameInput?.nativeElement.select();
    });
  }

  // ─── DB Browser ───────────────────────────────────────────────

  get filteredDbBrowsePlayers(): DbBrowsePlayer[] {
    const normalizedNameQuery = this.dbSearchNameQuery.trim().toLowerCase();
    const nationalityQuery = this.dbSearchNationalityQuery;
    const positionQuery = this.dbSearchPositionQuery;
    const teamQuery = this.dbSearchTeamQuery;

    return this.dbBrowsePlayers.filter((player) => {
      const matchesName = !normalizedNameQuery
        || player.name.toLowerCase().includes(normalizedNameQuery)
        || player.hexId.toLowerCase().includes(normalizedNameQuery);

      const matchesNationality = nationalityQuery === null
        || player.nationalityId === nationalityQuery;

      const matchesPosition = positionQuery === null
        || player.position === positionQuery;

      const matchesTeam = teamQuery === null
        || player.clubs.includes(teamQuery);

      return matchesName && matchesNationality && matchesPosition && matchesTeam;
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

  openDbBrowsePlayer(index: number): void {
    this.openPlayerEditPopup(index);
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

  // ─── File loading ─────────────────────────────────────────────

  private async getDirectoryFileHandle(dirHandle: any, expectedNames: string[]): Promise<any> {
    for (const expectedName of expectedNames) {
      try {
        return await dirHandle.getFileHandle(expectedName);
      } catch {
        // Try the next casing variant.
      }
    }

    const normalizedExpectedNames = new Set(expectedNames.map((name) => name.toLowerCase()));

    if (typeof dirHandle.entries === 'function') {
      for await (const [entryName, entryHandle] of dirHandle.entries()) {
        if (entryHandle?.kind === 'file' && normalizedExpectedNames.has(entryName.toLowerCase())) {
          return entryHandle;
        }
      }
    }

    throw new Error(`File not found: ${expectedNames[0]}`);
  }

  async openFolder(): Promise<void> {
    if (!(window as any).showDirectoryPicker) {
      alert('Your browser does not support the Directory Picker API. Use Chrome.');
      return;
    }

    let dirHandle: any;
    try {
      dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        alert(err.message || 'Folder selection failed.');
      }
      return;
    }

    const errors: string[] = [];

    try {
      const handle = await this.getDirectoryFileHandle(dirHandle, ['PLAYERS.DAT', 'players.dat']);
      await this.playerService.loadFile(handle);
      this.applyPlayerFileLoaded();
    } catch (err: any) {
      errors.push(`PLAYERS.DAT: ${err.message || 'not found'}`);
    }

    try {
      const handle = await this.getDirectoryFileHandle(dirHandle, ['TEAMPLAYERLINKS_0.dat', 'TEAMPLAYERLINKS_0.DAT', 'teamplayerlinks_0.dat']);
      await this.teamEditorService.loadFile(handle);
      this.applyTeamFileLoaded();
    } catch (err: any) {
      errors.push(`TEAMPLAYERLINKS_0.dat: ${err.message || 'not found'}`);
    }

    try {
      const handle = await this.getDirectoryFileHandle(dirHandle, ['TEAMS.DAT', 'teams.dat']);
      await this.teamsDatService.loadFile(handle);
      this.applyTeamsDatLoaded();
    } catch (err: any) {
      errors.push(`TEAMS.DAT: ${err.message || 'not found'}`);
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    this.checkAutoTransition();
  }

  // ─── Save ─────────────────────────────────────────────────────

  clearTeamPlayerLinks(): void {
    if (!this.teamEditorService.hasData) {
      alert('Load TEAMPLAYERLINKS file first.');
      return;
    }

    if (!this.teamsDatService.hasData) {
      alert('Load TEAMS.DAT file first.');
      return;
    }

    if (!confirm('This will reset all team rosters: slots 0–17 set to players 0x0001..0x0012, slots 18–31 set to 0xFFFF, and all captain/set-piece roles cleared to 0xFFFFFFFF. Continue?')) {
      return;
    }

    this.teamEditorService.clearAllTeams(
      this.buildCleanStarterPositionsByTeamId(),
      this.buildCleanReservePositionsByPlayerId()
    );
    this.teamsDatService.resetAllTeamRoles(0xffffffff);
    this.loadSingleTeam(this.selectedTeamOffset);
  }

  async saveAllFiles(): Promise<void> {
    if (!this.allFilesLoaded) {
      alert('Load all files first.');
      return;
    }

    const syncedRoles = this.syncAllTeamsDatRolesWithCurrentRosters(true, true);

    if (syncedRoles > 0) {
      alert(`Synced captain/corner/penalty/free-kick roles for ${syncedRoles} teams across TEAMPLAYERLINKS and TEAMS.DAT (first active player receives all roles).`);
    }

    const normalizedSlots = this.teamEditorService.normalizeActiveSlotAttributes();

    if (normalizedSlots > 0) {
      alert(`Adjusted ${normalizedSlots} TEAMPLAYERLINKS slots to safe position/starter values before save.`);
    }

    const invalidPlayerRefs = this.teamEditorService.validatePlayerReferences(this.playerService.totalPlayers);

    if (invalidPlayerRefs.length > 0) {
      const previewRows = invalidPlayerRefs
        .slice(0, 8)
        .map((issue) => `${issue.teamLabel} | slot ${issue.slotIndex} | player ${issue.playerIdHex}`);
      const truncatedLabel = invalidPlayerRefs.length > previewRows.length
        ? `\n...and ${invalidPlayerRefs.length - previewRows.length} more invalid references.`
        : '';

      alert(
        'Save blocked: TEAMPLAYERLINKS contains player IDs missing from PLAYERS.DAT.\n\n'
        + previewRows.join('\n')
        + truncatedLabel
      );
      return;
    }

    try {
      await this.playerService.saveCurrentToSameFile();
      await this.teamEditorService.saveToSameFile();
      await this.teamsDatService.saveToSameFile();
      alert('Files overwritten successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed. Make sure you gave the browser permission to save changes.';
      alert(message);
    }
  }

  private syncAllTeamsDatRolesWithCurrentRosters(syncTeamPlayerLinks = false, forceFirstPlayerAllRoles = false): number {
    if (!this.teamEditorService.hasData || !this.teamsDatService.hasData) {
      return 0;
    }

    let syncedTeams = 0;

    this.teamEditorService.teamOptions.forEach(({ offset }) => {
      const team = this.teamEditorService.getTeam(offset);

      if (this.syncTeamsDatRolesForTeam(team, syncTeamPlayerLinks, forceFirstPlayerAllRoles)) {
        syncedTeams += 1;
      }
    });

    return syncedTeams;
  }

  private syncTeamsDatRolesForTeam(team: TeamRecord, syncTeamPlayerLinks = false, forceFirstPlayerAllRoles = false): boolean {
    if (!this.teamsDatService.hasData) {
      return false;
    }

    const CLEAR_ROLE_PLAYER_ID = 0xffffffff;
    const activeSlots = this.getActiveTeamSlots(team);
    const activePlayerIds = new Set(activeSlots.map((slot) => slot.playerId));
    const fallbackRolePlayerId = activeSlots[0]?.playerId ?? CLEAR_ROLE_PLAYER_ID;
    const record = this.teamsDatService.records.find((entry) => entry.teamId === team.teamId);

    if (!record) {
      return false;
    }

    const nextCaptainRole = forceFirstPlayerAllRoles
      ? fallbackRolePlayerId
      : this.resolveEffectiveRolePlayerId(team, record, 'captainRole');
    const nextLeftCornerRole = forceFirstPlayerAllRoles
      ? fallbackRolePlayerId
      : this.resolveEffectiveRolePlayerId(team, record, 'leftCornerRole');
    const nextRightCornerRole = forceFirstPlayerAllRoles
      ? fallbackRolePlayerId
      : this.resolveEffectiveRolePlayerId(team, record, 'rightCornerRole');
    const nextPenaltyRole = forceFirstPlayerAllRoles
      ? fallbackRolePlayerId
      : this.resolveEffectiveRolePlayerId(team, record, 'penaltyRole');
    const nextFreeKickRole = forceFirstPlayerAllRoles
      ? fallbackRolePlayerId
      : this.resolveEffectiveRolePlayerId(team, record, 'freeKickRole');

    let updated = false;

    if (
      nextCaptainRole !== record.captainRole
      || nextLeftCornerRole !== record.leftCornerRole
      || nextRightCornerRole !== record.rightCornerRole
      || nextPenaltyRole !== record.penaltyRole
      || nextFreeKickRole !== record.freeKickRole
    ) {
      this.teamsDatService.updateRecord(record.index, {
        captainRole: nextCaptainRole,
        leftCornerRole: nextLeftCornerRole,
        rightCornerRole: nextRightCornerRole,
        penaltyRole: nextPenaltyRole,
        freeKickRole: nextFreeKickRole
      });
      updated = true;
    }

    if (!syncTeamPlayerLinks) {
      return updated;
    }

    const rolePlayerIds: Record<TeamsRoleField, number> = {
      captainRole: activePlayerIds.has(nextCaptainRole) ? nextCaptainRole : fallbackRolePlayerId,
      leftCornerRole: activePlayerIds.has(nextLeftCornerRole) ? nextLeftCornerRole : fallbackRolePlayerId,
      rightCornerRole: activePlayerIds.has(nextRightCornerRole) ? nextRightCornerRole : fallbackRolePlayerId,
      penaltyRole: activePlayerIds.has(nextPenaltyRole) ? nextPenaltyRole : fallbackRolePlayerId,
      freeKickRole: activePlayerIds.has(nextFreeKickRole) ? nextFreeKickRole : fallbackRolePlayerId
    };

    const updatedTeam = this.applyRolesToTeamPlayerLinks(team, rolePlayerIds);
    return updated || updatedTeam !== team;
  }

  private getActiveTeamSlots(team: TeamRecord): TeamSlot[] {
    return team.slots
      .slice(0, Math.min(team.playerCount, team.slots.length))
      .filter((slot) => !slot.isEmpty);
  }

  private resolveEffectiveRolePlayerId(team: TeamRecord, record: TeamsDatRecord, field: TeamsRoleField): number {
    const CLEAR_ROLE_PLAYER_ID = 0xffffffff;
    const activeSlots = this.getActiveTeamSlots(team);
    const activePlayerIds = new Set(activeSlots.map((slot) => slot.playerId));
    const roleFromTeamPlayerLinks = this.getRolePlayerIdFromTeamPlayerLinks(team, field);

    if (roleFromTeamPlayerLinks !== null) {
      return roleFromTeamPlayerLinks;
    }

    const roleFromTeamsDat = record[field];

    if (activePlayerIds.has(roleFromTeamsDat)) {
      return roleFromTeamsDat;
    }

    return activeSlots[0]?.playerId ?? CLEAR_ROLE_PLAYER_ID;
  }

  private getRolePlayerIdFromTeamPlayerLinks(team: TeamRecord, field: TeamsRoleField): number | null {
    const roleSlot = this.getActiveTeamSlots(team).find((slot) => {
      switch (field) {
        case 'captainRole':
          return slot.isCaptain;
        case 'leftCornerRole':
          return slot.isLeftCornerTaker;
        case 'rightCornerRole':
          return slot.isRightCornerTaker;
        case 'penaltyRole':
          return slot.isPenaltyTaker;
        case 'freeKickRole':
          return slot.isFreeKickTaker;
      }
    });

    return roleSlot ? roleSlot.playerId : null;
  }

  private applyRolesToTeamPlayerLinks(team: TeamRecord, rolePlayerIds: Record<TeamsRoleField, number>): TeamRecord {
    const activeSlots = this.getActiveTeamSlots(team);
    let updatedTeam = team;
    let updated = false;

    activeSlots.forEach((slot) => {
      const shouldCaptain = slot.playerId === rolePlayerIds.captainRole;
      const shouldLeftCorner = slot.playerId === rolePlayerIds.leftCornerRole;
      const shouldRightCorner = slot.playerId === rolePlayerIds.rightCornerRole;
      const shouldPenalty = slot.playerId === rolePlayerIds.penaltyRole;
      const shouldFreeKick = slot.playerId === rolePlayerIds.freeKickRole;

      if (
        slot.isCaptain === shouldCaptain
        && slot.isLeftCornerTaker === shouldLeftCorner
        && slot.isRightCornerTaker === shouldRightCorner
        && slot.isPenaltyTaker === shouldPenalty
        && slot.isFreeKickTaker === shouldFreeKick
      ) {
        return;
      }

      updatedTeam = this.teamEditorService.updateSlot(team.offset, slot.index, {
        captain: shouldCaptain,
        leftCornerTaker: shouldLeftCorner,
        rightCornerTaker: shouldRightCorner,
        penaltyTaker: shouldPenalty,
        freeKickTaker: shouldFreeKick
      });
      updated = true;
    });

    return updated ? updatedTeam : team;
  }

  private setRoleForCurrentTeam(field: TeamsRoleField, playerId: number): void {
    const team = this.displayedTeams[0] ?? null;

    if (!team) {
      return;
    }

    const rolePlayerIds: Record<TeamsRoleField, number> = {
      captainRole: field === 'captainRole' ? playerId : (this.getRolePlayerIdFromTeamPlayerLinks(team, 'captainRole') ?? 0xffffffff),
      leftCornerRole: field === 'leftCornerRole' ? playerId : (this.getRolePlayerIdFromTeamPlayerLinks(team, 'leftCornerRole') ?? 0xffffffff),
      rightCornerRole: field === 'rightCornerRole' ? playerId : (this.getRolePlayerIdFromTeamPlayerLinks(team, 'rightCornerRole') ?? 0xffffffff),
      penaltyRole: field === 'penaltyRole' ? playerId : (this.getRolePlayerIdFromTeamPlayerLinks(team, 'penaltyRole') ?? 0xffffffff),
      freeKickRole: field === 'freeKickRole' ? playerId : (this.getRolePlayerIdFromTeamPlayerLinks(team, 'freeKickRole') ?? 0xffffffff)
    };

    const updatedTeam = this.applyRolesToTeamPlayerLinks(team, rolePlayerIds);

    if (updatedTeam !== team) {
      this.replaceDisplayedTeam(team.offset, updatedTeam);
    }
  }

  downloadTeamPlayerLinksUncompressed(): void {
    if (!this.teamFileLoaded) {
      alert('Load TEAMPLAYERLINKS file first.');
      return;
    }

    this.teamEditorService.exportUncompressedFile();
  }

  // ─── Team Editor ──────────────────────────────────────────────

  get filteredTeamAddPlayers(): DbBrowsePlayer[] {
    const normalizedQuery = this.teamAddSearchQuery.trim().toLowerCase();

    return this.dbBrowsePlayers
      .filter((player) => !normalizedQuery
        || player.name.toLowerCase().includes(normalizedQuery)
        || player.hexId.toLowerCase().includes(normalizedQuery))
      .slice(0, this.importSearchPageSize);
  }

  loadSingleTeam(offset: number | null): void {
    if (offset === null) {
      this.displayedTeams = [];
      this.rebuildRoleSelectOptions();
      return;
    }

    this.selectedTeamOffset = offset;
    this.displayedTeams = this.decorateTeamsWithPlayerNames([this.teamEditorService.getTeam(offset)]);
    this.rebuildRoleSelectOptions();

    // Sync teams.dat tactics section to the newly selected team
    if (this.teamsDatLoaded && this.displayedTeams.length > 0) {
      const team = this.displayedTeams[0];
      const idx = this.teamsDatService.records.findIndex((r) => r.teamId === team.teamId);
      this.selectedTeamsDatIndex = idx !== -1 ? idx : null;
    }
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

  toggleTeamAddPicker(team: TeamRecord): void {
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

  closeTeamAddPicker(): void {
    this.teamAddPickerOffset = null;
    this.teamAddSearchQuery = '';
    this.selectedTeamAddPlayerIndex = null;
  }

  openTeamPlayerEditPopup(team: TeamRecord, slotIndex: number): void {
    const slot = team.slots.find((s) => s.index === slotIndex);

    if (!slot || slot.isEmpty) {
      return;
    }

    this.openPlayerEditPopup(slot.playerId, { teamOffset: team.offset, slotIndex });
  }

  getFormationSketch(team: TeamRecord): FormationSketch {
    const activeSlots = team.slots
      .slice(0, Math.min(team.playerCount, team.slots.length))
      .filter((slot) => !slot.isEmpty);

    const starters = activeSlots.slice(0, 11);

    const resolvedFormation = this.resolveFormationForTeam(team);

    const sketch = resolvedFormation.formation
      ? this.buildFormationSketch(starters, resolvedFormation.formation)
      : this.buildFirstElevenSketch(starters);

    return {
      ...sketch,
      reservePlayers: activeSlots.slice(11).map((player) => this.toSketchPlayer(player)),
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
    field: 'teamId' | 'leagueId' | 'rivalId' | 'attackOvr' | 'midfieldOvr' | 'defenseOvr',
    value: string | number
  ): void {
    const changes: Partial<Pick<TeamsDatRecord,
      'teamId' | 'leagueId' | 'rivalId' | 'attackOvr' | 'midfieldOvr' | 'defenseOvr'
    >> = {};

    changes[field] = Number(value);
    this.teamsDatService.updateRecord(record.index, changes);

    if (field === 'teamId') {
      this.rebuildRivalOptions();
    }
  }

  updateTeamsDatFormation(record: TeamsDatRecord, value: string | number): void {
    this.teamsDatService.updateRecord(record.index, { formationId: Number(value) });
  }

  updateTeamsDatRegion(record: TeamsDatRecord, value: string): void {
    this.teamsDatService.updateRecord(record.index, { region: value });
  }

  updateTeamsDatStadiumName(record: TeamsDatRecord, value: string): void {
    this.teamsDatService.updateRecord(record.index, { stadiumName: value });
  }

  updateTeamsDatRoleField(
    record: TeamsDatRecord,
    field: TeamsRoleField,
    value: string | number
  ): void {
    const rawValue = typeof value === 'number' ? value.toString(16) : value;
    const parsedValue = Number.parseInt(rawValue.trim(), 16);

    if (Number.isNaN(parsedValue)) {
      return;
    }

    const changes: Partial<Pick<TeamsDatRecord,
      'captainRole' | 'leftCornerRole' | 'rightCornerRole' | 'penaltyRole' | 'freeKickRole'
    >> = {};

    this.setRoleForCurrentTeam(field, parsedValue);
    changes[field] = parsedValue;
    this.teamsDatService.updateRecord(record.index, changes);
  }

  formatHexRoleValue(value: number): string {
    return value.toString(16).toUpperCase().padStart(4, '0');
  }

  // ─── Tactics section helpers ────────────────────────────────

  // Stable list: rebuilt when displayedTeams changes; safe for use in *ngFor
  roleSelectOptions: { value: string; label: string }[] = [];

  private rebuildRoleSelectOptions(): void {
    const team = this.displayedTeams[0] ?? null;
    if (!team) {
      this.roleSelectOptions = [];
      return;
    }

    this.roleSelectOptions = team.slots
      .slice(0, Math.min(team.playerCount, team.slots.length))
      .filter((s) => s.playerId !== 0xffff)
      .map((s) => ({
        value: s.playerIdHex,
        label: `${s.playerIdHex}  ${s.playerName || s.playerIdHex}`
      }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }

  getFormationString(formationId: number): string {
    return FORMATION_VALUE_BY_ID[formationId] ?? `Unknown (ID ${formationId})`;
  }

  getRivalName(rivalId: number): string {
    const rival = this.teamsDatService.records.find((r) => r.teamId === rivalId);
    return rival ? rival.teamLabel : `Team ${rivalId}`;
  }

  // ─── Pitch player selection / swap ───────────────────────────

  selectTeamPlayerForAction(team: TeamRecord, formationSketch: FormationSketch, slotIndex: number): void {
    if (this.swapModeActive && this.selectedTeamEditorOffset === team.offset && this.selectedTeamEditorSlotIndex !== null) {
      if (this.selectedTeamEditorSlotIndex !== slotIndex) {
        this.swapFormationPlayers(team, formationSketch, this.selectedTeamEditorSlotIndex, slotIndex);
      } else {
        this.clearTeamPlayerSelection();
      }
      return;
    }

    if (this.selectedTeamEditorOffset === team.offset && this.selectedTeamEditorSlotIndex === slotIndex && !this.swapModeActive) {
      this.clearTeamPlayerSelection();
      return;
    }

    this.selectedTeamEditorOffset = team.offset;
    this.selectedTeamEditorSlotIndex = slotIndex;
    this.swapModeActive = false;
  }

  isTeamPlayerSelected(team: TeamRecord, slotIndex: number): boolean {
    return this.selectedTeamEditorOffset === team.offset && this.selectedTeamEditorSlotIndex === slotIndex;
  }

  getSelectedFormationPlayer(team: TeamRecord, formationSketch: FormationSketch): FormationSketchPlayer | null {
    if (this.selectedTeamEditorOffset !== team.offset || this.selectedTeamEditorSlotIndex === null) {
      return null;
    }

    const allPlayers = [
      ...formationSketch.slots.map((s) => s.player).filter((p): p is FormationSketchPlayer => Boolean(p)),
      ...formationSketch.reservePlayers
    ];

    return allPlayers.find((p) => p.slotIndex === this.selectedTeamEditorSlotIndex) ?? null;
  }

  clearTeamPlayerSelection(): void {
    this.selectedTeamEditorOffset = null;
    this.selectedTeamEditorSlotIndex = null;
    this.swapModeActive = false;
  }

  activateSwapMode(): void {
    this.swapModeActive = true;
  }

  cancelSwapMode(): void {
    this.swapModeActive = false;
  }

  openSelectedTeamPlayer(team: TeamRecord): void {
    if (this.selectedTeamEditorOffset !== team.offset || this.selectedTeamEditorSlotIndex === null) {
      return;
    }

    const slotIndex = this.selectedTeamEditorSlotIndex;
    this.clearTeamPlayerSelection();
    this.openTeamPlayerEditPopup(team, slotIndex);
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
      this.clearTeamPlayerSelection();
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
    this.clearTeamPlayerSelection();
  }

  trackSketchPlayer(_: number, player: FormationSketchPlayer): number {
    return player.slotIndex;
  }

  trackSketchSlot(_: number, slot: FormationSketchSlot): string {
    return slot.slotKey;
  }

  // ─── Helpers ──────────────────────────────────────────────────

  getNationalityLabel(nationalityId: number): string {
    const nationalityName = NATIONALITY_NAMES_BY_ID[nationalityId];
    return nationalityName ? `${nationalityName} (${nationalityId})` : `Unknown (${nationalityId})`;
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

    this.checkAutoTransition();
  }

  private applyPlayerFileLoaded(): void {
    this.teamPlayerNameCache.clear();
    this.refreshDbBrowsePlayers();
    this.displayedTeams = this.decorateTeamsWithPlayerNames(this.displayedTeams);
    this.rebuildRoleSelectOptions();
  }

  private applyTeamFileLoaded(): void {
    this.refreshDbBrowsePlayers();
    this.selectedTeamOffset = this.teamOptions.length > 0 ? this.teamOptions[0].offset : null;
    this.displayedTeams = this.selectedTeamOffset === null
      ? []
      : this.decorateTeamsWithPlayerNames([this.teamEditorService.getTeam(this.selectedTeamOffset)]);
    this.rebuildRoleSelectOptions();
  }

  private applyTeamsDatLoaded(): void {
    this.selectedTeamsDatIndex = this.teamsDatService.teamCount > 0 ? 0 : null;
    this.rebuildRivalOptions();
  }

  private replaceDisplayedTeam(offset: number, updatedTeam: TeamRecord): void {
    this.syncTeamsDatRolesForTeam(updatedTeam);

    const decoratedTeam = this.decorateTeamWithPlayerNames(updatedTeam);
    this.displayedTeams = this.displayedTeams.map((team) => team.offset === offset ? decoratedTeam : team);
    this.rebuildRoleSelectOptions();
    this.refreshDbBrowsePlayers();

    if (this.selectedTeamOffset === offset && !this.displayedTeams.some((team) => team.offset === offset)) {
      this.displayedTeams = [decoratedTeam];
      this.rebuildRoleSelectOptions();
    }
  }

  private refreshPlayerLinkedViews(playerIndex: number): void {
    this.teamPlayerNameCache.delete(playerIndex);

    if (this.displayedTeams.length > 0) {
      this.displayedTeams = this.decorateTeamsWithPlayerNames(this.displayedTeams);
      this.rebuildRoleSelectOptions();
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
    if (!this.fileLoaded || slot.playerId === 0xffff) {
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

  private buildCleanStarterPositionsByTeamId(): Map<number, readonly number[]> {
    const positionsByTeamId = new Map<number, readonly number[]>();

    const defaultFormation = this.getFormationFromId(0) ?? this.formations[0];
    const defaultStarterPositions = this.getStarterPositionsFromFormation(defaultFormation);

    if (!this.teamsDatService.hasData) {
      return positionsByTeamId;
    }

    this.teamsDatService.records.forEach((record) => {
      const formation = this.getFormationFromId(record.formationId) ?? defaultFormation;
      const starterPositions = this.getStarterPositionsFromFormation(formation);
      positionsByTeamId.set(record.teamId, starterPositions.length > 0 ? starterPositions : defaultStarterPositions);
    });

    return positionsByTeamId;
  }

  private getStarterPositionsFromFormation(formation: FormationPreset): number[] {
    const starterPositions = [0];

    formation.lines.forEach((line) => {
      line.slots.forEach((slot) => {
        starterPositions.push(slot.positions[0] ?? 0);
      });
    });

    return starterPositions.slice(0, 11);
  }

  private buildCleanReservePositionsByPlayerId(): Map<number, number> {
    const reservePositionsByPlayerId = new Map<number, number>();

    if (!this.fileLoaded) {
      return reservePositionsByPlayerId;
    }

    for (let playerId = 1; playerId <= 18; playerId += 1) {
      if (playerId >= this.playerService.totalPlayers) {
        continue;
      }

      const player = this.playerService.readPlayer(playerId);
      reservePositionsByPlayerId.set(playerId, Number.isFinite(player.pos) ? player.pos : 0);
    }

    return reservePositionsByPlayerId;
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

        // Keep lineup selection stable: existing lower slot indexes win ties.
        if (left.player.index !== right.player.index) {
          return left.player.index - right.player.index;
        }

        if (left.player.shirtNumber !== right.player.shirtNumber) {
          return left.player.shirtNumber - right.player.shirtNumber;
        }

        return 0;
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
    const rawPlayer = this.fileLoaded ? this.playerService.readPlayer(player.playerId) : null;
    return {
      slotIndex: player.index,
      playerIdHex: player.playerIdHex,
      playerName: player.playerName,
      shirtNumber: player.shirtNumber,
      position: player.position,
      positionLabel: this.getPositionLabel(player.position),
      ovr: rawPlayer ? this.playerService.calculateOVR(rawPlayer) : 0
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

  private emptyPlayer(): Player {
    return {
      name: '', pos: 0, foot: 0, nat: 0, estatura: 0, peso: 0,
      hiddenFromTransferMarket: 0, isIconLegend: 0,
      birthDay: 0, birthMonth: 0, year: 0,
      skin: 0, skin_tone: 255, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 255, guantes: 5,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };
  }
}
