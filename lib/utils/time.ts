export function toIsoUtc(value: Date | string): string {
  return new Date(value).toISOString();
}

export function ageInHours(value: Date | null, now = new Date()): number {
  if (!value) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - value.getTime()) / 3_600_000);
}

export function deterministicDelaySeconds(
  agentId: string,
  cycleNumber: number,
  min: number,
  max: number,
): number {
  if (max <= min) return min;
  let hash = 2166136261;
  const input = `${agentId}:${cycleNumber}`;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const ratio = (hash >>> 0) / 0xffffffff;
  return Math.round(min + ratio * (max - min));
}
