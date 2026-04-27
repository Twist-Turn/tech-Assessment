import { ObjectId } from "mongodb";

/**
 * Recursively convert ObjectId values into strings and rename Mongo's `_id`
 * to `id` so the API returns clean JSON to the SPA.
 */
export function serialize<T = unknown>(value: any): T {
  if (value == null) return value;
  if (value instanceof ObjectId) return value.toString() as unknown as T;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const key = k === "_id" ? "id" : k;
      out[key] = serialize(v);
    }
    return out as T;
  }
  return value;
}

export function tryOid(v?: string | null): ObjectId | null {
  if (!v) return null;
  try {
    return new ObjectId(v);
  } catch {
    return null;
  }
}
