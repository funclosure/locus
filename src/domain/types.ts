import type {
  CandidateStatus,
  CompanyStatus,
  MemoryKind,
  NoteKind,
  PreferenceKind,
  PreferenceSource,
  RemotePolicy,
  RoleStatus,
  SessionStatus,
  SourceType,
  TargetType,
} from "./enums.js";

export type Timestamp = string;
export type NullableScore = number | null;

export type Profile = {
  id: number;
  name: string;
  summary: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ProfilePreference = {
  id: number;
  profileId: number;
  kind: PreferenceKind;
  label: string;
  description: string;
  weight: NullableScore;
  source: PreferenceSource;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Session = {
  id: number;
  profileId: number;
  title: string;
  goal: string;
  status: SessionStatus;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  summary: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type SessionMemory = {
  id: number;
  sessionId: number;
  kind: MemoryKind;
  content: string;
  confidence: NullableScore;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type PreferenceCandidate = {
  id: number;
  sessionId: number;
  profileId: number;
  kind: PreferenceKind;
  label: string;
  description: string;
  confidence: NullableScore;
  status: CandidateStatus;
  createdAt: Timestamp;
  reviewedAt: Timestamp | null;
};

export type Company = {
  id: number;
  name: string;
  url: string | null;
  hq: string | null;
  summary: string | null;
  primaryLabel: string | null;
  status: CompanyStatus;
  fitScore: NullableScore;
  fitAssessment: string | null;
  lastCheckedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Role = {
  id: number;
  companyId: number;
  title: string;
  url: string | null;
  location: string | null;
  remotePolicy: RemotePolicy;
  seniority: string | null;
  compensation: string | null;
  summary: string | null;
  status: RoleStatus;
  fitScore: NullableScore;
  fitAssessment: string | null;
  lastCheckedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Note = {
  id: number;
  sessionId: number | null;
  targetType: TargetType | null;
  targetId: number | null;
  title: string | null;
  body: string;
  kind: NoteKind;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Evidence = {
  id: number;
  targetType: TargetType;
  targetId: number;
  url: string;
  title: string | null;
  snippet: string;
  sourceType: SourceType;
  confidence: NullableScore;
  checkedAt: Timestamp;
  createdAt: Timestamp;
};
