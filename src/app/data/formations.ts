export const POSITION_IDS = {
  GK: 0,
  LB: 1,
  RB: 2,
  LSW: 3,
  RSW: 4,
  LCB: 5,
  CB: 6,
  RCB: 7,
  CDM: 8,
  RDM: 9,
  LDM: 10,
  CM: 11,
  LCM: 12,
  RCM: 13,
  LAM: 14,
  RAM: 15,
  RM: 16,
  LM: 17,
  CAM: 18,
  ST: 19,
  LW: 20,
  RW: 21,
  CF: 22
} as const;

export interface FormationSlotDefinition {
  lane: number;
  positions: number[];
}

export interface FormationLineDefinition {
  slots: FormationSlotDefinition[];
}

export interface FormationPreset {
  value: string;
  label: string;
  lines: FormationLineDefinition[];
}

const P = POSITION_IDS;

const leftBack = [P.LB, P.LM, P.LSW, P.LDM];
const rightBack = [P.RB, P.RM, P.RSW, P.RDM];
const leftCenterBack = [P.LCB, P.CB, P.LSW, P.CDM];
const centerBack = [P.CB, P.LCB, P.RCB, P.CDM];
const rightCenterBack = [P.RCB, P.CB, P.RSW, P.CDM];
const sweeper = [P.CB, P.LCB, P.RCB, P.CDM, P.CM];

const leftHolding = [P.LDM, P.CDM, P.LCM, P.CM, P.LM];
const centerHolding = [P.CDM, P.LDM, P.RDM, P.CM, P.LCM, P.RCM];
const rightHolding = [P.RDM, P.CDM, P.RCM, P.CM, P.RM];

const leftMid = [P.LM, P.LCM, P.CM, P.LAM, P.LW];
const leftCentralMid = [P.LCM, P.CM, P.LDM, P.CDM, P.LM];
const centerMid = [P.CM, P.LCM, P.RCM, P.CDM, P.LDM, P.RDM];
const rightCentralMid = [P.RCM, P.CM, P.RDM, P.CDM, P.RM];
const rightMid = [P.RM, P.RCM, P.CM, P.RAM, P.RW];

const leftAttackingMid = [P.LAM, P.LW, P.LM, P.CAM, P.CF];
const centerAttackingMid = [P.CAM, P.CF, P.CM, P.ST, P.LAM, P.RAM];
const rightAttackingMid = [P.RAM, P.RW, P.RM, P.CAM, P.CF];

const leftWing = [P.LW, P.LAM, P.LM, P.CF, P.ST];
const leftStriker = [P.ST, P.CF, P.LW, P.LAM, P.CAM];
const centerForward = [P.CF, P.ST, P.CAM, P.LAM, P.RAM];
const striker = [P.ST, P.CF, P.CAM, P.LAM, P.RAM];
const rightStriker = [P.ST, P.CF, P.RW, P.RAM, P.CAM];
const rightWing = [P.RW, P.RAM, P.RM, P.CF, P.ST];

