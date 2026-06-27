export const companyStatuses = ["researching", "shortlisted", "watching", "rejected", "archived"] as const;
export type CompanyStatus = (typeof companyStatuses)[number];

export const roleStatuses = ["researching", "interested", "applied", "rejected", "closed", "archived"] as const;
export type RoleStatus = (typeof roleStatuses)[number];

export const sessionStatuses = ["active", "paused", "completed", "archived"] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const candidateStatuses = ["pending", "approved", "rejected", "superseded"] as const;
export type CandidateStatus = (typeof candidateStatuses)[number];

export const preferenceKinds = ["requirement", "positive_signal", "negative_signal", "interest", "constraint"] as const;
export type PreferenceKind = (typeof preferenceKinds)[number];

export const memoryKinds = ["observation", "inference", "decision", "question", "summary"] as const;
export type MemoryKind = (typeof memoryKinds)[number];

export const noteKinds = ["observation", "decision", "question", "summary"] as const;
export type NoteKind = (typeof noteKinds)[number];

export const sourceTypes = ["company_site", "job_post", "article", "social", "docs", "manual", "other"] as const;
export type SourceType = (typeof sourceTypes)[number];

export const remotePolicies = ["remote", "hybrid", "onsite", "unknown"] as const;
export type RemotePolicy = (typeof remotePolicies)[number];

export const targetTypes = ["profile", "session", "company", "role", "preference", "preference_candidate"] as const;
export type TargetType = (typeof targetTypes)[number];

export const preferenceSources = ["manual", "approved_candidate", "import"] as const;
export type PreferenceSource = (typeof preferenceSources)[number];
