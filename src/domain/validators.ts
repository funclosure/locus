import { z } from "zod";
import {
  companyStatuses,
  memoryKinds,
  noteKinds,
  remotePolicies,
  roleStatuses,
  sourceTypes,
  targetTypes,
} from "./enums.js";

const trimmedString = z.string().trim().min(1);
const nullableTrimmedString = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const scoreSchema = z.coerce.number().min(0).max(1).nullable();
export const confidenceSchema = scoreSchema;
export const fitScoreSchema = scoreSchema;

export const sessionStartInputSchema = z.object({
  profileId: z.coerce.number().int().positive().default(1),
  title: nullableTrimmedString,
  goal: trimmedString,
});

export const companyInputSchema = z.object({
  name: trimmedString,
  url: nullableTrimmedString,
  hq: nullableTrimmedString,
  summary: nullableTrimmedString,
  primaryLabel: nullableTrimmedString,
  status: z.enum(companyStatuses).default("researching"),
  fitScore: fitScoreSchema.default(null),
  fitAssessment: nullableTrimmedString,
});

export const roleInputSchema = z.object({
  companyId: z.coerce.number().int().positive(),
  title: trimmedString,
  url: nullableTrimmedString,
  location: nullableTrimmedString,
  remotePolicy: z.enum(remotePolicies).default("unknown"),
  seniority: nullableTrimmedString,
  compensation: nullableTrimmedString,
  summary: nullableTrimmedString,
  status: z.enum(roleStatuses).default("researching"),
  fitScore: fitScoreSchema.default(null),
  fitAssessment: nullableTrimmedString,
});

export const noteInputSchema = z.object({
  sessionId: z.coerce.number().int().positive().nullable().optional().default(null),
  targetType: z.enum(targetTypes).nullable().optional().default(null),
  targetId: z.coerce.number().int().positive().nullable().optional().default(null),
  title: nullableTrimmedString,
  body: trimmedString,
  kind: z.enum(noteKinds).default("observation"),
});

export const evidenceInputSchema = z.object({
  targetType: z.enum(targetTypes),
  targetId: z.coerce.number().int().positive(),
  url: z.string().trim().url(),
  title: nullableTrimmedString,
  snippet: trimmedString,
  sourceType: z.enum(sourceTypes).default("other"),
  confidence: confidenceSchema.default(null),
});

export const sessionMemoryInputSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  kind: z.enum(memoryKinds).default("observation"),
  content: trimmedString,
  confidence: confidenceSchema.default(null),
});

export type SessionStartInput = z.infer<typeof sessionStartInputSchema>;
export type CompanyInput = z.infer<typeof companyInputSchema>;
export type RoleInput = z.infer<typeof roleInputSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;
