---
name: locus-scan
description: Use when looking for new companies or roles that are not yet in Locus — running a discovery round, sweeping for opportunities, or asking what else is out there beyond the current pipeline.
---

# Locus Scan

Discovery, not triage. This skill finds candidates the pipeline does not yet contain.
When the user drops a specific link or posting to evaluate, use `locus-research` instead.

**REQUIRED BACKGROUND:** `locus-research` owns the write path — CLI syntax, evidence
rules, `--json` conventions. Do not restate it here; follow it for every write.

## Round Shape

1. **Dedup.** `pnpm locus company list --json`. Skip anything already present.
2. **Shallow screen 10-15 candidates, 1-2 searches each.** The budget is the point:
   without it this phase expands to fill the round.
3. **Deep dive the best 3.** Culture check, comp comparison, evidence, dual scores.

Start each round with its own session:

```bash
pnpm locus session start --goal "Discovery scan: <focus>" --json
```

## Sourcing

Company-first, not job-board-first. Job boards over-index on companies that advertise,
which skews large and low-craft; the small studios that fit this profile best rarely
post there.

**Order the funnel by the scarcest constraint, not the most interesting one.** For a
UTC+8 candidate that constraint is geography, and it is not close. Screening craft-first
and checking geography later spent two full rounds to find nothing: the craft-driven set
is large and the globally-hiring set is small, so filtering the large set by the small
one wastes the round. Round 3 reversed it — start from companies that hire with no
location restriction, then filter those for Apple-platform craft — and produced the best
candidate found so far on the first pass.

Generalise it: whichever hard requirement eliminates the most candidates goes first.

**Role-first sourcing was tested and does not work for this profile.** Round 4 ran the
inversion deliberately — start from open remote iOS roles, filter for craft — and
returned staffing agencies, region-locked UK and LatAm contracts, on-site San Francisco
roles, and companies with no Apple-platform craft to speak of. Not one globally-open
craft-driven iOS role surfaced. The boards are also mostly unreadable to automated
fetching: `weworkremotely.com`, `hnhiring.com`, and most aggregators return 403 or render
their listings client-side. Do not spend a round this way again; the negative result is
recorded so it does not get re-litigated.

## Screen Filters

Apply in order. Fail one, stop searching that candidate.

| Filter | Fails when |
|---|---|
| Remote **and global** | On-site, hybrid, region-locked, or built around a synchronous window that lands at night in UTC+8 |
| Apple-platform native | Mobile is a checkbox, or cross-platform-first |
| Team shape | Large enough that craft culture is implausible |
| Hiring | No open roles and no signal they are growing |

**"Fully remote" almost never means globally remote.** It usually means US-remote or
Europe-remote, and the qualifier lives on the careers page rather than in the listing.
Region-lock — not office attendance — is the dominant failure mode for a UTC+8 candidate:
in round 2 it eliminated every single screened company, including the round's best craft
match. Resolve geography in the first search of a candidate, before spending a second one
on team shape or product. Phrase the screen query to surface it: ask about hiring
location and timezone policy, not just whether the company is remote.

Watch for the softer version too — a company that hires anywhere but runs a core
synchronous window in US Pacific hours is region-locked in practice.

**Location-independent pay is a sharper screen than "hires globally".** A company can
hire anywhere and still pay a local-market rate, which quietly caps the offer. The
companies worth finding state that pay does not vary by location — usually phrased as
same pay regardless of where you live, or benchmarked to a named market. That single
policy is worth more than most other signals combined for a candidate outside the US, and
it correlates strongly with the async, low-meeting, high-autonomy cultures this profile
wants. Search the phrase directly; it is rare enough that the set is small and nameable.

The screen earns its keep in both directions. Doist advertises that it "never places
restrictions on locations" yet benchmarks salary to industry data "adjusted for your
location" — hires anywhere, pays local, and the qualifier lives several paragraphs below
the headline. Raycast states the opposite outright: "We pay you a location independent
rate." Same remote-friendly surface, materially different offer. Read the compensation
section, not the remote-work section.

**Query the applicant-tracking API directly — it is ground truth and costs one call.**
Most careers pages render client-side and defeat fetching, and aggregators lie in both
directions. Both major ATS platforms expose public JSON:

