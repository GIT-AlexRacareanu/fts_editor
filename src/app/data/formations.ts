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

function slot(lane: number, position: number): FormationSlotDefinition {
  return { lane, positions: [position] };
}

export const FORMATION_PRESETS: FormationPreset[] = [
  {
    value: '4-3-3',
    label: '4 3 3',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LCM), slot(2, P.CM), slot(3, P.RCM)] },
      { slots: [slot(0, P.LW), slot(2, P.ST), slot(4, P.RW)] }
    ]
  },
  {
    value: '4-2-4',
    label: '4 2 4',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LCM), slot(3, P.RCM)] },
      { slots: [slot(0, P.LW), slot(1, P.ST), slot(3, P.ST), slot(4, P.RW)] }
    ]
  },
  {
    value: '5-4-1',
    label: '5 4 1',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(2, P.CB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(0, P.LM), slot(1, P.LCM), slot(3, P.RCM), slot(4, P.RM)] },
      { slots: [slot(2, P.ST)] }
    ]
  },
  {
    value: '5-3-2',
    label: '5 3 2',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(2, P.CB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LCM), slot(2, P.CM), slot(3, P.RCM)] },
      { slots: [slot(0, P.LW), slot(4, P.RW)] }
    ]
  },
  {
    value: '3-5-2',
    label: '3 5 2',
    lines: [
      { slots: [slot(1, P.LCB), slot(2, P.CB), slot(3, P.RCB)] },
      { slots: [slot(0, P.LM), slot(1, P.LCM), slot(2, P.CM), slot(3, P.RCM), slot(4, P.RM)] },
      { slots: [slot(0, P.LW), slot(4, P.RW)] }
    ]
  },
  {
    value: '3-4-3',
    label: '3 4 3',
    lines: [
      { slots: [slot(1, P.LCB), slot(2, P.CB), slot(3, P.RCB)] },
      { slots: [slot(0, P.LM), slot(1, P.LCM), slot(3, P.RCM), slot(4, P.RM)] },
      { slots: [slot(0, P.LW), slot(2, P.ST), slot(4, P.RW)] }
    ]
  },
  {
    value: '4-5-1',
    label: '4 5 1',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(0, P.LM), slot(1, P.LCM), slot(2, P.CM), slot(3, P.RCM), slot(4, P.RM)] },
      { slots: [slot(2, P.ST)] }
    ]
  },
  {
    value: '4-2-3-1(a)',
    label: '4 2 3 1 (a)',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LDM), slot(3, P.RDM)] },
      { slots: [slot(0, P.LAM), slot(2, P.CAM), slot(4, P.RAM)] },
      { slots: [slot(2, P.ST)] }
    ]
  },
  {
    value: '4-2-3-1(b)',
    label: '4 2 3 1 (b)',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LCM), slot(3, P.RCM)] },
      { slots: [slot(0, P.LM), slot(2, P.CAM), slot(4, P.RM)] },
      { slots: [slot(2, P.ST)] }
    ]
  },
  {
    value: '4-3-1-2',
    label: '4 3 1 2',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LCM), slot(2, P.CM), slot(3, P.RCM)] },
      { slots: [slot(2, P.CAM)] },
      { slots: [slot(1, P.ST), slot(3, P.ST)] }
    ]
  },
  {
    value: '4-4-1-1(a)',
    label: '4 4 1 1 (a)',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(0, P.LM), slot(1, P.LCM), slot(3, P.RCM), slot(4, P.RM)] },
      { slots: [slot(2, P.CAM)] },
      { slots: [slot(2, P.ST)] }
    ]
  },
  {
    value: '4-4-1-1(b)',
    label: '4 4 1 1 (b)',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(0, P.LM), slot(1, P.LCM), slot(3, P.RCM), slot(4, P.RM)] },
      { slots: [slot(2, P.CF)] },
      { slots: [slot(2, P.ST)] }
    ]
  },
  {
    value: '3-4-1-2',
    label: '3 4 1 2',
    lines: [
      { slots: [slot(1, P.LCB), slot(2, P.CB), slot(3, P.RCB)] },
      { slots: [slot(0, P.LM), slot(1, P.LCM), slot(3, P.RCM), slot(4, P.RM)] },
      { slots: [slot(2, P.CAM)] },
      { slots: [slot(1, P.ST), slot(3, P.ST)] }
    ]
  },
  {
    value: '4-1-2-1-2',
    label: '4 1 2 1 2',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(2, P.CDM)] },
      { slots: [slot(1, P.LCM), slot(3, P.RCM)] },
      { slots: [slot(2, P.CAM)] },
      { slots: [slot(1, P.ST), slot(3, P.ST)] }
    ]
  },
  {
    value: '1-4-3-2',
    label: '1 4 3 2',
    lines: [
      { slots: [slot(2, P.CB)] },
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LCM), slot(2, P.CM), slot(3, P.RCM)] },
      { slots: [slot(1, P.ST), slot(3, P.ST)] }
    ]
  },
  {
    value: '3-4-2-1',
    label: '3 4 2 1',
    lines: [
      { slots: [slot(1, P.LCB), slot(2, P.CB), slot(3, P.RCB)] },
      { slots: [slot(0, P.LM), slot(1, P.LCM), slot(3, P.RCM), slot(4, P.RM)] },
      { slots: [slot(1, P.LAM), slot(3, P.RAM)] },
      { slots: [slot(2, P.ST)] }
    ]
  },
  {
    value: '4-3-2-1',
    label: '4 3 2 1',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LCM), slot(2, P.CDM), slot(3, P.RCM)] },
      { slots: [slot(1, P.LAM), slot(3, P.RAM)] },
      { slots: [slot(2, P.ST)] }
    ]
  },
  {
    value: '5-2-1-2',
    label: '5 2 1 2',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(2, P.CB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LDM), slot(3, P.RDM)] },
      { slots: [slot(2, P.CAM)] },
      { slots: [slot(1, P.ST), slot(3, P.ST)] }
    ]
  },
  {
    value: '5-2-2-1',
    label: '5 2 2 1',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(2, P.CB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(1, P.LDM), slot(3, P.RDM)] },
      { slots: [slot(1, P.LAM), slot(3, P.RAM)] },
      { slots: [slot(2, P.ST)] }
    ]
  },
  {
    value: '4-4-2',
    label: '4 4 2',
    lines: [
      { slots: [slot(0, P.LB), slot(1, P.LCB), slot(3, P.RCB), slot(4, P.RB)] },
      { slots: [slot(0, P.LM), slot(1, P.LCM), slot(3, P.RCM), slot(4, P.RM)] },
      { slots: [slot(1, P.ST), slot(3, P.ST)] }
    ]
  }
];