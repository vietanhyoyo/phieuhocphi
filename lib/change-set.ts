import { AppData } from "./types";

// A save sends only what changed since the last snapshot the server
// confirmed: whole records to add or replace, and IDs to delete.

export const COLLECTIONS = ["subjects", "students", "studentSubjects", "lessons", "timetable"] as const;
export type Collection = (typeof COLLECTIONS)[number];
type AnyRecord = { id: string } & Record<string, unknown>;

export type CollectionChanges = { upsert: AnyRecord[]; delete: string[] };
export type ChangeSet = Partial<Record<Collection, CollectionChanges>> & { timetableTitle?: string };

// Server copies carry userId; it is not part of the record's content.
function canonical(record: Record<string, unknown>) {
  return JSON.stringify(Object.keys(record).filter((key) => key !== "userId").sort().map((key) => [key, record[key] ?? ""]));
}

function records(data: AppData | null, collection: Collection): AnyRecord[] {
  return ((data?.[collection] ?? []) as unknown as AnyRecord[]);
}

export function diffData(base: AppData | null, next: AppData): ChangeSet {
  const changes: ChangeSet = {};
  for (const collection of COLLECTIONS) {
    const before = new Map(records(base, collection).map((record) => [record.id, canonical(record)]));
    const after = records(next, collection);
    const afterIds = new Set(after.map((record) => record.id));
    const upsert = after.filter((record) => before.get(record.id) !== canonical(record));
    const removed = [...before.keys()].filter((id) => !afterIds.has(id));
    if (upsert.length || removed.length) changes[collection] = { upsert, delete: removed };
  }
  if (next.timetableTitle !== undefined && next.timetableTitle !== base?.timetableTitle) changes.timetableTitle = next.timetableTitle;
  return changes;
}

export function isEmptyChangeSet(changes: ChangeSet) {
  return changes.timetableTitle === undefined && COLLECTIONS.every((collection) => !changes[collection]);
}

// Used when the server can only store whole snapshots (Apps Script).
export function applyChangeSet(data: AppData, changes: ChangeSet): AppData {
  const result = { ...data } as AppData;
  for (const collection of COLLECTIONS) {
    const change = changes[collection];
    if (!change) continue;
    const removed = new Set(change.delete);
    const upserts = new Map(change.upsert.map((record) => [record.id, record]));
    const kept = records(data, collection).filter((record) => !removed.has(record.id)).map((record) => {
      const replacement = upserts.get(record.id);
      upserts.delete(record.id);
      return replacement ?? record;
    });
    (result as unknown as Record<Collection, AnyRecord[]>)[collection] = [...kept, ...upserts.values()];
  }
  if (changes.timetableTitle !== undefined) result.timetableTitle = changes.timetableTitle;
  return result;
}

// Shape check for a change set received over the network.
export function parseChangeSet(value: unknown): ChangeSet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const changes: ChangeSet = {};
  for (const key of Object.keys(input)) {
    if (key === "timetableTitle") {
      if (typeof input.timetableTitle !== "string" || input.timetableTitle.length > 120) return null;
      changes.timetableTitle = input.timetableTitle;
      continue;
    }
    if (!(COLLECTIONS as readonly string[]).includes(key)) return null;
    const change = input[key] as Partial<CollectionChanges> | null;
    if (!change || !Array.isArray(change.upsert) || !Array.isArray(change.delete)) return null;
    if (!change.upsert.every((record) => record && typeof record === "object" && typeof record.id === "string" && record.id.trim())) return null;
    if (!change.delete.every((id) => typeof id === "string" && id.trim())) return null;
    changes[key as Collection] = { upsert: change.upsert, delete: change.delete };
  }
  return changes;
}