```bash
curl -sf "https://api.ashbyhq.com/posting-api/job-board/<slug>"      # Ashby
curl -sf "https://boards-api.greenhouse.io/v1/boards/<slug>/jobs"    # Greenhouse
```

The slug is usually the company name lowercased; probe a couple of variants. Every role
comes back with its title and location, which answers both the hiring question and the
geography question in a single request. This settled three candidates in one round that
page-fetching could not, and disproved live iOS listings that four separate aggregators
were still syndicating.

**But the ATS sweep is blind to exactly the companies this profile most wants.** In round
6, not one of eleven screened indie Apple studios had a Greenhouse or Ashby board — every
single one was a hand-rolled careers page or nothing at all. Applicant tracking systems
are a venture-scale artifact; a four-person studio has no use for one. So a clean ATS
sweep buys much less confidence than it appears to, and its silence is not evidence of
anything. Use the ATS query for funded companies, and expect to read HTML for the rest.

**Confirm hiring on the company's own jobs page, never on an aggregator.** Job boards,
`about` pages, and third-party listings go stale in both directions: they advertise roles
that closed and reframe hybrid roles as remote. In the first live round, all three
deep-dive candidates had hiring signals that did not survive checking at source. Verify
before spending a deep dive.

A company with no opening but an explicit invitation to write in has not failed this
filter — it has become an outreach target. Record it as `watching` and note the angle.

For tiny Apple studios this is not the edge case, it is **the normal outcome**. Round 6
screened eleven and found zero live openings but two standing invitations, and iA Writer,
Kagi, Ulysses and MindNode all sit in this state. Treat "no openings, but write to us" as
a successful screen result rather than a dead end, and stop expecting these companies to
post — they hire from a letter, an artifact, or someone they already read.

**Resolve employability before deep-diving an invitation.** A five-person GmbH in Leipzig
or Vienna may have no mechanism to employ someone outside the EU at all, and that gate
sits upstream of everything a deep dive measures — culture, compensation, and scores are
all moot if the company cannot legally pay this candidate. It is rarely answerable from
the public site, which means the honest move is to record the gap and ask them, not to
spend a deep dive and discover it afterwards.

Two traps when checking a careers page: it may return a **filtered view** showing one
department, so confirm the list is unfiltered before concluding a role does not exist;
and an indexed role URL that now 404s means *probably closed*, not *never existed*.
Record the ambiguity and flag it for a manual look rather than resolving it by guess.

## Deep Dive Requirements

A deep dive is incomplete until all four are done.

**Culture verification.** Sweep employer-review sources by search.
`glassdoor.com` and `teamblind.com` return HTTP 403 to automated fetching, so content
arrives as search summaries, not primary text. Say so in the evidence snippet, cap
confidence at 0.6, and flag the claim for manual reading. Never present a
snippet-sourced culture claim as verified.

A high aggregate rating beside a cluster of specific one-star accounts is a finding, not
noise — it usually means either two employee tracks or review curation. Record which
explanation you could not rule out.

**Compensation.** Compare against `.locus/compensation.md`, quoting deltas against the
all-in annual figure, never base alone. A number that looks low often is not.

**Listing-locale check.** The same requisition posted against several cities means a
locale-tagged remote hire, not a local office. Verify before treating a city as a team.

**Dual scores.** Score the company and each role separately. They diverge often — a
strong company can carry a role that inverts the profile.

## Scoring

Anchor to the profile's own weights so rounds stay comparable:

- Failed hard requirement (weight 1.0) caps the score at **0.3**.
- Confirmed negative signal at weight >= 0.9 caps at **0.45**.
- Unverified negatives reduce but do not cap. State the uncertainty.
- Positives accumulate only when no cap applies.

## Status

- `rejected` — hard requirement fails. Keep the evidence.
- `watching` — screened out but sound.
- `researching` — deep-dived this round.

Anything beyond this is the user's call.

## Stop Condition

Run `pnpm locus export json` and confirm the round's writes are present. Report counts:
screened, deep-dived, skipped as duplicates, rejected. If the round was capped, say what
was dropped — a silent truncation reads as full coverage.
