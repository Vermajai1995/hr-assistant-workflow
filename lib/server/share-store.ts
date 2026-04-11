import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import type { SharedSessionRecord, SessionSnapshot } from "@/types/hireflow";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "hireflow-share-store.json");

type StoreShape = {
  shares: Record<string, SharedSessionRecord>;
};

export async function createShareRecord(snapshot: SessionSnapshot) {
  const store = await readStore();
  const shareId = crypto.randomUUID();
  store.shares[shareId] = {
    shareId,
    createdAt: new Date().toISOString(),
    snapshot,
  };
  await writeStore(store);
  return store.shares[shareId];
}

export async function getShareRecord(shareId: string) {
  const store = await readStore();
  return store.shares[shareId] || null;
}

async function readStore() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as StoreShape;
  } catch {
    const initial: StoreShape = { shares: {} };
    await writeFile(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

async function writeStore(store: StoreShape) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}
