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
}
