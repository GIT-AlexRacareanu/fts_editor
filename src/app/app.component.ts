import { ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FORMATION_PRESETS, FormationPreset } from './data/formations';
import { NATIONALITY_NAMES_BY_ID, NATIONALITY_OPTIONS } from './data/nationalities';
import { Player } from './models/player.model';
import { TeamRecord, TeamSlot } from './models/team-editor.model';
import { TeamsDatKit, TeamsDatKitColor, TeamsDatRecord } from './models/teams-dat.model';
import { XlcLocaleValue } from './models/xlc-editor.model';
import { FileHandleStorageService } from './services/file-handle-storage.service';
import { ImportedPlayerRecord, PlayerImportService } from './services/player-import.service';
import { PakEditorService, PakEntry } from './services/pak-editor.service';
import { PlayerService } from './services/player.service';
import { TeamEditorService } from './services/team-editor.service';
import { TeamsDatService } from './services/teams-dat.service';
import { XlcEditorService } from './services/xlc-editor.service';

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

interface TeamBrowseItem {
  index: number;
  teamId: number;
  teamLabel: string;
  leagueId: number;
  rivalId: number;
  stadiumName: string;
  europeanCompetition: number;
  overallOvr: number;
}

interface PopupTeamContext {
  teamOffset: number;
  slotIndex: number;
}

interface TeamImportMappedPreviewItem {
  shortName: string;
  futureIndex: number;
  futureHexId: string;
  positionLabel: string;
  ovr: number;
}

interface TeamImportResolvedPlayer {
  shortName: string;
  playerIndex: number;
  position: number;
  shirtNumber: number;
  futureHexId: string;
  positionLabel: string;
  ovr: number;
  sourceOrder: number;
}

type TeamsRoleField = 'captainRole' | 'leftCornerRole' | 'rightCornerRole' | 'penaltyRole' | 'freeKickRole';

interface ColorChannelOption {
  readonly index: 0 | 1 | 2;
  readonly label: string;
  readonly shortLabel: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('popupNameInput') popupNameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('teamLogoFileInput') teamLogoFileInput?: ElementRef<HTMLInputElement>;

  private readonly importAssetUrl = 'assets/import/import_2.csv';
  private readonly backupPlayersAssetUrl = 'assets/backup/players.dat';
  private readonly backupTeamPlayerLinksAssetUrl = 'assets/backup/teamplayerlinks_0.dat';
  private readonly backupTeamsDatAssetUrl = 'assets/backup/teams.dat';
  private readonly backupXlcAssetUrl = 'assets/backup/ftsteamnames.xlc';
  private readonly folderHandleStorageKey = 'fts-editor-folder';
  private readonly bulkImportDummyPlayerCount = 18;
  private readonly teamLongNamePrefix = 'TXT_TEAMNAMELONG_';
  private readonly teamMediumNamePrefix = 'TXT_TEAMNAMEMED_';
  private readonly teamShortNamePrefix = 'TXT_TEAMNAMESHORT_';
  private runtimeDebugHandlersRegistered = false;

  // ─── App flow ────────────────────────────────────────────────
  showInitPage = true;
  showEconomyEditor = false;
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

  // ─── Import ──────────────────────────────────────────────────
  importedPlayers: ImportedPlayerRecord[] = [];
  importSourceFileName = '';
  showImportPicker = false;
  importSearchQuery = '';
  importStatusMessage = '';
  isBulkImporting = false;
  selectedImportedPlayer: ImportedPlayerRecord | null = null;

  // ─── Team Import ─────────────────────────────────────────────
  teamImportCsvTeam: string | null = null;
  teamImportCsvTeamSearch = '';
  isTeamImporting = false;
  teamImportStatusMessage = '';
  teamImportPreviewPlayersCache: ImportedPlayerRecord[] = [];
  teamImportMappedPreviewCache: TeamImportMappedPreviewItem[] = [];

  // ─── PAK ─────────────────────────────────────────────────────
  pakFileName = '';
  pakStatusMessage = '';
  pendingTeamLogoImportTeamId: number | null = null;

  // ─── DB Browser ──────────────────────────────────────────────
  dbSearchNameQuery = '';
  dbSearchNationalityQuery: number | null = null;
  dbSearchPositionQuery: number | null = null;
  dbSearchTeamQuery: string | null = null;
  dbBrowsePage = 1;
  dbBrowsePlayers: DbBrowsePlayer[] = [];
  teamBrowseLeagueQuery: number | null = null;
  teamBrowsePage = 1;

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
  showTeamKitDialog = false;
  teamKitDialogRecordIndex: number | null = null;
  teamKitDialogTabIndex = 0;
  showTeamStadiumDialog = false;
  teamStadiumDialogRecordIndex: number | null = null;

  // ─── XLC Names ───────────────────────────────────────────────
  xlcFileName = '';
  xlcStatusMessage = '';

  // ─── Shared ──────────────────────────────────────────────────
  private readonly teamPlayerNameCache = new Map<number, string | null>();
  private readonly formationSketchCache = new WeakMap<TeamRecord, FormationSketch>();
  private readonly pakPreviewUrlCache = new Map<string, SafeUrl>();
  private readonly pakPreviewObjectUrlCache = new Map<string, string>();
  private readonly dbBrowsePageSize = 25;
  private readonly teamBrowsePageSize = 25;
  private readonly importSearchPageSize = 50;
  private readonly importSearchMinLength = 3;
  private readonly liveTextSearchMinLength = 3;

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
  readonly colorChannels: ColorChannelOption[] = [
    { index: 0, label: 'Red', shortLabel: 'R' },
    { index: 1, label: 'Green', shortLabel: 'G' },
    { index: 2, label: 'Blue', shortLabel: 'B' }
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
    { value: 0, label: 'Left' }, { value: 1, label: 'Right' }, { value: 255, label: 'Default/Both' }
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
    { value: 10, label: 'asian nations' },
    { value: 11, label: 'south american nations' },
    { value: 12, label: 'north american nations' },
    { value: 13, label: 'african nations' },
    { value: 14, label: 'rest of europe' },
    { value: 15, label: 'rest of asia' },
    { value: 16, label: 'rest of america' },
    { value: 17, label: 'classic teams' },
    { value: 18, label: 'england 3' },
    { value: 19, label: 'france 2' },
    { value: 20, label: 'italy 2' },
    { value: 21, label: 'germany 2' },
    { value: 22, label: 'spain 2' },
    { value: 23, label: 'scottish 2' },
    { value: 24, label: 'netherlands' },
    { value: 25, label: 'netherlands 2' },
    { value: 26, label: 'jap 2' }
  ];

  readonly teamBrowseUclFilterValue = -2;
  readonly teamBrowseUelFilterValue = -3;
  readonly teamBrowseLeagueOptions = [
    { value: this.teamBrowseUclFilterValue, label: 'UCL' },
    { value: this.teamBrowseUelFilterValue, label: 'UEL' },
    ...this.leagueOptions
  ];

  readonly nationalities = NATIONALITY_OPTIONS;
  readonly kitStyleOptions = this.teamsDatService.kitStyleOptions;
  readonly sponsorTypeOptions = this.teamsDatService.sponsorTypeOptions;
  readonly europeanCompetitionOptions = this.teamsDatService.europeanCompetitionOptions;
  readonly stadiumNameMaxLength = this.teamsDatService.stadiumNameMaxLength;

  constructor(
    private readonly ngZone: NgZone,
    private readonly changeDetectorRef: ChangeDetectorRef,
    public playerService: PlayerService,
    public playerImportService: PlayerImportService,
    public pakEditorService: PakEditorService,
    public teamEditorService: TeamEditorService,
    public teamsDatService: TeamsDatService,
    public xlcEditorService: XlcEditorService,
    private readonly domSanitizer: DomSanitizer,
    private readonly fileHandleStorage: FileHandleStorageService
  ) {}

  ngOnInit(): void {
    this.registerRuntimeDebugHandlers();
    void this.initializeApp();
  }

  ngOnDestroy(): void {
    this.clearPakPreviewCache();
  }

  // ─── App flow ─────────────────────────────────────────────────

  get allFilesLoaded(): boolean {
    return this.fileLoaded && this.teamFileLoaded && this.teamsDatLoaded && this.pakLoaded;
  }

  get canEnterEditor(): boolean {
    return this.allFilesLoaded;
  }

  enterMainApp(): void {
    console.log('[InitLoad] enterMainApp() called. allFilesLoaded:', this.allFilesLoaded, 'showInitPage before:', this.showInitPage);
    this.runInAngular(() => {
      this.showInitPage = false;
    });
    console.log('[InitLoad] enterMainApp() completed. showInitPage now:', this.showInitPage);
  }

  goToInitPage(): void {
    this.runInAngular(() => {
      this.showInitPage = true;
    });
  }

  openEconomyEditor(): void {
    this.runInAngular(() => {
      this.showEconomyEditor = true;
    });
  }

  closeEconomyEditor(): void {
    this.runInAngular(() => {
      this.showEconomyEditor = false;
    });
  }

  private checkAutoTransition(): void {
    console.log('[InitLoad] checkAutoTransition() called. canEnterEditor:', this.canEnterEditor, 'showInitPage before:', this.showInitPage);
    if (this.canEnterEditor) {
      this.runInAngular(() => {
        this.showInitPage = false;
      });
      console.log('[InitLoad] auto-transitioned to main editor. showInitPage now:', this.showInitPage);
    }
  }

