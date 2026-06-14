export interface TeamsDatKitColor {
  colorIndex: number;
  label: string;
  byteOffset: number;
  fileOffset: number;
  hex: string;
  rawHex: string;
}

export interface TeamsDatKit {
  kitIndex: number;
  label: string;
  styleId: number;
  styleLabel: string;
  styleByteOffset: number;
  styleFileOffset: number;
  colors: TeamsDatKitColor[];
}

export interface TeamsDatRecord {
  index: number;
  blockStart: number;
  teamId: number;
  teamLabel: string;
  leagueId: number;
  rivalId: number;
  attackOvr: number;
  midfieldOvr: number;
  defenseOvr: number;
  formationId: number;
  captainRole: number;
  leftCornerRole: number;
  rightCornerRole: number;
  penaltyRole: number;
  freeKickRole: number;
  region: string;
  stadiumName: string;
  sponsorType: number;
  kitManufacturer: number;
  europeanCompetition: number;
  kits: TeamsDatKit[];
}
