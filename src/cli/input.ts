import { readFileSync } from "node:fs";
import { targetTypes, type TargetType } from "../domain/enums.js";

type JsonObject = Record<string, unknown>;

export type TargetRef = {
  targetType: TargetType;
  targetId: number;
};

export function readStdinJson(): JsonObject {
  const input = readFileSync(0, "utf8").trim();
  if (!input) {
    return {};
  }
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected stdin JSON object.");
  }
  return parsed as JsonObject;
}

export function mergeOptionsWithJson<T extends JsonObject>(options: T, json: JsonObject): JsonObject {
  const definedOptions = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
  return { ...json, ...definedOptions };
}

export function parseTargetRef(value: string): TargetRef {
  const [targetType, idText, extra] = value.split(":");
  if (!targetType || !idText || extra !== undefined) {
    throw new Error(`Invalid target ref "${value}". Expected format like company:1.`);
  }
  if (!targetTypes.includes(targetType as TargetType)) {
    throw new Error(`Invalid target type "${targetType}".`);
  }
  const targetId = Number(idText);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    throw new Error(`Invalid target id "${idText}".`);
  }
  return { targetType: targetType as TargetType, targetId };
}
