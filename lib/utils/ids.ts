import { createHash, randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableShortId(prefix: string, value: string): string {
  return `${prefix}_${sha256(value).slice(0, 20)}`;
}
