export type RoutineType = 'MEDICINE' | 'WATER' | 'BP' | 'SUGAR' | 'WALK' | 'WELLBEING';
export type ConsentStatus = 'PENDING' | 'GRANTED' | 'DECLINED' | 'REVOKED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsappAlerts: boolean;
  timezone: string | null;
}

export interface ParentSummary {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  consentStatus: ConsentStatus;
  timezone: string;
  language?: Language;
}

export type Frequency = 'DAILY' | 'WEEKLY' | 'INTERVAL' | 'MONTHLY';

export interface ScheduleFields {
  frequency: Frequency;
  daysOfWeek: number[];
  intervalDays: number | null;
  dayOfMonth: number | null;
}

export interface CareFields {
  followUpMinutes: number | null;
  alertAfterMinutes: number | null;
}

export interface Routine extends ScheduleFields, CareFields {
  id: string;
  medicineId: string | null;
  type: RoutineType;
  name: string;
  timeOfDay: string;
  startDate: string | null;
  target: number | null;
  active: boolean;
}

export interface RoutineInput extends ScheduleFields, CareFields {
  type: RoutineType;
  medicineId?: string | null;
  name: string;
  timeOfDay: string;
  target?: number | null;
}

export interface AppNotification {
  id: string;
  kind: 'NOT_DONE' | 'RESOLVED' | 'SILENCE' | 'HELP' | 'REPORT' | 'SYMPTOM' | 'REFILL' | 'APPOINTMENT' | 'TEAM';
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  whatsappAt: string | null;
  parentId: string;
  parent: { name: string };
}

export type ScheduleStatus = 'planned' | 'upcoming' | 'waiting' | 'done' | 'not_done' | 'no_response';

export interface WeekSchedule {
  weekStart: string;
  weekEnd: string;
  today: string;
  days: {
    date: string;
    items: {
      routineId: string;
      occurrenceId: string | null;
      name: string;
      type: RoutineType;
      time: string;
      status: ScheduleStatus;
      sentAt: string | null;
      followUpAt: string | null;
      respondedAt: string | null;
      childAlertedAt: string | null;
      note: string | null;
    }[];
  }[];
  routines: { id: string; name: string; type: RoutineType; time: string; schedule: string }[];
  totals: { reminders: number; sent: number; done: number; notDone: number; noResponse: number; waiting: number; ahead: number; followUps: number; childAlerts: number };
}

export type TodayStatus = 'upcoming' | 'waiting' | 'done' | 'not_done' | 'no_response' | 'not_today';

export interface Today {
  parent: ParentSummary;
  date: string;
  lastInboundAt: string | null;
  routines: {
    id: string;
    type: RoutineType;
    name: string;
    timeOfDay: string;
    target: number | null;
    status: TodayStatus;
    note: string | null;
    respondedAt: string | null;
    latest: string | null;
    lastReportedAt: string | null;
    daysSinceReport: number | null;
    schedule: string;
    nextDue: string | null;
    sentAt: string | null;
    followUpAt: string | null;
    childAlertedAt: string | null;
  }[];
  attention: { kind: string; text: string }[];
  symptoms: { name: string; since: string | null; at: string }[];
  alerts: { id: string; kind: string; createdAt: string }[];
  urgent: { text: string; at: string }[];
  latestReadings: {
    bp: { value: string; at: string } | null;
    sugar: { value: string; at: string } | null;
    weight: { value: string; at: string } | null;
    waterToday: { glasses: number; goal: number | null; at: string } | null;
  };
  appointments: { id: string; title: string; place: string | null; at: string }[];
  pinnedNotes: { id: string; text: string; author: string | null }[];
}


export interface ChatMessage {
  id: string;
  direction: 'IN' | 'OUT';
  body: string;
  kind: string;
  buttons: { id: string; title: string }[] | null;
  payload: string | null;
  handledBy: string | null;
  toPhone: string | null;
  createdAt: string;
}

export interface FamilyMember extends ParentSummary {
  lastInboundAt: string | null;
  today: { done: number; total: number; routines: { type: RoutineType; name: string; status: TodayStatus; latest: string | null; childAlertedAt: string | null }[] };
  attention: number;
  alerts: number;
  urgent: { text: string; at: string }[];
}

export type DayStatus = 'done' | 'not_done' | 'no_response' | 'waiting' | 'upcoming' | 'none';

export interface Trends {
  range: { from: string; to: string; days: number };
  dates: string[];
  bp: { at: string; date: string; systolic: number; diastolic: number; source: string }[];
  sugar: { at: string; date: string; value: number; context: string | null; source: string }[];
  weight: { at: string; date: string; value: number; source: string }[];
  water: { date: string; glasses: number | null }[];
  waterTarget: number | null;
  wellbeing: { date: string; level: 'good' | 'okay' | 'low' | null }[];
  adherence: { id: string; name: string; type: RoutineType; days: { date: string; status: DayStatus; note: string | null }[] }[];
  symptoms: { name: string; count: number; days: string[] }[];
  stats: {
    medicine: { done: number; closed: number } | null;
    medicinePrev: { done: number; closed: number } | null;
    streak: number;
    bpReadings: number;
    waterAvg: number | null;
    waterDays: number;
    daysHeardFrom: number;
  };
}


