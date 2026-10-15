import type Database from "better-sqlite3";
import type { ApplicationStage } from "../domain/enums.js";
import type { Application, ApplicationEvent } from "../domain/types.js";
import { listApplicationEvents, listApplications } from "../repositories/applicationRepository.js";

// Does fit_score predict real outcomes? Advisory only: this reads application
// history and never changes scores, profile weights, or skill rules.

export const MIN_BAND_SIZE = 5;
const VERDICT_MARGIN = 0.15;

const OUTCOME_STAGES: ApplicationStage[] = ["interviewing", "offer", "rejected"];

const bands = [
  { label: "high", min: 0.75, max: 1 },
  { label: "mid", min: 0.5, max: 0.75 },
  { label: "low", min: 0, max: 0.5 },
] as const;

export type CalibrationVerdict = "separating" | "flat" | "inverted" | "insufficient";

export type CalibrationBand = {
  label: (typeof bands)[number]["label"];
  range: string;
  n: number;
  interviews: number;
  offers: number;
  // Null when n is below MIN_BAND_SIZE: too few cases to state a rate.
  interviewRate: number | null;
  offerRate: number | null;
};

export type CalibratedApplication = {
  targetType: Application["targetType"];
  targetId: number;
  name: string;
  stage: ApplicationStage;
  fitScore: number;
  // `before_outcome`: the score recorded before any outcome stage was reached.
  // `at_outcome`: only a score written when (or after) the outcome was known, e.g. backfilled history.
  scoreTiming: "before_outcome" | "at_outcome";
  reachedInterview: boolean;
  reachedOffer: boolean;
};

export type FeedbackSignal = {
  targetType: Application["targetType"];
  targetId: number;
  name: string;
  stage: ApplicationStage;
  occurredAt: string;
  feedback: string;
};

export type CalibrationReport = {
  verdict: CalibrationVerdict;
  sentence: string;
  minBandSize: number;
  bands: CalibrationBand[];
  resolved: CalibratedApplication[];
  inFlight: number;
  unscored: number;
  scoredAtOutcome: number;
  feedback: FeedbackSignal[];
};

export function buildCalibrationReport(db: Database.Database): CalibrationReport {
  const applications = listApplications(db);
  const eventsByApplication = groupBy(listApplicationEvents(db), (event) => event.applicationId);

  const resolved: CalibratedApplication[] = [];
  const feedback: FeedbackSignal[] = [];
  let inFlight = 0;
  let unscored = 0;

  for (const application of applications) {
    const events = eventsByApplication.get(application.id) ?? [];
    const name = targetName(db, application);

    for (const event of events) {
      if (event.feedback) {
        feedback.push({
          targetType: application.targetType,
          targetId: application.targetId,
          name,
          stage: event.stage,
          occurredAt: event.occurredAt,
          feedback: event.feedback,
        });
      }
    }

    const stages = new Set([application.stage, ...events.map((event) => event.stage)]);
    const reachedInterview = stages.has("interviewing") || stages.has("offer");
    const reachedOffer = stages.has("offer");
    if (!reachedInterview && application.stage !== "rejected") {
      inFlight += 1;
      continue;
    }

    const score = scoreBeforeOutcome(events);
    if (!score) {
      unscored += 1;
      continue;
    }
    resolved.push({
      targetType: application.targetType,
      targetId: application.targetId,
      name,
      stage: application.stage,
      fitScore: score.value,
      scoreTiming: score.timing,
      reachedInterview,
      reachedOffer,
    });
  }

  const bandRows = bands.map((band) => {
    const members = resolved.filter((item) => inBand(item.fitScore, band));
    const interviews = members.filter((item) => item.reachedInterview).length;
    const offers = members.filter((item) => item.reachedOffer).length;
    const enough = members.length >= MIN_BAND_SIZE;
    return {
      label: band.label,
      range: band.label === "high" ? `>= ${band.min}` : `${band.min}–${band.max}`,
      n: members.length,
      interviews,
      offers,
      interviewRate: enough ? interviews / members.length : null,
      offerRate: enough ? offers / members.length : null,
    };
  });

  const { verdict, sentence } = judge(bandRows);
  feedback.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return {
    verdict,
    sentence,
    minBandSize: MIN_BAND_SIZE,
    bands: bandRows,
    resolved,
    inFlight,
    unscored,
    scoredAtOutcome: resolved.filter((item) => item.scoreTiming === "at_outcome").length,
    feedback,
  };
}

// The last fit score recorded before the first outcome event. Falls back to the
// score on the first outcome event, flagged, when nothing earlier was scored.
function scoreBeforeOutcome(events: ApplicationEvent[]): { value: number; timing: CalibratedApplication["scoreTiming"] } | null {
  const firstOutcome = events.findIndex((event) => OUTCOME_STAGES.includes(event.stage));
  const before = firstOutcome === -1 ? events : events.slice(0, firstOutcome);
  const prior = [...before].reverse().find((event) => event.fitScore !== null);
  if (prior?.fitScore != null) {
    return { value: prior.fitScore, timing: "before_outcome" };
  }
  const fallback = events.find((event) => event.fitScore !== null);
  return fallback?.fitScore != null ? { value: fallback.fitScore, timing: "at_outcome" } : null;
}

function judge(rows: CalibrationBand[]): { verdict: CalibrationVerdict; sentence: string } {
  const rated = rows.filter((row) => row.interviewRate !== null);
  if (rated.length < 2) {
    return {
      verdict: "insufficient",
      sentence: `Not enough resolved applications to judge: at least two score bands need ${MIN_BAND_SIZE} or more outcomes each.`,
    };
  }
  const top = rated[0];
  const bottom = rated[rated.length - 1];
  const gap = (top.interviewRate ?? 0) - (bottom.interviewRate ?? 0);
  if (gap >= VERDICT_MARGIN) {
    return { verdict: "separating", sentence: `Higher fit scores are reaching interviews more often (${top.label} vs ${bottom.label} band).` };
  }
  if (gap <= -VERDICT_MARGIN) {
    return {
      verdict: "inverted",
      sentence: `Lower fit scores are reaching interviews more often than higher ones (${bottom.label} vs ${top.label} band). The scoring is not predicting outcomes.`,
    };
  }
  return { verdict: "flat", sentence: `Interview rates are about the same across fit-score bands; the scores are not separating outcomes yet.` };
}

function inBand(score: number, band: (typeof bands)[number]): boolean {
  return band.label === "high" ? score >= band.min : score >= band.min && score < band.max;
}

function targetName(db: Database.Database, application: Application): string {
  if (application.targetType === "company") {
    const row = db.prepare("select name from companies where id = ?").get(application.targetId) as { name: string } | undefined;
    return row?.name ?? `company:${application.targetId}`;
  }
  const row = db
    .prepare("select roles.title as title, companies.name as company from roles join companies on companies.id = roles.company_id where roles.id = ?")
    .get(application.targetId) as { title: string; company: string } | undefined;
  return row ? `${row.title} @ ${row.company}` : `role:${application.targetId}`;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const group = groups.get(key(item));
    if (group) group.push(item);
    else groups.set(key(item), [item]);
  }
  return groups;
}
