import type { RoutineType } from '@prisma/client';

/** A structured fact understood from a parent's message, before it is saved. */
export type Finding =
  | { kind: 'confirm'; done: boolean; routine?: RoutineType; note?: string }
  | { kind: 'bp'; systolic: number; diastolic: number }
  | { kind: 'sugar'; value: number; context?: 'fasting' | 'after meal' }
  | { kind: 'water'; glasses: number }
  | { kind: 'weight'; kg: number }
  | { kind: 'wellbeing'; level: 'good' | 'okay' | 'low' }
  | { kind: 'symptom'; name: string; since?: string };

export interface Understanding {
  findings: Finding[];
  /** False when rules may have missed something and a language model should take a look. */
  confident: boolean;
}

/**
 * Reject values a person could not have measured. This is input validation, not a medical judgement:
 * every plausible value is stored as reported.
 */
export function isPlausible(f: Finding): boolean {
  switch (f.kind) {
    case 'bp':
      return f.systolic >= 60 && f.systolic <= 260 && f.diastolic >= 30 && f.diastolic <= 160 && f.systolic > f.diastolic;
    case 'sugar':
      return f.value >= 20 && f.value <= 700;
    case 'water':
      return Number.isInteger(f.glasses) && f.glasses >= 0 && f.glasses <= 30;
    case 'weight':
      return f.kg >= 20 && f.kg <= 300;
    case 'symptom':
      return f.name.trim().length > 0 && f.name.length <= 60;
    default:
      return true;
  }
}