export interface HealthRecord {
  id: string;
  type: 'MEDICINE' | 'BP' | 'SUGAR' | 'WATER' | 'WEIGHT' | 'WALK' | 'WELLBEING' | 'SYMPTOM';
  valueNum: number | null;
  valueNum2: number | null;
  valueText: string | null;
  unit: string | null;
  context: string | null;
  occurredAt: string;
  source: 'BUTTON' | 'RULES' | 'LLM' | 'DASHBOARD';
  message: { body: string } | null;
  occurrence: { routine: { name: string } } | null;
}

export interface ParentProfile {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  timezone: string;
  emergencyNumber: string;
  language: Language;
  isOwner: boolean;
  ownerName: string;
  consentStatus: ConsentStatus;
  consentAt: string | null;
  createdAt: string;
}

export interface AskAnswer {
  answer: string;
  facts: string[];
  usedModel: boolean;
}

export interface WeeklyReport {
  parent: { id: string; name: string; relationship: string };
  child: string;
  week: { start: string; end: string; isCurrent: boolean; days: string[]; comparedTo: string };
  summary: string;
  glance: {
    medicine: { done: number; asked: number; notYet: number; noReply: number; change: string | null };
    bp: { count: number; change: string | null };
    water: { avg: number | null; goal: number | null; days: number; change: string | null };
    walk: { done: number; asked: number; notYet: number; noReply: number; change: string | null };
  };
  reminders: { id: string; name: string; type: RoutineType; time: string; done: number; asked: number; notYet: number; noReply: number }[];
  readings: {
    bp: { list: { at: string; date: string; value: number; value2: number | null; source: string }[]; systolic: { min: number; max: number } | null; diastolic: { min: number; max: number } | null };
    sugar: { list: { at: string; date: string; value: number; context: string | null }[]; range: { min: number; max: number } | null };
    weight: { list: { at: string; date: string; value: number }[] };
  };
  water: { byDay: { date: string; glasses: number | null }[]; avg: number | null; goal: number | null };
  feelings: { date: string; level: 'good' | 'okay' | 'low' | null }[];
  symptoms: { name: string; count: number; days: string[]; since: string | null }[];
  changes: string[];
  missing: string[];
  contact: { daysHeardFrom: number; helpAlerts: number; notDoneAlerts: number };
}

export type Language = 'HINGLISH' | 'HINDI' | 'ENGLISH';
export const LANGUAGE_LABEL: Record<Language, string> = { HINGLISH: 'Hinglish', HINDI: 'हिंदी (Hindi)', ENGLISH: 'English' };

export interface Medicine {
  id: string;
  name: string;
  dose: string | null;
  instructions: string | null;
  prescribedBy: string | null;
  pillsLeft: number | null;
  pillsPerDose: number;
  refillAlertDays: number;
  refilledAt: string | null;
  active: boolean;
  daysLeft: number | null;
  routines: Routine[];
}

export interface Appointment {
  id: string;
  title: string;
  place: string | null;
  at: string;
  notes: string | null;
  remindParent: boolean;
  status: 'UPCOMING' | 'DONE' | 'CANCELLED';
}

export interface CareNote {
  id: string;
  text: string;
  pinned: boolean;
  createdAt: string;
  author: { id: string; name: string } | null;
}

export interface Team {
  isOwner: boolean;
  me: string;
  owner: { id: string; name: string; email: string };
  members: { id: string; name: string; email: string; since: string }[];
  invites: { id: string; email: string; createdAt: string; expiresAt: string; link: string }[];
}

export interface DoctorReport {
  parent: { name: string; relationship: string };
  preparedBy: string[];
  generatedAt: string;
  range: { from: string; to: string; days: number };
  medicines: { name: string; dose: string | null; instructions: string | null; prescribedBy: string | null; reminders: string[]; taken: { done: number; notYet: number; noReply: number } }[];
  readings: {
    bp: { at: string; value: string; context: string | null }[];
    bpStats: { systolic: Stats | null; diastolic: Stats | null } | null;
    sugar: { at: string; value: number; context: string | null }[];
    sugarStats: Stats | null;
    weight: { at: string; value: number }[];
  };
  symptoms: { at: string; name: string | null; since: string | null; words: string | null }[];
  wellbeing: { good: number; okay: number; low: number };
  appointments: { at: string; title: string; place: string | null; status: string; notes: string | null }[];
  notes: { text: string; pinned: boolean; at: string; author: string | null }[];
}
export interface Stats { min: number; max: number; avg: number }
