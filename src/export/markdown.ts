import type Database from "better-sqlite3";
import { buildJsonExport } from "./json.js";

type ExportData = {
  profile: { name: string; summary: string };
  companies: Array<{ id: number; name: string; maker: string | null; summary: string | null; primaryLabel: string | null; status: string }>;
  roles: Array<{ id: number; companyId: number; title: string; remotePolicy: string; status: string }>;
  notes: Array<{ targetType: string | null; targetId: number | null; body: string }>;
  evidence: Array<{ targetType: string; targetId: number; url: string; snippet: string }>;
};

export function buildMarkdownExport(db: Database.Database): string {
  const data = buildJsonExport(db) as ExportData;
  const lines = [
    "# Locus Export",
    "",
    `Profile: ${data.profile.name}`,
    "",
    data.profile.summary,
    "",
    "## Companies",
    "",
  ];
  for (const company of data.companies) {
    lines.push(`### ${company.name}${company.maker ? ` — by ${company.maker}` : ""}`);
    lines.push("");
    if (company.primaryLabel) lines.push(`Label: ${company.primaryLabel}`);
    lines.push(`Status: ${company.status}`);
    if (company.summary) lines.push(company.summary);
    for (const note of data.notes.filter((item) => item.targetType === "company" && item.targetId === company.id)) {
      lines.push(`- Note: ${note.body}`);
    }
    for (const evidence of data.evidence.filter((item) => item.targetType === "company" && item.targetId === company.id)) {
      lines.push(`- Evidence: [${evidence.snippet}](${evidence.url})`);
    }
    lines.push("");
  }
  lines.push("## Roles", "");
  for (const role of data.roles) {
    lines.push(`- ${role.title} [${role.remotePolicy}, ${role.status}]`);
  }
  return `${lines.join("\n").trim()}\n`;
}