  private runInAngular(action: () => void): void {
    if (NgZone.isInAngularZone()) {
      action();
    } else {
      this.ngZone.run(action);
    }

    this.changeDetectorRef.detectChanges();
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

  get xlcLoaded(): boolean {
    return this.xlcEditorService.hasData;
  }

  get pakLoaded(): boolean {
    return this.pakEditorService.hasData;
  }

  getTeamLogoEntry(teamId: number, variant: 'main' | 'thumb' = 'main'): PakEntry | null {
    return this.pakEditorService.getTeamLogoEntry(teamId, variant);
  }

  getPakEntryPreviewUrl(entry: PakEntry): SafeUrl | null {
    if (!/\.(png|jpg|jpeg|webp|gif)$/i.test(entry.name)) {
      return null;
    }

    const cachedUrl = this.pakPreviewUrlCache.get(entry.path);

    if (cachedUrl) {
      return cachedUrl;
    }

    try {
      const bytes = this.pakEditorService.extractEntry(entry);
      const blob = new Blob([bytes], { type: this.getPakImageMimeType(entry.name) });
      const objectUrl = URL.createObjectURL(blob);
      const safeUrl = this.domSanitizer.bypassSecurityTrustUrl(objectUrl);
      this.pakPreviewObjectUrlCache.set(entry.path, objectUrl);
      this.pakPreviewUrlCache.set(entry.path, safeUrl);
      return safeUrl;
    } catch (error) {
      console.error('[Pak] failed to build preview URL for entry:', entry.path, error);
      return null;
    }
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
      return {
        ...baseRecord,
        teamLabel: this.getTeamDisplayLabel(baseRecord.teamId)
      };
    }

    return {
      ...baseRecord,
      teamLabel: selectedTeam?.teamLabel ?? this.getTeamDisplayLabel(baseRecord.teamId),
      captainRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'captainRole'),
      leftCornerRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'leftCornerRole'),
      rightCornerRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'rightCornerRole'),
      penaltyRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'penaltyRole'),
      freeKickRole: this.resolveEffectiveRolePlayerId(selectedTeam, baseRecord, 'freeKickRole')
    };
  }

  get activeTeamKitRecord(): TeamsDatRecord | null {
    if (!this.teamsDatLoaded || this.teamKitDialogRecordIndex === null) {
      return null;
    }

    const record = this.teamsDatService.records[this.teamKitDialogRecordIndex] ?? null;

    return record
      ? { ...record, teamLabel: this.getTeamDisplayLabel(record.teamId) }
      : null;
  }

  get activeTeamStadiumRecord(): TeamsDatRecord | null {
    if (!this.teamsDatLoaded || this.teamStadiumDialogRecordIndex === null) {
      return null;
    }

    const record = this.teamsDatService.records[this.teamStadiumDialogRecordIndex] ?? null;

    return record
      ? { ...record, teamLabel: this.getTeamDisplayLabel(record.teamId) }
      : null;
  }

  get teamsDatOptions(): { value: number; label: string }[] {
    return this.teamsDatService.teamOptions;
  }

  teamOptions: { label: string; offset: number }[] = [];
  teamBrowseItems: TeamBrowseItem[] = [];
  private filteredTeamBrowseItemsCache: TeamBrowseItem[] = [];
  private dbBrowsePlayersDirty = true;
  private teamBrowseItemsDirty = true;

  // Stable list: rebuilt only when teams.dat data changes
  rivalOptions: { value: number; label: string }[] = [];

  private rebuildTeamOptions(): void {
    this.teamOptions = this.teamEditorService.teamOptions.map((option) => {
      const teamId = this.teamEditorService.getTeam(option.offset).teamId;

      return {
        offset: option.offset,
        label: this.getTeamLongSelectLabel(teamId)
      };
    });
  }

  private rebuildRivalOptions(): void {
    this.rivalOptions = this.teamsDatService.records.map((r) => ({ value: r.teamId, label: this.getTeamSelectLabel(r.teamId) }));
  }

  private rebuildTeamBrowseItems(): void {
    if (!this.teamsDatLoaded) {
      this.teamBrowseItems = [];
      this.filteredTeamBrowseItemsCache = [];
      this.teamBrowsePage = 1;
      this.teamBrowseItemsDirty = false;
      return;
    }

    const teamsById = new Map<number, TeamRecord>();

    if (this.teamFileLoaded) {
      this.teamEditorService.teamOptions.forEach(({ offset }) => {
        const team = this.teamEditorService.getTeam(offset);
        teamsById.set(team.teamId, team);
      });
    }

    this.teamBrowseItems = this.teamsDatService.records
      .map((record) => ({
        index: record.index,
        teamId: record.teamId,
        teamLabel: this.getTeamLongDisplayLabel(record.teamId),
        leagueId: record.leagueId,
        rivalId: record.rivalId,
        stadiumName: record.stadiumName,
        europeanCompetition: record.europeanCompetition,
        overallOvr: this.getTeamBrowseOverall(teamsById.get(record.teamId))
      }))
      .sort((left, right) => {
        if (right.overallOvr !== left.overallOvr) {
          return right.overallOvr - left.overallOvr;
        }

        return left.teamLabel.localeCompare(right.teamLabel);
      });

    this.teamBrowseItemsDirty = false;
    this.refreshFilteredTeamBrowseItems();
  }

  private getTeamBrowseOverall(team: TeamRecord | undefined): number {
    if (!team || !this.fileLoaded) {
      return 0;
    }
    const players = this.getActiveTeamSlots(team).slice(0, 18);

    if (players.length === 0) {
      return 0;
    }

    let totalOvr = 0;

    players.forEach((slot) => {
      totalOvr += this.playerService.calculateOVR(this.playerService.readPlayer(slot.playerId));
    });

    return Math.round(totalOvr / players.length);
  }

  private refreshFilteredTeamBrowseItems(): void {
    this.ensureTeamBrowseItems();

    const leagueQuery = this.teamBrowseLeagueQuery;

    this.filteredTeamBrowseItemsCache = leagueQuery === null
      ? this.teamBrowseItems
      : leagueQuery === this.teamBrowseUclFilterValue
        ? this.teamBrowseItems.filter((record) => record.europeanCompetition === 1)
        : leagueQuery === this.teamBrowseUelFilterValue
          ? this.teamBrowseItems.filter((record) => record.europeanCompetition === 2)
          : this.teamBrowseItems.filter((record) => record.leagueId === leagueQuery);

    this.teamBrowsePage = Math.min(this.teamBrowsePage, this.teamBrowseTotalPages);
  }

  onTeamBrowseLeagueQueryChange(value: number | null): void {
    this.teamBrowseLeagueQuery = value;
    this.teamBrowsePage = 1;
    this.refreshFilteredTeamBrowseItems();
  }

  // ─── Player Edit Popup ────────────────────────────────────────

  get currentPopupHexId(): string {
    return this.playerService.formatPlayerId(this.popupPlayerIndex);
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

  get popupImportedHeadshotUrl(): string | null {
    return this.resolveImportedHeadshotUrl(this.getImportedPlayerForPopup()?.headshot);
  }

  openPlayerEditPopup(index: number, teamContext: PopupTeamContext | null = null): void {
    this.popupPlayerIndex = index;
    this.popupPlayer = this.playerService.readPlayer(index);
    this.popupPlayerHexQuery = this.currentPopupHexId;
    this.popupSearchQuery = '';
    this.popupTeamContext = teamContext;
    this.selectedImportedPlayer = null;
    this.showImportPicker = false;
    this.importSearchQuery = '';
    this.importStatusMessage = '';
    this.updatePopupOVR();
    this.showPlayerEditPopup = true;
  }

  closePlayerEditPopup(): void {
    this.showPlayerEditPopup = false;
    this.popupTeamContext = null;
    this.selectedImportedPlayer = null;
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
    const currentPosition = this.popupPlayer.pos;
    const importedPlayer = this.playerImportService.mapImportedPlayer(record, this.popupPlayer);

    this.popupPlayer = {
      ...importedPlayer,
      pos: currentPosition
    };
    this.selectedImportedPlayer = record;
    this.updatePopupOVR();
    this.importSearchQuery = '';
    this.showImportPicker = false;
    this.importStatusMessage = `Imported ${record.shortName} into player ${this.currentPopupHexId}.`;
    this.focusPopupNameField();
  }

  get canSearchImportedPlayers(): boolean {
    return this.importSearchQuery.trim().length >= this.importSearchMinLength;
  }

  get canSearchCsvTeams(): boolean {
    return this.teamImportCsvTeamSearch.trim().length >= this.liveTextSearchMinLength;
  }

  get canSearchTeamAddPlayers(): boolean {
    return this.teamAddSearchQuery.trim().length >= this.liveTextSearchMinLength;
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
      this.refreshTeamImportPreview();

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
    if (q.length < this.liveTextSearchMinLength) {
      return [];
    }

    return this.csvTeamOptions.filter((t) => t.toLowerCase().includes(q));
  }

  get teamImportPreviewPlayers(): ImportedPlayerRecord[] {
    return this.teamImportPreviewPlayersCache;
  }

  get teamImportCsvPreviewPlayers(): ImportedPlayerRecord[] {
    return this.teamImportPreviewPlayers.slice(0, 32);
  }

  private getResolvedTeamImportPlayers(): Array<{
    shortName: string;
    playerIndex: number;
    position: number;
    shirtNumber: number;
    futureHexId: string;
    positionLabel: string;
    ovr: number;
    sourceOrder: number;
  }> {
    if (!this.teamImportCsvTeam || !this.fileLoaded) {
      return [];
    }

    const csvPlayers = this.playerImportService.filterByTeam(this.importedPlayers, this.teamImportCsvTeam).slice(0, 32);

    const resolvedPlayers = csvPlayers
      .map((sourcePlayer) => {
        const playerIndex = this.resolveImportedTeamPlayerIndex(sourcePlayer);

        if (playerIndex < 0) {
          return null;
        }

        const currentPlayer = this.playerService.readPlayer(playerIndex);
        const mapped = this.playerImportService.mapImportedPlayer(sourcePlayer, currentPlayer, { includeYear: false });

        return {
          shortName: sourcePlayer.shortName,
          playerIndex,
          position: mapped.pos,
          shirtNumber: sourcePlayer.jerseyNumber ?? 0,
          futureHexId: this.playerService.formatPlayerId(playerIndex),
          positionLabel: this.getPositionLabel(mapped.pos),
          ovr: this.playerService.calculateOVR(mapped),
          sourceOrder: sourcePlayer.sourceRowIndex ?? Number.MAX_SAFE_INTEGER
        };
      })
      .filter((player): player is TeamImportResolvedPlayer => player !== null);

    if (this.selectedTeamOffset === null) {
      return resolvedPlayers;
    }

    return this.orderImportedPlayersForFormation(resolvedPlayers, this.selectedTeamOffset);
  }

  private resolveImportedTeamPlayerIndex(sourcePlayer: ImportedPlayerRecord): number {
    return this.resolveImportedPlayerIndexFromCsvRow(sourcePlayer);
  }

  private resolveImportedPlayerIndexFromCsvRow(sourcePlayer: ImportedPlayerRecord): number {
    if (!this.fileLoaded || !this.hasBulkImportedPlayerLayout()) {
      return -1;
    }

    const importOrderIndex = this.getImportedPlayersInCsvOrder().indexOf(sourcePlayer);

    if (importOrderIndex < 0) {
      return -1;
    }

    const playerIndex = this.bulkImportDummyPlayerCount + importOrderIndex;
    return playerIndex < this.playerService.totalPlayers ? playerIndex : -1;
  }

  private hasBulkImportedPlayerLayout(): boolean {
    if (!this.fileLoaded || this.playerService.totalPlayers < this.bulkImportDummyPlayerCount) {
      return false;
    }

    for (let index = 0; index < this.bulkImportDummyPlayerCount; index += 1) {
      const playerName = this.playerService.readPlayer(index).name;

      if (playerName !== `dummy${index + 1}`) {
        return false;
      }
    }

    return true;
  }

  private getImportedPlayersInCsvOrder(): ImportedPlayerRecord[] {
    return [...this.importedPlayers].sort((left, right) => {
      const leftRow = left.sourceRowIndex ?? Number.MAX_SAFE_INTEGER;
      const rightRow = right.sourceRowIndex ?? Number.MAX_SAFE_INTEGER;

      if (leftRow !== rightRow) {
        return leftRow - rightRow;
      }

      return left.shortName.localeCompare(right.shortName);
    });
  }

  private getImportedPlayerForPopup(): ImportedPlayerRecord | null {
    if (this.importSourceLoaded) {
      const sourcePlayers = this.getImportedPlayersInCsvOrder();
      const sourcePlayerIndex = this.popupPlayerIndex - this.bulkImportDummyPlayerCount;
      const playerFromRowOrder = sourcePlayerIndex >= 0 ? (sourcePlayers[sourcePlayerIndex] ?? null) : null;

      if (playerFromRowOrder) {
        return playerFromRowOrder;
      }
    }

    return this.selectedImportedPlayer;
  }

  private getImportedPlayerNameCandidates(sourcePlayer: ImportedPlayerRecord): string[] {
    const candidates = new Set<string>();
    const shortName = sourcePlayer.shortName.trim();
    const lastName = (sourcePlayer.lastName ?? '').trim();

    if (shortName) {
      candidates.add(shortName);
    }

    if (lastName) {
      candidates.add(lastName);
    }

    if (shortName && lastName) {
      candidates.add(`${shortName} ${lastName}`);
    }

    return Array.from(candidates);
  }

  private orderImportedPlayersForFormation(
    players: TeamImportResolvedPlayer[],
    teamOffset: number
  ): TeamImportResolvedPlayer[] {
    const formation = this.resolveFormationForImport(teamOffset);

    if (!formation) {
      return [...players].sort((left, right) => {
        if (right.ovr !== left.ovr) {
          return right.ovr - left.ovr;
        }

        return left.sourceOrder - right.sourceOrder;
      });
    }

    const remainingPlayers = [...players];
    const orderedPlayers: TeamImportResolvedPlayer[] = [];

    for (const targetPosition of this.getStarterPositionsFromFormation(formation)) {
      const match = this.pickBestImportedPlayerForSlot(remainingPlayers, targetPosition);

      if (!match) {
        continue;
      }

      orderedPlayers.push({
        ...match,
        position: targetPosition,
        positionLabel: this.getPositionLabel(targetPosition)
      });
      this.removeImportedPlayerChoice(remainingPlayers, match);
    }

    remainingPlayers.sort((left, right) => {
      if (right.ovr !== left.ovr) {
        return right.ovr - left.ovr;
      }

      return left.sourceOrder - right.sourceOrder;
    });

    return [...orderedPlayers, ...remainingPlayers].slice(0, 32);
  }

  private resolveFormationForImport(teamOffset: number): FormationPreset | undefined {
    if (!this.teamFileLoaded) {
      return undefined;
    }

    const loadedTeam = this.displayedTeams.find((team) => team.offset === teamOffset)
      ?? this.teamEditorService.getTeam(teamOffset);

    return this.resolveFormationForTeam(loadedTeam).formation;
  }

  private pickBestImportedPlayerForSlot(
    players: TeamImportResolvedPlayer[],
    targetPosition: number
  ): TeamImportResolvedPlayer | undefined {
    const compatiblePositions = this.getCompatibleImportPositions(targetPosition);

    return [...players]
      .filter((player) => compatiblePositions.includes(player.position))
      .sort((left, right) => {
        const leftRank = compatiblePositions.indexOf(left.position);
        const rightRank = compatiblePositions.indexOf(right.position);

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        if (right.ovr !== left.ovr) {
          return right.ovr - left.ovr;
        }

        return left.sourceOrder - right.sourceOrder;
      })[0];
  }

  private getCompatibleImportPositions(targetPosition: number): number[] {
    switch (targetPosition) {
      case 0:
        return [0];
      case 1:
        return [1, 3, 5, 17];
      case 2:
        return [2, 4, 7, 16];
      case 5:
        return [5, 6, 3, 1, 10, 8];
      case 6:
        return [6, 5, 7, 8, 10, 9];
      case 7:
        return [7, 6, 4, 2, 9, 8];
      case 8:
        return [8, 10, 9, 11, 12, 13, 14, 15];
      case 9:
        return [9, 8, 13, 16, 15, 21];
      case 10:
        return [10, 8, 12, 17, 14, 20];
      case 11:
        return [11, 12, 13, 8, 10, 9, 18, 22];
      case 12:
        return [12, 11, 14, 10, 8, 20, 18];
      case 13:
        return [13, 11, 15, 9, 8, 21, 18];
      case 14:
        return [14, 17, 20, 18, 12, 11, 15, 16, 21, 22, 19];
      case 15:
        return [15, 16, 21, 18, 13, 11, 14, 17, 20, 22, 19];
      case 16:
        return [16, 21, 15, 13, 18, 22, 19, 2, 7];
      case 17:
        return [17, 20, 14, 12, 18, 22, 19, 1, 5];
      case 18:
        return [18, 22, 14, 15, 11, 12, 13, 19];
      case 19:
        return [19, 22, 18, 14, 15, 20, 21];
      case 20:
        return [20, 17, 14, 18, 22, 19, 12, 1];
      case 21:
        return [21, 16, 15, 18, 22, 19, 13, 2];
      case 22:
        return [22, 18, 19, 14, 15, 11, 12, 13];
      default:
        return [targetPosition];
    }
  }

  private removeImportedPlayerChoice(players: TeamImportResolvedPlayer[], chosenPlayer: TeamImportResolvedPlayer): void {
    for (let index = players.length - 1; index >= 0; index--) {
      const player = players[index];

      if (player === chosenPlayer) {
        players.splice(index, 1);
        return;
      }

      if (player.playerIndex === chosenPlayer.playerIndex && player.sourceOrder === chosenPlayer.sourceOrder) {
        players.splice(index, 1);
        return;
      }
    }
  }

  get teamImportMappedPreview(): TeamImportMappedPreviewItem[] {
    return this.teamImportMappedPreviewCache;
  }

  selectCsvImportTeam(teamName: string): void {
    this.teamImportCsvTeam = teamName;
    this.teamImportCsvTeamSearch = teamName;
    this.teamImportStatusMessage = '';
    this.refreshTeamImportPreview();
  }

  clearCsvImportTeam(): void {
    this.teamImportCsvTeam = null;
    this.teamImportCsvTeamSearch = '';
    this.teamImportStatusMessage = '';
    this.refreshTeamImportPreview();
  }

  onTeamImportCsvTeamChange(): void {
    this.teamImportCsvTeam = null;
    this.teamImportStatusMessage = '';
    this.refreshTeamImportPreview();
  }

  async onTeamImportPanelOpened(): Promise<void> {
    if (!this.importSourceLoaded) {
      await this.loadImportSource(false, false);
    }
  }

  async onTeamImportCsvTeamInput(event: Event): Promise<void> {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.teamImportCsvTeamSearch = value;
    this.onTeamImportCsvTeamChange();

    if (value.trim().length < this.liveTextSearchMinLength || this.importSourceLoaded) {
      return;
    }

    await this.loadImportSource(false, false);
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

    if (!this.hasBulkImportedPlayerLayout()) {
      alert('Bulk replace PLAYERS.DAT from this CSV first so team import can link players by CSV row order.');
      return;
    }

    const resolvedPlayers = this.getResolvedTeamImportPlayers();
    const cappedCount = Math.min(csvPlayers.length, 32);
    const matchedCount = resolvedPlayers.length;
    const skippedCount = cappedCount - matchedCount;

    if (matchedCount === 0) {
      alert('No matching existing players were found in PLAYERS.DAT for the selected CSV team.');
      return;
    }

    const offset = this.selectedTeamOffset!;
    const targetTeam = this.teamOptions.find((t) => t.offset === offset);
    const targetLabel = targetTeam?.label ?? `offset ${offset}`;

    if (!confirm(
      `This will clear the "${targetLabel}" roster and link ${matchedCount} existing players from "${this.teamImportCsvTeam}". ${skippedCount > 0 ? `${skippedCount} CSV players were not found and will be skipped. ` : ''}Continue?`
    )) {
      return;
    }

    this.isTeamImporting = true;

    try {
      this.teamEditorService.clearTeam(offset);

      for (const player of resolvedPlayers) {
        this.teamEditorService.addPlayer(offset, player.playerIndex, player.position, player.shirtNumber);
      }

      if (this.selectedTeamOffset === offset) {
        this.loadSingleTeam(offset);
      }

      this.refreshDbBrowsePlayers();

      this.teamImportStatusMessage = `Linked ${resolvedPlayers.length} existing players for "${this.teamImportCsvTeam}" into ${targetLabel}.`;

      if (skippedCount > 0) {
        alert(`${skippedCount} CSV players were not found in PLAYERS.DAT and were skipped.`);
      }
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

    const sourcePlayers = this.getImportedPlayersInCsvOrder();
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
      const playersToWrite = [
        ...this.createBulkImportDummyPlayers(templatePlayer),
        ...mappedPlayers
      ];

      const result = this.playerService.replacePlayers(
        playersToWrite,
        hasTemplatePlayer ? { templatePlayerIndex: 0 } : {}
      );
      this.applyPlayerFileLoaded();
      await this.playerService.downloadFile();

      this.showImportPicker = false;
      this.importSearchQuery = '';
      this.importStatusMessage = `Bulk replace complete: inserted ${this.bulkImportDummyPlayerCount} dummy players, then ${sourcePlayers.length} imported players (${result.previousTotal} -> ${result.nextTotal}) and downloaded players.dat.`;

      if (playersToWrite.length > result.replaced) {
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
    this.ensureDbBrowsePlayers();

    const normalizedNameQuery = this.dbSearchNameQuery.trim().toLowerCase();
    const hasNameQuery = normalizedNameQuery.length >= this.liveTextSearchMinLength;
    const nationalityQuery = this.dbSearchNationalityQuery;
    const positionQuery = this.dbSearchPositionQuery;
    const teamQuery = this.dbSearchTeamQuery;

    return this.dbBrowsePlayers.filter((player) => {
      const matchesName = !hasNameQuery
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

  get filteredTeamBrowseItems(): TeamBrowseItem[] {
    this.ensureTeamBrowseItems();
    return this.filteredTeamBrowseItemsCache;
  }

  get pagedTeamBrowseItems(): TeamBrowseItem[] {
    const startIndex = (this.teamBrowseCurrentPage - 1) * this.teamBrowsePageSize;
    return this.filteredTeamBrowseItems.slice(startIndex, startIndex + this.teamBrowsePageSize);
  }

  get teamBrowseTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTeamBrowseItems.length / this.teamBrowsePageSize));
  }

  get teamBrowseCurrentPage(): number {
    return Math.min(this.teamBrowsePage, this.teamBrowseTotalPages);
  }

  get teamBrowseRangeStart(): number {
    if (this.filteredTeamBrowseItems.length === 0) {
      return 0;
    }

    return (this.teamBrowseCurrentPage - 1) * this.teamBrowsePageSize + 1;
  }

  get teamBrowseRangeEnd(): number {
    return Math.min(this.teamBrowseCurrentPage * this.teamBrowsePageSize, this.filteredTeamBrowseItems.length);
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

  openTeamFromBrowser(team: TeamBrowseItem): void {
    if (!this.teamFileLoaded) {
      alert('Load TEAMPLAYERLINKS file first.');
      return;
    }

    const matchingOption = this.teamEditorService.teamOptions.find(({ offset }) => this.teamEditorService.getTeam(offset).teamId === team.teamId);

    if (!matchingOption) {
      alert('No matching TEAMPLAYERLINKS entry was found for this team.');
      return;
    }

    this.selectedTeamOffset = matchingOption.offset;
    this.loadSingleTeam(matchingOption.offset);
    this.activeMainTab = 0;
  }

  getLeagueLabel(leagueId: number): string {
    return this.leagueOptions.find((league) => league.value === leagueId)?.label ?? `League ${leagueId}`;
  }

  getEuropeanCompetitionLabel(value: number): string {
    return this.europeanCompetitionOptions.find((competition) => competition.value === value)?.label ?? `Competition ${value}`;
  }

  getEuropeanCompetitionBadgeLabel(value: number): string {
    switch (value) {
      case 1:
        return 'UCL';
      case 2:
        return 'UEL';
      default:
        return 'NONE';
    }
  }

  createDbBrowsePlayer(): void {
    if (!this.fileLoaded) {
      alert('Load PLAYERS.DAT first.');
      return;
    }

    const newPlayerIndexes = this.playerService.appendPlayers([this.createNewPlayerDraft()]);
    const newPlayerIndex = newPlayerIndexes[0];

    if (newPlayerIndex === undefined) {
      alert('Unable to append a new player to PLAYERS.DAT.');
      return;
    }

    this.applyPlayerFileLoaded();
    this.openPlayerEditPopup(newPlayerIndex);
  }

  repairAllPlayerFeet(): void {
    if (!this.fileLoaded) {
      return;
    }

    for (let index = 0; index < this.playerService.totalPlayers; index += 1) {
      const player = this.playerService.readPlayer(index);
      const repairedFoot = this.invertPlayerFootValue(player.foot);

      if (repairedFoot === player.foot) {
        continue;
      }

      this.playerService.writePlayer(index, { ...player, foot: repairedFoot });
    }

    if (this.showPlayerEditPopup && this.popupPlayerIndex < this.playerService.totalPlayers) {
      this.popupPlayer = this.playerService.readPlayer(this.popupPlayerIndex);
      this.updatePopupOVR();
    }

    this.invalidateDbBrowsePlayers();
    this.invalidateTeamBrowseItems();
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

  resetTeamBrowsePagination(): void {
    this.teamBrowsePage = 1;
    this.refreshFilteredTeamBrowseItems();
  }

  goToPreviousTeamBrowsePage(): void {
    if (this.teamBrowseCurrentPage > 1) {
      this.teamBrowsePage = this.teamBrowseCurrentPage - 1;
    }
  }

  goToNextTeamBrowsePage(): void {
    if (this.teamBrowseCurrentPage < this.teamBrowseTotalPages) {
      this.teamBrowsePage = this.teamBrowseCurrentPage + 1;
    }
  }

  // ─── File loading ─────────────────────────────────────────────

  private async getDirectoryFileHandle(dirHandle: any, expectedNames: string[]): Promise<any> {
    for (const expectedName of expectedNames) {
      try {
        const handle = await dirHandle.getFileHandle(expectedName);
        console.log('[InitLoad] exact file match:', expectedName);
        return handle;
      } catch {
        // Try the next casing variant.
      }
    }

    const normalizedExpectedNames = new Set(expectedNames.map((name) => name.toLowerCase()));

    if (typeof dirHandle.entries === 'function') {
      for await (const [entryName, entryHandle] of dirHandle.entries()) {
        if (entryHandle?.kind === 'file' && normalizedExpectedNames.has(entryName.toLowerCase())) {
          console.log('[InitLoad] case-insensitive file match:', entryName);
          return entryHandle;
        }
      }
    }

    throw new Error(`File not found: ${expectedNames[0]}`);
  }

  private normalizeFileName(fileName: string): string {
    return fileName.toLowerCase().replace(/[^a-z0-9]+/gu, '');
  }

  private async tryRestoreTeamNamesXlcFromRememberedFolder(): Promise<string | null> {
    const dirHandle = await this.fileHandleStorage.getFileHandle<any>(this.folderHandleStorageKey);

    if (!dirHandle || !(await this.hasReadPermission(dirHandle))) {
      return null;
    }

    try {
      const handle = await this.getTeamNamesXlcHandle(dirHandle);
      return await this.xlcEditorService.loadFile(handle);
    } catch {
      return null;
    }
  }

  private async hasReadPermission(fileSystemHandle: any): Promise<boolean> {
    if (!fileSystemHandle) {
      return false;
    }

    if (typeof fileSystemHandle.queryPermission === 'function') {
      const permission = await fileSystemHandle.queryPermission({ mode: 'read' });
      if (permission === 'granted') {
        return true;
      }
    }

    if (typeof fileSystemHandle.requestPermission === 'function') {
      const permission = await fileSystemHandle.requestPermission({ mode: 'read' });
      return permission === 'granted';
    }

    return false;
  }

  private async getTeamNamesXlcHandle(dirHandle: any): Promise<any> {
    const preferredNames = ['ftsteamnames.xlc', 'FTSTEAMNAMES.XLC', 'teamnames.xlc', 'TEAMNAMES.XLC'];
    console.log('[InitLoad] looking for team names XLC. Preferred names:', preferredNames.join(', '));

    try {
      return await this.getDirectoryFileHandle(dirHandle, preferredNames);
    } catch {
      // Fall through to a normalized scan so minor naming differences still resolve.
    }

    const normalizedPreferredNames = new Set([
      this.normalizeFileName('ftsteamnames.xlc'),
      this.normalizeFileName('teamnames.xlc')
    ]);

    if (typeof dirHandle.entries === 'function') {
      for await (const [entryName, entryHandle] of dirHandle.entries()) {
        if (entryHandle?.kind !== 'file') {
          continue;
        }

        const normalizedEntryName = this.normalizeFileName(entryName);
        console.log('[InitLoad] scanning candidate file:', entryName, 'normalized:', normalizedEntryName);
        if (normalizedPreferredNames.has(normalizedEntryName)) {
          console.log('[InitLoad] normalized team names XLC match:', entryName);
          return entryHandle;
        }
      }
    }

    throw new Error('File not found: ftsteamnames.xlc');
  }

  private async getPakHandle(dirHandle: any): Promise<any> {
    const preferredNames = ['teams.pak', 'TEAMS.PAK'];
    console.log('[InitLoad] looking for PAK. Preferred names:', preferredNames.join(', '));

    try {
      const handle = await this.getDirectoryFileHandle(dirHandle, preferredNames);
      console.log('[InitLoad] exact PAK match found via preferred names.');
      return handle;
    } catch {
      console.log('[InitLoad] exact PAK match not found. Falling back to normalized scan.');
      // Fall through to normalized lookup for case and punctuation variations.
    }

    const normalizedPreferredName = this.normalizeFileName('teams.pak');

    if (typeof dirHandle.entries === 'function') {
      for await (const [entryName, entryHandle] of dirHandle.entries()) {
        if (entryHandle?.kind !== 'file') {
          continue;
        }

        const normalizedEntryName = this.normalizeFileName(entryName);
        console.log('[InitLoad] scanning PAK candidate:', entryName, 'normalized:', normalizedEntryName);

        if (normalizedEntryName === normalizedPreferredName) {
          console.log('[InitLoad] normalized PAK match:', entryName);
          return entryHandle;
        }
      }
    }

    throw new Error('File not found: teams.pak');
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

    await this.fileHandleStorage.saveFileHandle(this.folderHandleStorageKey, dirHandle);

    const errors: string[] = [];
  console.log('[InitLoad] folder selected, starting file load sequence.');

    try {
      console.log('[InitLoad] loading PLAYERS.DAT...');
      const handle = await this.getDirectoryFileHandle(dirHandle, ['PLAYERS.DAT', 'players.dat']);
      await this.playerService.loadFile(handle);
      this.applyPlayerFileLoaded();
      console.log('[InitLoad] PLAYERS.DAT loaded.');
    } catch (err: any) {
      console.error('[InitLoad] PLAYERS.DAT load failed:', err);
      errors.push(`PLAYERS.DAT: ${err.message || 'not found'}`);
    }

    try {
      console.log('[InitLoad] loading TEAMPLAYERLINKS_0.dat...');
      const handle = await this.getDirectoryFileHandle(dirHandle, ['TEAMPLAYERLINKS_0.dat', 'TEAMPLAYERLINKS_0.DAT', 'teamplayerlinks_0.dat']);
      await this.teamEditorService.loadFile(handle);
      this.applyTeamFileLoaded();
      console.log('[InitLoad] TEAMPLAYERLINKS_0.dat loaded.');
    } catch (err: any) {
      console.error('[InitLoad] TEAMPLAYERLINKS_0.dat load failed:', err);
      errors.push(`TEAMPLAYERLINKS_0.dat: ${err.message || 'not found'}`);
    }

    try {
      console.log('[InitLoad] loading TEAMS.DAT...');
      const handle = await this.getDirectoryFileHandle(dirHandle, ['TEAMS.DAT', 'teams.dat']);
      await this.teamsDatService.loadFile(handle);
      this.applyTeamsDatLoaded();
      console.log('[InitLoad] TEAMS.DAT loaded.');
    } catch (err: any) {
      console.error('[InitLoad] TEAMS.DAT load failed:', err);
      errors.push(`TEAMS.DAT: ${err.message || 'not found'}`);
    }

    try {
      console.log('[InitLoad] loading team names XLC...');
      const handle = await this.getTeamNamesXlcHandle(dirHandle);
      const fileName = await this.xlcEditorService.loadFile(handle);
      this.applyXlcLoaded(fileName);
      this.xlcStatusMessage = `Loaded ${fileName}.`;
      console.log('[InitLoad] team names XLC loaded:', fileName);
    } catch (err: any) {
      this.clearXlcLoaded();

      const message = err?.message || 'Failed to load the team names XLC file.';
      this.xlcStatusMessage = message.startsWith('File not found:')
        ? 'Could not find ftsteamnames.xlc or teamnames.xlc in the selected folder.'
        : message;
      console.error('[InitLoad] team names XLC load failed:', err);
      console.log('[InitLoad] team names XLC status message:', this.xlcStatusMessage);
    }

    try {
      console.log('[InitLoad] loading PAK...');
      const handle = await this.getPakHandle(dirHandle);
      const fileName = await this.pakEditorService.loadFile(handle);
      this.applyPakLoaded(fileName);
      this.pakStatusMessage = `Loaded ${fileName}.`;
      console.log('[InitLoad] PAK loaded:', fileName);
    } catch (err: any) {
      this.clearPakLoaded();
      const message = err?.message || 'Could not find teams.pak in the selected folder.';
      this.pakStatusMessage = message;
      console.error('[InitLoad] PAK load failed:', err);
      console.log('[InitLoad] PAK status message:', this.pakStatusMessage);
      errors.push(`teams.pak: ${message}`);
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    if (this.canEnterEditor) {
    }

    this.checkAutoTransition();
  }

  // ─── Save ─────────────────────────────────────────────────────

  async clearTeamPlayerLinks(): Promise<void> {
    if (!this.fileLoaded) {
      alert('Load PLAYERS.DAT file first.');
      return;
    }

    if (!this.teamEditorService.hasData) {
      alert('Load TEAMPLAYERLINKS file first.');
      return;
    }

    if (!this.teamsDatService.hasData) {
      alert('Load TEAMS.DAT file first.');
      return;
    }

    if (!confirm('This will overwrite the currently loaded PLAYERS.DAT, TEAMPLAYERLINKS_0.dat, TEAMS.DAT, and loaded XLC file with the backup files from assets/backup. Continue?')) {
      return;
    }

    try {
      const [playerBytes, teamPlayerLinksBytes, teamsDatBytes, xlcBytes] = await Promise.all([
        this.fetchBackupBytes(this.backupPlayersAssetUrl, 'PLAYERS.DAT'),
        this.fetchBackupBytes(this.backupTeamPlayerLinksAssetUrl, 'TEAMPLAYERLINKS_0.dat'),
        this.fetchBackupBytes(this.backupTeamsDatAssetUrl, 'TEAMS.DAT'),
        this.xlcLoaded ? this.fetchBackupBytes(this.backupXlcAssetUrl, 'ftsteamnames.xlc') : Promise.resolve(null)
      ]);

      const playerHandle = this.playerService.fileHandle;
      const teamHandle = this.teamEditorService.fileHandle;
      const teamsDatHandle = this.teamsDatService.fileHandle;
      const xlcHandle = this.xlcEditorService.fileHandle;

      this.playerService.loadFromBytes(playerBytes, 'PLAYERS.DAT');
      this.playerService.fileHandle = playerHandle;

      this.teamEditorService.loadFromBytes(teamPlayerLinksBytes, 'TEAMPLAYERLINKS_0.dat');
      this.teamEditorService.fileHandle = teamHandle;

      this.teamsDatService.loadFromBytes(teamsDatBytes, 'TEAMS.DAT');
      this.teamsDatService.fileHandle = teamsDatHandle;

      if (this.xlcLoaded && xlcBytes && xlcHandle) {
        this.xlcEditorService.loadFromBytes(xlcBytes, 'ftsteamnames.xlc');
        this.xlcEditorService.fileHandle = xlcHandle;
      }

      this.applyTeamsDatLoaded();
      this.applyPlayerFileLoaded();
      this.applyTeamFileLoaded();

      if (this.xlcLoaded && xlcBytes && xlcHandle) {
        this.applyXlcLoaded('ftsteamnames.xlc');
        this.xlcStatusMessage = 'Restored ftsteamnames.xlc from backup.';
      }

      await this.playerService.saveCurrentToSameFile();
      await this.teamEditorService.saveToSameFile();
      await this.teamsDatService.saveToSameFile();

      if (this.xlcLoaded && xlcBytes && xlcHandle) {
        await this.xlcEditorService.saveToSameFile();
      }

      alert('Backup files restored successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to restore the backup files.';
      alert(message);
    }
  }

  async saveAllFiles(): Promise<void> {
    if (!this.allFilesLoaded) {
      alert('Load all files first.');
      return;
    }

    const syncedRoles = this.syncAllTeamsDatRolesWithCurrentRosters(true);
    const syncedRatings = this.syncAllTeamsDatRatingsWithCurrentRosters();

    if (syncedRoles > 0) {
      alert(`Synced captain/corner/penalty/free-kick roles for ${syncedRoles} teams across TEAMPLAYERLINKS and TEAMS.DAT using the current starting XI.`);
    }

    if (syncedRatings > 0) {
      alert(`Synced ATT/MID/DEF OVR values in TEAMS.DAT for ${syncedRatings} teams before save.`);
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
      if (this.xlcLoaded) {
        await this.xlcEditorService.saveToSameFile();
      }
      if (this.pakLoaded) {
        await this.pakEditorService.saveToSameFile();
      }
      alert('Files overwritten successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed. Make sure you gave the browser permission to save changes.';
      alert(message);
    }
  }

  private syncAllTeamsDatRolesWithCurrentRosters(syncTeamPlayerLinks = false): number {
    if (!this.teamEditorService.hasData || !this.teamsDatService.hasData) {
      return 0;
    }

    let syncedTeams = 0;

    this.teamEditorService.teamOptions.forEach(({ offset }) => {
      const team = this.teamEditorService.getTeam(offset);

      if (this.syncTeamsDatRolesForTeam(team, syncTeamPlayerLinks)) {
        syncedTeams += 1;
      }
    });

    return syncedTeams;
  }

  private syncAllTeamsDatRatingsWithCurrentRosters(): number {
    if (!this.teamEditorService.hasData || !this.teamsDatService.hasData || !this.fileLoaded) {
      return 0;
    }

    let syncedTeams = 0;

    this.teamEditorService.teamOptions.forEach(({ offset }) => {
      const team = this.teamEditorService.getTeam(offset);

      if (this.syncTeamsDatRatingsForTeam(team, false)) {
        syncedTeams += 1;
      }
    });

    if (syncedTeams > 0) {
      this.rebuildTeamBrowseItems();
    }

    return syncedTeams;
  }

  private syncTeamsDatRolesForTeam(team: TeamRecord, syncTeamPlayerLinks = false): boolean {
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

    const nextCaptainRole = this.resolveEffectiveRolePlayerId(team, record, 'captainRole');
    const nextLeftCornerRole = this.resolveEffectiveRolePlayerId(team, record, 'leftCornerRole');
    const nextRightCornerRole = this.resolveEffectiveRolePlayerId(team, record, 'rightCornerRole');
    const nextPenaltyRole = this.resolveEffectiveRolePlayerId(team, record, 'penaltyRole');
    const nextFreeKickRole = this.resolveEffectiveRolePlayerId(team, record, 'freeKickRole');

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
    const roleFromStartingEleven = this.getRolePlayerIdFromStartingEleven(team, field);

    if (roleFromStartingEleven !== null) {
      return roleFromStartingEleven;
    }

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

  private getRolePlayerIdFromStartingEleven(team: TeamRecord, field: TeamsRoleField): number | null {
    if (!this.fileLoaded) {
      return null;
    }

    const starters = this.getActiveTeamSlots(team)
      .slice(0, 11)
      .map((slot) => ({
        slot,
        player: this.playerService.readPlayer(slot.playerId)
      }));

    if (starters.length === 0) {
      return null;
    }

    const bestStarter = this.pickBestStarter(starters, field);
    return bestStarter?.slot.playerId ?? null;
  }

  private pickBestStarter(
    starters: Array<{ slot: TeamSlot; player: Player }>,
    field: TeamsRoleField
  ): { slot: TeamSlot; player: Player } | null {
    switch (field) {
      case 'captainRole':
        return this.pickBestStarterByMetric(starters, (starter) => this.playerService.calculateOVR(starter.player));
      case 'leftCornerRole':
        return this.pickCornerStarter(starters, 0);
      case 'rightCornerRole':
        return this.pickCornerStarter(starters, 1);
      case 'penaltyRole':
        return this.pickBestStarterByMetric(starters, (starter) => starter.player.SHO);
      case 'freeKickRole':
        return this.pickBestStarterByMetric(starters, (starter) => starter.player.FK);
    }
  }

  private pickCornerStarter(
    starters: Array<{ slot: TeamSlot; player: Player }>,
    preferredFoot: number
  ): { slot: TeamSlot; player: Player } | null {
    const preferredFootStarters = starters.filter((starter) => starter.player.foot === preferredFoot);

    return this.pickBestStarterByMetric(
      preferredFootStarters.length > 0 ? preferredFootStarters : starters,
      (starter) => starter.player.CRO
    );
  }

  private pickBestStarterByMetric(
    starters: Array<{ slot: TeamSlot; player: Player }>,
    metric: (starter: { slot: TeamSlot; player: Player }) => number
  ): { slot: TeamSlot; player: Player } | null {
    if (starters.length === 0) {
      return null;
    }

    let bestStarter = starters[0];
    let bestMetric = metric(bestStarter);
    let bestOvr = this.playerService.calculateOVR(bestStarter.player);

    for (let index = 1; index < starters.length; index += 1) {
      const candidate = starters[index];
      const candidateMetric = metric(candidate);
      const candidateOvr = this.playerService.calculateOVR(candidate.player);

      if (candidateMetric > bestMetric) {
        bestStarter = candidate;
        bestMetric = candidateMetric;
        bestOvr = candidateOvr;
        continue;
      }

      if (candidateMetric === bestMetric) {
        if (candidateOvr > bestOvr) {
          bestStarter = candidate;
          bestMetric = candidateMetric;
          bestOvr = candidateOvr;
          continue;
        }

        if (candidateOvr === bestOvr && candidate.slot.index < bestStarter.slot.index) {
          bestStarter = candidate;
          bestMetric = candidateMetric;
          bestOvr = candidateOvr;
        }
      }
    }

    return bestStarter;
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

  private syncTeamsDatRatingsForTeam(team: TeamRecord, refreshTeamBrowseItems = true): boolean {
    if (!this.teamsDatLoaded || !this.fileLoaded) {
      return false;
    }

    const record = this.teamsDatService.records.find((entry) => entry.teamId === team.teamId);

    if (!record) {
      return false;
    }

    const ratingSlots = this.getActiveTeamSlots(team).slice(0, 18);
    const totals = {
      attack: { sum: 0, count: 0 },
      midfield: { sum: 0, count: 0 },
      defense: { sum: 0, count: 0 }
    };

    ratingSlots.forEach((slot) => {
      const player = this.playerService.readPlayer(slot.playerId);
      const category = this.getTeamRatingCategory(slot.position);
      totals[category].sum += this.playerService.calculateOVR(player);
      totals[category].count += 1;
    });

    const attackOvr = this.toAverageTeamOvr(totals.attack.sum, totals.attack.count);
    const midfieldOvr = this.toAverageTeamOvr(totals.midfield.sum, totals.midfield.count);
    const defenseOvr = this.toAverageTeamOvr(totals.defense.sum, totals.defense.count);

    if (
      attackOvr === record.attackOvr
      && midfieldOvr === record.midfieldOvr
      && defenseOvr === record.defenseOvr
    ) {
      return false;
    }

    this.teamsDatService.updateRecord(record.index, {
      attackOvr,
      midfieldOvr,
      defenseOvr
    });

    if (refreshTeamBrowseItems) {
      this.rebuildTeamBrowseItems();
    }

    return true;
  }

  private getTeamRatingCategory(position: number): 'attack' | 'midfield' | 'defense' {
    if (position <= 10) {
      return 'defense';
    }

    if (position <= 18) {
      return 'midfield';
    }

    return 'attack';
  }

  private toAverageTeamOvr(sum: number, count: number): number {
    if (count <= 0) {
      return 0;
    }

    return Math.round(sum / count);
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

  downloadPlayersUncompressed(): void {
    if (!this.fileLoaded) {
      alert('Load PLAYERS.DAT first.');
      return;
    }

    this.playerService.exportUncompressedFile();
  }

  downloadTeamsDatUncompressed(): void {
    if (!this.teamsDatLoaded) {
      alert('Load TEAMS.DAT first.');
      return;
    }

    this.teamsDatService.exportUncompressedFile();
  }

  // ─── Team Editor ──────────────────────────────────────────────

  get filteredTeamAddPlayers(): DbBrowsePlayer[] {
    this.ensureDbBrowsePlayers();

    const normalizedQuery = this.teamAddSearchQuery.trim().toLowerCase();

    if (normalizedQuery.length < this.liveTextSearchMinLength) {
      return [];
    }

    return this.dbBrowsePlayers
      .filter((player) => player.name.toLowerCase().includes(normalizedQuery)
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

    if (this.displayedTeams.length > 0) {
      this.syncTeamsDatRatingsForTeam(this.displayedTeams[0]);
    }

    this.rebuildRoleSelectOptions();

    // Sync teams.dat tactics section to the newly selected team
    if (this.teamsDatLoaded && this.displayedTeams.length > 0) {
      const team = this.displayedTeams[0];
      const idx = this.teamsDatService.records.findIndex((r) => r.teamId === team.teamId);
      this.selectedTeamsDatIndex = idx !== -1 ? idx : null;
    }

    this.logDisplayedTeamNameSummary();
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

    this.ensureDbBrowsePlayers();

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
    const cachedSketch = this.formationSketchCache.get(team);

    if (cachedSketch) {
      return cachedSketch;
    }

    const activeSlots = team.slots
      .slice(0, Math.min(team.playerCount, team.slots.length))
      .filter((slot) => !slot.isEmpty);

    const starters = activeSlots.slice(0, 11);

    const resolvedFormation = this.resolveFormationForTeam(team);

    const sketch = resolvedFormation.formation
      ? this.buildFormationSketch(starters, resolvedFormation.formation)
      : this.buildFirstElevenSketch(starters);

    const sketchResult = {
      ...sketch,
      reservePlayers: activeSlots.slice(11).map((player) => this.toSketchPlayer(player)),
      sourceLabel: resolvedFormation.sourceLabel
    };

    this.formationSketchCache.set(team, sketchResult);

    return sketchResult;
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
    field: 'teamId' | 'leagueId' | 'rivalId' | 'attackOvr' | 'midfieldOvr' | 'defenseOvr' | 'sponsorType' | 'kitManufacturer' | 'specialTeamFlag' | 'europeanCompetition',
    value: string | number
  ): void {
    const changes: Partial<Pick<TeamsDatRecord,
      'teamId' | 'leagueId' | 'rivalId' | 'attackOvr' | 'midfieldOvr' | 'defenseOvr' | 'sponsorType' | 'kitManufacturer' | 'specialTeamFlag' | 'europeanCompetition'
    >> = {};

    changes[field] = Number(value);
    this.teamsDatService.updateRecord(record.index, changes);
    this.rebuildTeamBrowseItems();

    if (field === 'teamId') {
      this.rebuildRivalOptions();
    }
  }

  updateTeamsDatFormation(record: TeamsDatRecord, value: string | number): void {
    this.teamsDatService.updateRecord(record.index, { formationId: Number(value) });

    if (this.selectedTeamOffset !== null && this.displayedTeams.some((team) => team.teamId === record.teamId)) {
      this.loadSingleTeam(this.selectedTeamOffset);
    }
  }

  updateTeamsDatRegion(record: TeamsDatRecord, value: string): void {
    this.teamsDatService.updateRecord(record.index, { region: value });
  }

  updateTeamsDatKitColor(record: TeamsDatRecord, kitIndex: number, colorIndex: number, value: string): void {
    this.teamsDatService.updateKitColor(record.index, kitIndex, colorIndex, value);
  }

  updateTeamsDatKitStyle(record: TeamsDatRecord, kitIndex: number, value: string | number): void {
    this.teamsDatService.updateKitStyle(record.index, kitIndex, Number(value));
  }

  openTeamKitDialog(team: TeamRecord): void {
    const record = this.teamsDatService.records.find((entry) => entry.teamId === team.teamId);

    if (!record) {
      alert('No matching TEAMS.DAT record was found for this team.');
      return;
    }

    this.teamKitDialogRecordIndex = record.index;
    this.teamKitDialogTabIndex = 0;
    this.showTeamKitDialog = true;
  }

  openTeamStadiumDialog(team: TeamRecord): void {
    const record = this.teamsDatService.records.find((entry) => entry.teamId === team.teamId);

    if (!record) {
      alert('No matching TEAMS.DAT record was found for this team.');
      return;
    }

    this.teamStadiumDialogRecordIndex = record.index;
    this.showTeamStadiumDialog = true;
  }

  closeTeamKitDialog(): void {
    this.showTeamKitDialog = false;
    this.teamKitDialogRecordIndex = null;
    this.teamKitDialogTabIndex = 0;
  }

  closeTeamStadiumDialog(): void {
    this.showTeamStadiumDialog = false;
    this.teamStadiumDialogRecordIndex = null;
  }

  updateActiveTeamKitDialogColor(kitIndex: number, colorIndex: number, value: string): void {
    if (this.teamKitDialogRecordIndex === null) {
      return;
    }

    this.teamsDatService.updateKitColor(this.teamKitDialogRecordIndex, kitIndex, colorIndex, value);
  }

  updateActiveTeamKitDialogColorChannel(
    kitIndex: number,
    colorIndex: number,
    currentHex: string,
    channelIndex: 0 | 1 | 2,
    value: string | number
  ): void {
    this.updateActiveTeamKitDialogColor(
      kitIndex,
      colorIndex,
      this.withHexColorChannel(currentHex, channelIndex, value)
    );
  }

  updateActiveTeamKitDialogStyle(kitIndex: number, value: string | number): void {
    if (this.teamKitDialogRecordIndex === null) {
      return;
    }

    this.teamsDatService.updateKitStyle(this.teamKitDialogRecordIndex, kitIndex, Number(value));
  }

  updateActiveTeamKitDialogNumberField(
    field: 'sponsorType' | 'kitManufacturer' | 'linesUL' | 'linesUV' | 'linesPL' | 'linesPV',
    value: string | number
  ): void {
    if (this.teamKitDialogRecordIndex === null) {
      return;
    }

    this.teamsDatService.updateRecord(this.teamKitDialogRecordIndex, { [field]: Number(value) });
  }

  updateActiveTeamStadiumDialogName(value: string): void {
    if (this.teamStadiumDialogRecordIndex === null) {
      return;
    }

    this.teamsDatService.updateRecord(this.teamStadiumDialogRecordIndex, { stadiumName: value });
    this.rebuildTeamBrowseItems();
  }

  updateActiveTeamStadiumDialogColor(value: string): void {
    if (this.teamStadiumDialogRecordIndex === null) {
      return;
    }

    this.teamsDatService.updateStadiumColor(this.teamStadiumDialogRecordIndex, value);
  }

  updateActiveTeamStadiumDialogColorChannel(
    currentHex: string,
    channelIndex: 0 | 1 | 2,
    value: string | number
  ): void {
    this.updateActiveTeamStadiumDialogColor(this.withHexColorChannel(currentHex, channelIndex, value));
  }

  updateActiveTeamStadiumDialogPitchType(value: string | number): void {
    if (this.teamStadiumDialogRecordIndex === null) {
      return;
    }

    this.teamsDatService.updatePitchType(this.teamStadiumDialogRecordIndex, Number(value));
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

  getHexColorChannel(value: string, channelIndex: 0 | 1 | 2): number {
    const normalizedValue = this.normalizeHexColor(value);

    if (!normalizedValue) {
      return 0;
    }

    const startIndex = 1 + (channelIndex * 2);

    return Number.parseInt(normalizedValue.slice(startIndex, startIndex + 2), 16);
  }

  getKitColorControl(
    kit: TeamsDatKit,
    colorLabel:
      | 'Shirt Primary'
      | 'Shirt Secondary'
      | 'Shirt Nr'
      | 'Socks'
      | 'Shorts'
      | 'Sponsor'
      | 'Short Nr'
      | 'Shirt Lines'
      | 'Short Lines'
      | 'Socks Lines'
  ): TeamsDatKitColor | null {
    return kit.colors.find((color) => color.label === colorLabel) ?? null;
  }

  formatHexRoleValue(value: number): string {
    return value.toString(16).toUpperCase().padStart(4, '0');
  }

  formatTeamsDatOffset(value: number): string {
    return `0x${value.toString(16).toUpperCase()}`;
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
    return this.getTeamDisplayLabel(rivalId);
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

  private async fetchBackupBytes(assetUrl: string, label: string): Promise<Uint8Array> {
    const response = await fetch(assetUrl, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Backup file not found: ${label}.`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  private async initializeApp(): Promise<void> {
    console.log('[InitLoad] initializeApp() start.');
    await this.loadImportSource(false, false);
    await this.fileHandleStorage.deleteStoredValue('fts-editor-local-save');
    await this.restoreRememberedFiles();

    console.log('[InitLoad] initializeApp() complete.');
  }

  private async restoreRememberedFiles(): Promise<void> {
    console.log('[InitLoad] restoreRememberedFiles() start.');

    const restoredPlayerFileName = await this.playerService.tryRestoreLastFile();
    if (restoredPlayerFileName) {
      console.log('[InitLoad] restored PLAYERS.DAT from remembered handle:', restoredPlayerFileName);
      this.applyPlayerFileLoaded();
    } else {
      console.log('[InitLoad] no remembered PLAYERS.DAT handle restored.');
    }

    const restoredTeamFileName = await this.teamEditorService.tryRestoreLastFile();
    if (restoredTeamFileName) {
      console.log('[InitLoad] restored TEAMPLAYERLINKS_0.dat from remembered handle:', restoredTeamFileName);
      this.applyTeamFileLoaded();
    } else {
      console.log('[InitLoad] no remembered TEAMPLAYERLINKS_0.dat handle restored.');
    }

    const restoredTeamsDatFileName = await this.teamsDatService.tryRestoreLastFile();
    if (restoredTeamsDatFileName) {
      console.log('[InitLoad] restored TEAMS.DAT from remembered handle:', restoredTeamsDatFileName);
      this.applyTeamsDatLoaded();
    } else {
      console.log('[InitLoad] no remembered TEAMS.DAT handle restored.');
    }

    const restoredXlcFileName = await this.xlcEditorService.tryRestoreLastFile();
    if (restoredXlcFileName) {
      console.log('[InitLoad] restored team names XLC from remembered handle:', restoredXlcFileName);
      this.applyXlcLoaded(restoredXlcFileName);
      this.xlcStatusMessage = `Loaded ${restoredXlcFileName}.`;
    } else {
      const restoredFolderXlcFileName = await this.tryRestoreTeamNamesXlcFromRememberedFolder();

      if (restoredFolderXlcFileName) {
        console.log('[InitLoad] restored team names XLC from remembered folder:', restoredFolderXlcFileName);
        this.applyXlcLoaded(restoredFolderXlcFileName);
        this.xlcStatusMessage = `Loaded ${restoredFolderXlcFileName}.`;
      } else {
        console.log('[InitLoad] no remembered team names XLC handle restored.');
      }
    }

    const restoredPakFileName = await this.pakEditorService.tryRestoreLastFile();
    if (restoredPakFileName) {
      console.log('[InitLoad] restored PAK from remembered handle:', restoredPakFileName);
      this.applyPakLoaded(restoredPakFileName);
      this.pakStatusMessage = `Loaded ${restoredPakFileName}.`;
    } else {
      console.log('[InitLoad] no remembered teams.pak handle restored.');
    }

    console.log('[InitLoad] restoreRememberedFiles() complete. pakLoaded:', this.pakLoaded);

    this.checkAutoTransition();
  }

  private applyPlayerFileLoaded(): void {
    console.log('[InitLoad] applyPlayerFileLoaded()');
    this.teamPlayerNameCache.clear();
    this.invalidateDbBrowsePlayers();
    this.invalidateTeamBrowseItems();
    this.displayedTeams = this.decorateTeamsWithPlayerNames(this.displayedTeams);
    this.rebuildRoleSelectOptions();
    this.refreshTeamImportPreview();
  }

  private applyTeamFileLoaded(): void {
    console.log('[InitLoad] applyTeamFileLoaded(). team options:', this.teamEditorService.teamOptions.length);
    this.rebuildTeamOptions();
    this.invalidateDbBrowsePlayers();
    this.invalidateTeamBrowseItems();
    this.selectedTeamOffset = this.teamOptions.length > 0 ? this.teamOptions[0].offset : null;
    this.displayedTeams = this.selectedTeamOffset === null
      ? []
      : this.decorateTeamsWithPlayerNames([this.teamEditorService.getTeam(this.selectedTeamOffset)]);
    this.rebuildRoleSelectOptions();
    this.refreshTeamImportPreview();
  }

  private applyTeamsDatLoaded(): void {
    console.log('[InitLoad] applyTeamsDatLoaded(). record count:', this.teamsDatService.teamCount);
    this.selectedTeamsDatIndex = this.teamsDatService.teamCount > 0 ? 0 : null;
    this.invalidateTeamBrowseItems();
    this.rebuildRivalOptions();

    if (this.displayedTeams.length > 0) {
      this.syncTeamsDatRatingsForTeam(this.displayedTeams[0]);
    }
  }

  private applyXlcLoaded(fileName: string): void {
    console.log('[InitLoad] applyXlcLoaded(). file:', fileName, 'displayed teams before:', this.displayedTeams.length);
    this.xlcFileName = fileName;
    this.rebuildTeamOptions();
    this.invalidateTeamBrowseItems();

    if (this.selectedTeamOffset !== null) {
      this.loadSingleTeam(this.selectedTeamOffset);
    } else {
      this.displayedTeams = this.decorateTeamsWithPlayerNames(this.displayedTeams);
      this.logDisplayedTeamNameSummary();
    }

    this.rebuildRivalOptions();
    this.invalidateDbBrowsePlayers();
    console.log('[InitLoad] applyXlcLoaded() complete. displayed teams now:', this.displayedTeams.length);
  }

  private clearXlcLoaded(): void {
    console.log('[InitLoad] clearXlcLoaded()');
    this.xlcEditorService.clearLoadedFile();
    this.xlcFileName = '';
    this.rebuildTeamOptions();
    this.invalidateTeamBrowseItems();
    this.displayedTeams = this.decorateTeamsWithPlayerNames(this.displayedTeams);
    this.rebuildRivalOptions();
    this.invalidateDbBrowsePlayers();
  }

  private applyPakLoaded(fileName: string): void {
    console.log('[InitLoad] applyPakLoaded(). file:', fileName, 'entries:', this.pakEditorService.entries.length);
    this.clearPakPreviewCache();
    this.pakFileName = fileName;
  }

  private clearPakLoaded(): void {
    console.log('[InitLoad] clearPakLoaded()');
    this.clearPakPreviewCache();
    this.pakEditorService.clearLoadedFile();
    this.pakFileName = '';
  }

  private clearPakPreviewCache(): void {
    this.pakPreviewObjectUrlCache.forEach((url) => URL.revokeObjectURL(url));
    this.pakPreviewUrlCache.clear();
    this.pakPreviewObjectUrlCache.clear();
  }

  private async renderImageAsPng(file: Blob, width: number, height: number): Promise<Uint8Array> {
    const imageBitmap = await this.createImageBitmapFromBlob(file);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to create a 2D canvas context for logo import.');
    }

    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(imageBitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) {
          resolve(nextBlob);
          return;
        }

        reject(new Error('Canvas failed to export the imported logo as PNG.'));
      }, 'image/png');
    });

    if ('close' in imageBitmap && typeof imageBitmap.close === 'function') {
      imageBitmap.close();
    }

    return new Uint8Array(await blob.arrayBuffer());
  }

  private async createImageBitmapFromBlob(file: Blob): Promise<ImageBitmap> {
    if (typeof createImageBitmap !== 'function') {
      throw new Error('Your browser does not support image bitmap decoding. Use Chrome.');
    }

    return await createImageBitmap(file);
  }

  private getPakImageMimeType(fileName: string): string {
    if (/\.png$/i.test(fileName)) {
      return 'image/png';
    }

    if (/\.jpe?g$/i.test(fileName)) {
      return 'image/jpeg';
    }

    if (/\.webp$/i.test(fileName)) {
      return 'image/webp';
    }

    if (/\.gif$/i.test(fileName)) {
      return 'image/gif';
    }

    return 'application/octet-stream';
  }

  openTeamLogoPicker(team: TeamRecord): void {
    if (!this.pakLoaded) {
      alert('Load teams.pak first.');
      return;
    }

    this.pendingTeamLogoImportTeamId = team.teamId;

    if (this.teamLogoFileInput?.nativeElement) {
      this.teamLogoFileInput.nativeElement.value = '';
      this.teamLogoFileInput.nativeElement.click();
    }
  }

  async onTeamLogoFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    const teamId = this.pendingTeamLogoImportTeamId;
    this.pendingTeamLogoImportTeamId = null;

    if (!file || teamId === null) {
      return;
    }

    const mainEntry = this.getTeamLogoEntry(teamId, 'main');
    const thumbEntry = this.getTeamLogoEntry(teamId, 'thumb');

    if (!mainEntry || !thumbEntry) {
      alert(`Could not find both t${teamId}.png and t${teamId}_thumb.png inside teams.pak.`);
      return;
    }

    try {
      const mainBytes = await this.renderImageAsPng(file, 256, 256);
      const thumbBytes = await this.renderImageAsPng(file, 64, 64);

      this.pakEditorService.replaceEntry(mainEntry, mainBytes);
      this.pakEditorService.replaceEntry(thumbEntry, thumbBytes);
      this.clearPakPreviewCache();
      this.pakStatusMessage = `Prepared new logo for team ${teamId}. Save to write ${mainEntry.name} and ${thumbEntry.name}.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import the selected logo image.';
      alert(message);
    }
  }

  private registerRuntimeDebugHandlers(): void {
    if (this.runtimeDebugHandlersRegistered || typeof window === 'undefined') {
      return;
    }

    window.addEventListener('error', (event) => {
      console.error('[RuntimeError] window error:', event.error ?? event.message, event);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[RuntimeError] unhandled rejection:', event.reason, event);
    });

    this.runtimeDebugHandlersRegistered = true;
    console.log('[InitLoad] runtime debug handlers registered.');
  }

  async saveXlcFile(): Promise<void> {
    if (!this.xlcLoaded) {
      alert('Load an XLC file first.');
      return;
    }

    try {
      await this.xlcEditorService.saveToSameFile();
      this.xlcStatusMessage = 'XLC file saved.';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save XLC file.';
      this.xlcStatusMessage = message;
      alert(message);
    }
  }

  exportXlcFile(): void {
    if (!this.xlcLoaded) {
      alert('Load an XLC file first.');
      return;
    }

    const fallbackName = this.xlcFileName ? this.xlcFileName.replace(/\.[^.]+$/u, '') : 'teamnames';
    this.xlcEditorService.exportFile(`${fallbackName}_export.xlc`);
    this.xlcStatusMessage = 'Exported XLC file.';
  }

  updateTeamLongName(team: TeamRecord, nextValue: string): void {
    this.updateTeamName(team, 'long', nextValue);
  }

  updateTeamShortName(team: TeamRecord, nextValue: string): void {
    this.updateTeamName(team, 'short', nextValue);
  }

  commitTeamLongName(team: TeamRecord, event: Event): void {
    const nextValue = (event.target as HTMLInputElement | null)?.value ?? '';
    this.updateTeamLongName(team, nextValue);
  }

  commitTeamShortName(team: TeamRecord, event: Event): void {
    const nextValue = (event.target as HTMLInputElement | null)?.value ?? '';
    this.updateTeamShortName(team, nextValue);
  }

  private updateTeamName(team: TeamRecord, nameType: 'long' | 'short', nextValue: string): void {
    if (!this.xlcLoaded) {
      alert('Load the team names XLC file first.');
      return;
    }

    if (nameType === 'short' && nextValue.length > 3) {
      const message = 'Short team names can be at most 3 characters.';
      this.xlcStatusMessage = message;
      alert(message);
      return;
    }

    const currentValue = nameType === 'long'
      ? (team.teamLongName ?? '')
      : (team.teamShortName ?? '');

    if (currentValue === nextValue) {
      return;
    }

    const teamNameKey = this.getTeamNameKey(nameType, team.teamId);

    try {
      this.xlcEditorService.updateValueByKey(teamNameKey, nextValue);
      this.xlcStatusMessage = `Updated ${teamNameKey}.`;

      this.rebuildTeamOptions();
      this.displayedTeams = this.decorateTeamsWithPlayerNames(this.displayedTeams);
      this.rebuildRivalOptions();
      this.rebuildTeamBrowseItems();
      this.refreshDbBrowsePlayers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update XLC value.';
      this.xlcStatusMessage = message;
      alert(message);
    }
  }

  private getTeamNameKey(nameType: 'long' | 'medium' | 'short', teamId: number): string {
    const prefix = nameType === 'long'
      ? this.teamLongNamePrefix
      : nameType === 'medium'
        ? this.teamMediumNamePrefix
        : this.teamShortNamePrefix;

    return `${prefix}${teamId}`;
  }

  private getTeamLongName(teamId: number): string | undefined {
    return this.getNamedTeamLocale(teamId, 'long')?.value ?? undefined;
  }

  private getTeamMediumName(teamId: number): string | undefined {
    return this.getNamedTeamLocale(teamId, 'medium')?.value ?? undefined;
  }

  private getTeamShortName(teamId: number): string | undefined {
    return this.getNamedTeamLocale(teamId, 'short')?.value ?? undefined;
  }

  private getNamedTeamLocale(teamId: number, nameType: 'long' | 'medium' | 'short') {
    const teamIndex = this.getTeamIndexById(teamId);
    const directLocale = this.getDirectTeamNameLocale(teamId, nameType);

    if (directLocale) {
      return directLocale;
    }

    const embeddedIdEntry = this.getTeamNameEntryByEmbeddedTeamId(teamId, nameType);
    const embeddedIdLocale = this.getPreferredTeamNameLocale(embeddedIdEntry?.locales ?? null);

    if (embeddedIdLocale) {
      return embeddedIdLocale;
    }

    return null;
  }

  private getPreferredTeamNameLocale(locales: XlcLocaleValue[] | null | undefined): XlcLocaleValue | null {
    if (!locales || locales.length === 0) {
      return null;
    }

    return locales.find((locale) => locale.value.trim().length > 0) ?? locales[0];
  }

  private getDirectTeamNameLocale(teamId: number, nameType: 'long' | 'medium' | 'short') {
    const candidateKeys = this.getTeamNameKeyCandidates(nameType, teamId);

    for (const key of candidateKeys) {
      const locale = this.xlcEditorService.getLocaleValueByKey(key);

      if (locale) {
        return locale;
      }
    }

    return null;
  }

  private getTeamNameKeyCandidates(nameType: 'long' | 'medium' | 'short', teamId: number): string[] {
    const numericSuffixes = [teamId];

    const basePrefixes = nameType === 'long'
      ? ['TXT_TEAMNAMELONG_', 'TXT_TEAMNAME_', 'TXT_CLUBNAMELONG_', 'TXT_CLUBNAME_']
      : nameType === 'medium'
        ? ['TXT_TEAMNAMEMED_', 'TXT_CLUBNAMEMED_']
        : ['TXT_TEAMNAMESHORT_', 'TXT_TEAMSHORTNAME_', 'TXT_TEAMNAMEABBR_', 'TXT_TEAMNAMEABBREV_', 'TXT_CLUBNAMESHORT_', 'TXT_CLUBSHORTNAME_', 'TXT_CLUBNAMEABBR_', 'TXT_CLUBNAMEABBREV_'];
    const tokenizedPrefixes = nameType === 'long'
      ? ['TXT_TEAM_', 'TXT_CLUB_']
      : nameType === 'medium'
        ? ['TXT_TEAM_', 'TXT_CLUB_']
        : ['TXT_TEAM_', 'TXT_CLUB_'];
    const tokenizedSuffixes = nameType === 'long'
      ? ['NAME', 'LONGNAME', 'NAMELONG']
      : nameType === 'medium'
        ? ['MED', 'MEDNAME', 'NAMEMED']
        : ['SHORT', 'SHORTNAME', 'NAMESHORT', 'ABBR', 'ABBREV', 'NAMEABBR', 'NAMEABBREV'];

    return Array.from(new Set([
      ...basePrefixes.flatMap((prefix) => numericSuffixes.map((suffix) => `${prefix}${suffix}`)),
      ...tokenizedPrefixes.flatMap((prefix) => numericSuffixes.flatMap((suffix) => tokenizedSuffixes.map((token) => `${prefix}${suffix}_${token}`))),
      ...tokenizedPrefixes.flatMap((prefix) => numericSuffixes.flatMap((suffix) => tokenizedSuffixes.map((token) => `${prefix}${token}_${suffix}`)))
    ]));
  }

  private getTeamNameEntries(nameType: 'long' | 'medium' | 'short') {
    return this.xlcEditorService.entries
      .filter((entry) => this.matchesTeamNameEntry(entry.key, nameType))
      .sort((left, right) => {
        const leftOrder = this.getTeamNameEntryOrder(left.key);
        const rightOrder = this.getTeamNameEntryOrder(right.key);

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.index - right.index;
      });
  }

  private getTeamNameEntryByEmbeddedTeamId(teamId: number, nameType: 'long' | 'medium' | 'short') {
    const matchingEntries = this.getTeamNameEntries(nameType)
      .filter((entry) => this.entryMatchesTeamIdSuffix(entry.key, teamId));

    return matchingEntries[0] ?? null;
  }

  private matchesTeamNameEntry(key: string, nameType: 'long' | 'medium' | 'short'): boolean {
    const normalizedKey = key.toUpperCase();

    const hasTeamOrClubToken = normalizedKey.includes('TEAM') || normalizedKey.includes('CLUB');
    const hasNameSignal = normalizedKey.includes('NAME')
      || normalizedKey.includes('SHORT')
      || normalizedKey.includes('SHRT')
      || normalizedKey.includes('ABBR')
      || normalizedKey.includes('MED')
      || normalizedKey.includes('LONG');
    const isTeamOrClubName = normalizedKey.startsWith('TXT_') && hasTeamOrClubToken && hasNameSignal;

    if (!isTeamOrClubName) {
      return false;
    }

    const isShort = normalizedKey.includes('SHORT') || normalizedKey.includes('SHRT') || normalizedKey.includes('ABBR');
    const isMedium = normalizedKey.includes('MED');

    if (nameType === 'short') {
      return isShort;
    }

    if (nameType === 'medium') {
      return isMedium;
    }

    return !isShort && !isMedium;
  }

  private getTeamNameEntryOrder(key: string): number {
    const suffixMatch = key.match(/(\d+)(?!.*\d)/u);
    return suffixMatch ? Number(suffixMatch[1]) : Number.MAX_SAFE_INTEGER;
  }

  private entryMatchesTeamIdSuffix(key: string, teamId: number): boolean {
    return this.getTeamNameEntryOrder(key) === teamId;
  }

  private getTeamIndexById(teamId: number): number {
    return this.teamEditorService.teamOptions.findIndex((option) => this.teamEditorService.getTeam(option.offset).teamId === teamId);
  }

  private getTeamDisplayLabel(teamId: number): string {
    return this.getTeamShortName(teamId)
      ?? this.getTeamMediumName(teamId)
      ?? this.getTeamLongName(teamId)
      ?? `Team ${teamId}`;
  }

  private withHexColorChannel(currentHex: string, channelIndex: 0 | 1 | 2, value: string | number): string {
    const normalizedValue = this.normalizeHexColor(currentHex) ?? '#000000';
    const channels = [
      this.getHexColorChannel(normalizedValue, 0),
      this.getHexColorChannel(normalizedValue, 1),
      this.getHexColorChannel(normalizedValue, 2)
    ];
    channels[channelIndex] = this.clampColorChannel(value);

    return `#${channels.map((channel) => channel.toString(16).toUpperCase().padStart(2, '0')).join('')}`;
  }

  private clampColorChannel(value: string | number): number {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Math.max(0, Math.min(255, Math.round(numericValue)));
  }

  private normalizeHexColor(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    return /^#[0-9A-Fa-f]{6}$/.test(normalizedValue) ? normalizedValue.toUpperCase() : null;
  }

  private resolveImportedHeadshotUrl(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return null;
    }

    if (/^(https?:|data:|blob:)/i.test(normalizedValue) || normalizedValue.startsWith('/')) {
      return normalizedValue;
    }

    if (normalizedValue.startsWith('assets/')) {
      return normalizedValue;
    }

    if (this.importSourceFileName.startsWith('assets/')) {
      const lastSlashIndex = this.importSourceFileName.lastIndexOf('/');
      const basePath = lastSlashIndex >= 0 ? this.importSourceFileName.slice(0, lastSlashIndex + 1) : '';
      return `${basePath}${normalizedValue}`;
    }

    return normalizedValue;
  }

  private getTeamSelectLabel(teamId: number): string {
    return `${this.getTeamDisplayLabel(teamId)} (ID ${teamId})`;
  }

  private getTeamLongDisplayLabel(teamId: number): string {
    return this.getTeamLongName(teamId)
      ?? this.getTeamMediumName(teamId)
      ?? this.getTeamShortName(teamId)
      ?? `Team ${teamId}`;
  }

  private getTeamLongSelectLabel(teamId: number): string {
    return `${this.getTeamLongDisplayLabel(teamId)} (ID ${teamId})`;
  }

  private replaceDisplayedTeam(offset: number, updatedTeam: TeamRecord): void {
    this.syncTeamsDatRolesForTeam(updatedTeam);
    this.syncTeamsDatRatingsForTeam(updatedTeam);

    const decoratedTeam = this.decorateTeamWithPlayerNames(updatedTeam);
    this.displayedTeams = this.displayedTeams.map((team) => team.offset === offset ? decoratedTeam : team);
    this.rebuildRoleSelectOptions();
    this.invalidateDbBrowsePlayers();
    this.invalidateTeamBrowseItems();

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

    this.invalidateDbBrowsePlayers();
    this.invalidateTeamBrowseItems();
  }

  private invalidateDbBrowsePlayers(): void {
    this.dbBrowsePlayersDirty = true;
  }

  private invertPlayerFootValue(foot: number): number {
    if (foot === 0) {
      return 1;
    }

    if (foot === 1) {
      return 0;
    }

    return foot;
  }

  private ensureDbBrowsePlayers(): void {
    if (!this.dbBrowsePlayersDirty) {
      return;
    }

    this.refreshDbBrowsePlayers();
  }

  private invalidateTeamBrowseItems(): void {
    this.teamBrowseItemsDirty = true;
  }

  private ensureTeamBrowseItems(): void {
    if (!this.teamBrowseItemsDirty) {
      return;
    }

    this.rebuildTeamBrowseItems();
  }

  private refreshDbBrowsePlayers(): void {
    if (!this.fileLoaded) {
      this.dbBrowsePlayers = [];
      this.dbBrowsePlayersDirty = false;
      this.resetDbBrowsePagination();
      return;
    }

    const clubMap = this.teamFileLoaded
      ? this.teamEditorService.getPlayerClubMap((teamId) => this.getTeamLongDisplayLabel(teamId))
      : new Map<number, string[]>();
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

    this.dbBrowsePlayersDirty = false;
    this.resetDbBrowsePagination();
  }

  private decorateTeamsWithPlayerNames(teams: TeamRecord[]): TeamRecord[] {
    return teams.map((team) => this.decorateTeamWithPlayerNames(team));
  }

  private refreshTeamImportPreview(): void {
    if (!this.teamImportCsvTeam) {
      this.teamImportPreviewPlayersCache = [];
      this.teamImportMappedPreviewCache = [];
      return;
    }

    const previewPlayers = this.playerImportService.filterByTeam(this.importedPlayers, this.teamImportCsvTeam);
    this.teamImportPreviewPlayersCache = previewPlayers;

    if (!this.fileLoaded) {
      this.teamImportMappedPreviewCache = [];
      return;
    }

    this.teamImportMappedPreviewCache = this.getResolvedTeamImportPlayers().map((player) => ({
      shortName: player.shortName,
      futureIndex: player.playerIndex,
      futureHexId: player.futureHexId,
      positionLabel: player.positionLabel,
      ovr: player.ovr
    }));
  }

  private decorateTeamWithPlayerNames(team: TeamRecord): TeamRecord {
    const teamShortName = this.getTeamShortName(team.teamId);
    const teamMediumName = this.getTeamMediumName(team.teamId);
    const teamLongName = this.getTeamLongName(team.teamId);
    const teamLabel = teamShortName ?? teamMediumName ?? teamLongName ?? `Team ${team.teamId}`;

    return {
      ...team,
      teamLabel,
      teamShortName,
      teamLongName,
      slots: team.slots.map((slot) => ({
        ...slot,
        playerName: this.resolveTeamSlotPlayerName(slot)
      }))
    };
  }

  private logDisplayedTeamNameSummary(): void {
    if (!this.xlcLoaded || this.displayedTeams.length === 0) {
      return;
    }

    this.displayedTeams.forEach((team) => {
      console.log('[TeamNames]', {
        teamId: team.teamId,
        teamNameLong: team.teamLongName ?? null,
        teamNameShort: team.teamShortName ?? null
      });
    });
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

    for (let playerId = 0; playerId < this.bulkImportDummyPlayerCount; playerId += 1) {
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
      excludedFromExhibition: 0,
      hiddenFromTransferMarket: 0, isIconLegend: 0,
      birthDay: 0, birthMonth: 0, year: 0,
      skin: 0, skin_tone: 255, head_type: 0, hair_type: 0, hair: 0, beard_type: 0,
      boots: 0, mangas: 255, guantes: 5,
      ACC: 0, SPD: 0, STA: 0, STR: 0, TAC: 0, CON: 0, SHO: 0,
      CRO: 0, FK: 0, PAS: 0, HEA: 0, GKS: 0, GKH: 0, GKP: 0
    };
  }

  private createNewPlayerDraft(): Player {
    return {
      ...this.emptyPlayer(),
      ACC: 40,
      SPD: 40,
      STA: 40,
      STR: 40,
      TAC: 40,
      CON: 40,
      SHO: 40,
      CRO: 40,
      FK: 40,
      PAS: 40,
      HEA: 40,
      GKS: 40,
      GKH: 40,
      GKP: 40
    };
  }

  private createBulkImportDummyPlayers(templatePlayer: Player): Player[] {
    return Array.from({ length: this.bulkImportDummyPlayerCount }, (_, index) => ({
      ...templatePlayer,
      name: `dummy${index + 1}`,
      ACC: 40,
      SPD: 40,
      STA: 40,
      STR: 40,
      TAC: 40,
      CON: 40,
      SHO: 40,
      CRO: 40,
      FK: 40,
      PAS: 40,
      HEA: 40,
      GKS: 40,
      GKH: 40,
      GKP: 40
    }));
  }
}
