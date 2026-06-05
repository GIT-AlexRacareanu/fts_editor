export interface TeamSlot {
  index: number;
  playerId: number;
  playerIdHex: string;
  tacticalByte: number;
  isStarter: boolean;
  isCaptain: boolean;
  isPenaltyTaker: boolean;
  isFreeKickTaker: boolean;
  isLeftCornerTaker: boolean;
  isRightCornerTaker: boolean;
  shirtNumber: number;
  position: number;
  isEmpty: boolean;
  playerName?: string;
}

export interface TeamRecord {
  offset: number;
  teamId: number;
  teamLabel: string;
  playerCount: number;
  slots: TeamSlot[];
}

export interface TeamOption {
  offset: number;
  label: string;
}