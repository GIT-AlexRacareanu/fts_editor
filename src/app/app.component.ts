import { Component } from '@angular/core';
import { FORMATION_PRESETS, FormationPreset } from './data/formations';
import { NATIONALITY_NAMES_BY_ID, NATIONALITY_OPTIONS } from './data/nationalities';
import { Player } from './models/player.model';
import { TeamRecord, TeamSlot } from './models/team-editor.model';
import { PlayerService } from './services/player.service';
import { TeamEditorService } from './services/team-editor.service';

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
  dbSearchNameQuery = '';
  dbSearchNationalityQuery: number | null = null;
  dbBrowsePage = 1;
  selectedTeamOffset: number | null = null;
  displayedTeams: TeamRecord[] = [];
  draggedFormationPlayerSlotIndex: number | null = null;
  dbBrowsePlayers: DbBrowsePlayer[] = [];
  private readonly teamPlayerNameCache = new Map<number, string | null>();
  private readonly dbBrowsePageSize = 25;

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

  private readonly formationLaneLefts = ['14%', '31%', '50%', '69%', '86%'];

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

  async openFile(): Promise<void> {
    try {
      await this.playerService.loadFile();
      this.teamPlayerNameCache.clear();
      this.refreshDbBrowsePlayers();
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
      this.refreshDbBrowsePlayers();
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

  getFormationSketch(team: TeamRecord): FormationSketch {
    const usedPlayers = team.slots.filter((slot) => !slot.isEmpty);
    const starters = team.slots
      .filter((slot) => !slot.isEmpty)
      .slice(0, 11);

    if (starters.length === 0) {
      return {
        formation: this.formations[0],
        slots: [],
        reservePlayers: []
      };
    }

    return {
      ...this.detectBestFormation(starters),
      reservePlayers: usedPlayers.slice(11).map((player) => this.toSketchPlayer(player))
    };
  }

  trackSketchPlayer(_: number, player: FormationSketchPlayer): number {
    return player.slotIndex;
  }

  trackSketchSlot(_: number, slot: FormationSketchSlot): string {
    return slot.slotKey;
  }

  startFormationDrag(player: FormationSketchPlayer): void {
    this.draggedFormationPlayerSlotIndex = player.slotIndex;
  }

  allowFormationDrop(event: DragEvent): void {
    event.preventDefault();
  }

  clearFormationDrag(): void {
    this.draggedFormationPlayerSlotIndex = null;
  }

  dropOnFormationSlot(team: TeamRecord, formationSketch: FormationSketch, targetStarterIndex: number): void {
    this.moveDraggedPlayer(team, formationSketch, targetStarterIndex);
  }

  dropOnReservePlayer(team: TeamRecord, formationSketch: FormationSketch, reserveIndex: number): void {
    this.moveDraggedPlayer(team, formationSketch, formationSketch.slots.length + reserveIndex);
  }

  private moveDraggedPlayer(team: TeamRecord, formationSketch: FormationSketch, targetOrderIndex: number): void {
    if (this.draggedFormationPlayerSlotIndex === null) {
      this.clearFormationDrag();
      return;
    }

    const orderedUsedPlayers = [
      ...formationSketch.slots.map((slot) => slot.player).filter((player): player is FormationSketchPlayer => Boolean(player)),
      ...formationSketch.reservePlayers
    ];

    const previousIndex = orderedUsedPlayers.findIndex((player) => player.slotIndex === this.draggedFormationPlayerSlotIndex);

    if (previousIndex === -1 || targetOrderIndex < 0 || targetOrderIndex >= orderedUsedPlayers.length) {
      this.clearFormationDrag();
      return;
    }

    const reorderedPlayers = [...orderedUsedPlayers];
    const [movedPlayer] = reorderedPlayers.splice(previousIndex, 1);
    reorderedPlayers.splice(targetOrderIndex, 0, movedPlayer);

    const updatedTeam = this.teamEditorService.reorderUsedPlayers(
      team.offset,
      reorderedPlayers.map((player) => player.slotIndex),
      formationSketch.slots.map((slot) => slot.targetPosition)
    );

    this.replaceDisplayedTeam(team.offset, updatedTeam);
    this.clearFormationDrag();
  }

  private replaceDisplayedTeam(offset: number, updatedTeam: TeamRecord): void {
    const decoratedTeam = this.decorateTeamWithPlayerNames(updatedTeam);
    this.displayedTeams = this.displayedTeams.map((team) => team.offset === offset ? decoratedTeam : team);
    this.refreshDbBrowsePlayers();

    if (this.selectedTeamOffset === offset && !this.displayedTeams.some((team) => team.offset === offset)) {
      this.displayedTeams = [decoratedTeam];
    }
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

    this.dbBrowsePlayers = players;
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

  private detectBestFormation(players: TeamSlot[]): FormationSketch {
    const matches = this.formations.map((formation) => this.matchFormation(players, formation));
    const bestMatch = matches.sort((left, right) => left.score - right.score)[0];

    return {
      formation: bestMatch.formation,
      slots: bestMatch.slots,
      reservePlayers: []
    };
  }

  private matchFormation(players: TeamSlot[], formation: FormationPreset): FormationSketch & { score: number } {
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
      reservePlayers: [],
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
