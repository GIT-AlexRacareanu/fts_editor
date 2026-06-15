export interface XlcLocaleValue {
  localeId: number;
  localeLabel: string;
  offset: number;
  maxByteLength: number;
  originalByteLength: number;
  sharedReferenceCount: number;
  value: string;
}

export interface XlcEntry {
  index: number;
  key: string;
  locales: XlcLocaleValue[];
}