export const FORMATION_PRESETS: FormationPreset[] = [
  {
    value: '4-3-3',
    label: '4 3 3',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftCentralMid }, { lane: 2, positions: centerMid }, { lane: 3, positions: rightCentralMid }] },
      { slots: [{ lane: 0, positions: leftWing }, { lane: 2, positions: striker }, { lane: 4, positions: rightWing }] }
    ]
  },
  {
    value: '4-2-4',
    label: '4 2 4',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftHolding }, { lane: 3, positions: rightHolding }] },
      { slots: [{ lane: 0, positions: leftWing }, { lane: 1, positions: leftStriker }, { lane: 3, positions: rightStriker }, { lane: 4, positions: rightWing }] }
    ]
  },
  {
    value: '5-4-1',
    label: '5 4 1',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 2, positions: centerBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 0, positions: leftMid }, { lane: 1, positions: leftCentralMid }, { lane: 3, positions: rightCentralMid }, { lane: 4, positions: rightMid }] },
      { slots: [{ lane: 2, positions: striker }] }
    ]
  },
  {
    value: '5-3-2',
    label: '5 3 2',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 2, positions: centerBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftCentralMid }, { lane: 2, positions: centerMid }, { lane: 3, positions: rightCentralMid }] },
      { slots: [{ lane: 1, positions: leftStriker }, { lane: 3, positions: rightStriker }] }
    ]
  },
  {
    value: '3-5-2',
    label: '3 5 2',
    lines: [
      { slots: [{ lane: 1, positions: leftCenterBack }, { lane: 2, positions: centerBack }, { lane: 3, positions: rightCenterBack }] },
      { slots: [{ lane: 0, positions: leftMid }, { lane: 1, positions: leftCentralMid }, { lane: 2, positions: centerMid }, { lane: 3, positions: rightCentralMid }, { lane: 4, positions: rightMid }] },
      { slots: [{ lane: 1, positions: leftStriker }, { lane: 3, positions: rightStriker }] }
    ]
  },
  {
    value: '3-4-3',
    label: '3 4 3',
    lines: [
      { slots: [{ lane: 1, positions: leftCenterBack }, { lane: 2, positions: centerBack }, { lane: 3, positions: rightCenterBack }] },
      { slots: [{ lane: 0, positions: leftMid }, { lane: 1, positions: leftCentralMid }, { lane: 3, positions: rightCentralMid }, { lane: 4, positions: rightMid }] },
      { slots: [{ lane: 0, positions: leftWing }, { lane: 2, positions: striker }, { lane: 4, positions: rightWing }] }
    ]
  },
  {
    value: '4-5-1',
    label: '4 5 1',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 0, positions: leftMid }, { lane: 1, positions: leftCentralMid }, { lane: 2, positions: centerMid }, { lane: 3, positions: rightCentralMid }, { lane: 4, positions: rightMid }] },
      { slots: [{ lane: 2, positions: striker }] }
    ]
  },
  {
    value: '4-2-3-1-a',
    label: '4 2 3 1 (a)',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftHolding }, { lane: 3, positions: rightHolding }] },
      { slots: [{ lane: 0, positions: leftAttackingMid }, { lane: 4, positions: rightAttackingMid }] },
      { slots: [{ lane: 2, positions: centerAttackingMid }] },
      { slots: [{ lane: 2, positions: striker }] }
    ]
  },
  {
    value: '4-2-3-1-b',
    label: '4 2 3 1 (b)',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftHolding }, { lane: 3, positions: rightHolding }] },
      { slots: [{ lane: 0, positions: leftAttackingMid }, { lane: 4, positions: rightAttackingMid }] },
      { slots: [{ lane: 2, positions: centerAttackingMid }] },
      { slots: [{ lane: 2, positions: striker }] }
    ]
  },
  {
    value: '4-3-1-2',
    label: '4 3 1 2',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftCentralMid }, { lane: 2, positions: centerMid }, { lane: 3, positions: rightCentralMid }] },
      { slots: [{ lane: 2, positions: centerAttackingMid }] },
      { slots: [{ lane: 1, positions: leftStriker }, { lane: 3, positions: rightStriker }] }
    ]
  },
  {
    value: '4-4-1-1-a',
    label: '4 4 1 1 (a)',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 0, positions: leftMid }, { lane: 1, positions: leftCentralMid }, { lane: 3, positions: rightCentralMid }, { lane: 4, positions: rightMid }] },
      { slots: [{ lane: 2, positions: centerForward }] },
      { slots: [{ lane: 2, positions: striker }] }
    ]
  },
  {
    value: '4-4-1-1-b',
    label: '4 4 1 1 (b)',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftCentralMid }, { lane: 2, positions: centerMid }, { lane: 3, positions: rightCentralMid }, { lane: 4, positions: rightMid }] },
      { slots: [{ lane: 2, positions: centerAttackingMid }] },
      { slots: [{ lane: 2, positions: striker }] }
    ]
  },
  {
    value: '3-4-1-2',
    label: '3 4 1 2',
    lines: [
      { slots: [{ lane: 1, positions: leftCenterBack }, { lane: 2, positions: centerBack }, { lane: 3, positions: rightCenterBack }] },
      { slots: [{ lane: 0, positions: leftMid }, { lane: 1, positions: leftCentralMid }, { lane: 3, positions: rightCentralMid }, { lane: 4, positions: rightMid }] },
      { slots: [{ lane: 2, positions: centerAttackingMid }] },
      { slots: [{ lane: 1, positions: leftStriker }, { lane: 3, positions: rightStriker }] }
    ]
  },
  {
    value: '4-1-2-1-2',
    label: '4 1 2 1 2',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 2, positions: centerHolding }] },
      { slots: [{ lane: 1, positions: leftCentralMid }, { lane: 3, positions: rightCentralMid }] },
      { slots: [{ lane: 2, positions: centerAttackingMid }] },
      { slots: [{ lane: 1, positions: leftStriker }, { lane: 3, positions: rightStriker }] }
    ]
  },
  {
    value: '1-4-3-2',
    label: '1 4 3 2',
    lines: [
      { slots: [{ lane: 2, positions: sweeper }] },
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftCentralMid }, { lane: 2, positions: centerMid }, { lane: 3, positions: rightCentralMid }] },
      { slots: [{ lane: 1, positions: leftStriker }, { lane: 3, positions: rightStriker }] }
    ]
  },
  {
    value: '3-4-2-1',
    label: '3 4 2 1',
    lines: [
      { slots: [{ lane: 1, positions: leftCenterBack }, { lane: 2, positions: centerBack }, { lane: 3, positions: rightCenterBack }] },
      { slots: [{ lane: 0, positions: leftMid }, { lane: 1, positions: leftCentralMid }, { lane: 3, positions: rightCentralMid }, { lane: 4, positions: rightMid }] },
      { slots: [{ lane: 1, positions: leftAttackingMid }, { lane: 3, positions: rightAttackingMid }] },
      { slots: [{ lane: 2, positions: striker }] }
    ]
  },
  {
    value: '4-3-2-1',
    label: '4 3 2 1',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftCentralMid }, { lane: 2, positions: centerMid }, { lane: 3, positions: rightCentralMid }] },
      { slots: [{ lane: 1, positions: leftAttackingMid }, { lane: 3, positions: rightAttackingMid }] },
      { slots: [{ lane: 2, positions: striker }] }
    ]
  },
  {
    value: '5-2-1-2',
    label: '5 2 1 2',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 2, positions: centerBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftHolding }, { lane: 3, positions: rightHolding }] },
      { slots: [{ lane: 2, positions: centerAttackingMid }] },
      { slots: [{ lane: 1, positions: leftStriker }, { lane: 3, positions: rightStriker }] }
    ]
  },
  {
    value: '5-2-2-1',
    label: '5 2 2 1',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 2, positions: centerBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 1, positions: leftHolding }, { lane: 3, positions: rightHolding }] },
      { slots: [{ lane: 1, positions: leftAttackingMid }, { lane: 3, positions: rightAttackingMid }] },
      { slots: [{ lane: 2, positions: striker }] }
    ]
  },
  {
    value: '4-4-2',
    label: '4 4 2',
    lines: [
      { slots: [{ lane: 0, positions: leftBack }, { lane: 1, positions: leftCenterBack }, { lane: 3, positions: rightCenterBack }, { lane: 4, positions: rightBack }] },
      { slots: [{ lane: 0, positions: leftMid }, { lane: 1, positions: leftCentralMid }, { lane: 3, positions: rightCentralMid }, { lane: 4, positions: rightMid }] },
      { slots: [{ lane: 1, positions: leftStriker }, { lane: 3, positions: rightStriker }] }
    ]
  }
];