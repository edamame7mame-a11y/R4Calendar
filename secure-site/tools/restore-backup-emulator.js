#!/usr/bin/env node
/**
 * Restore and verify a R4Calendar JSON export against a LOCAL Firestore Emulator.
 * This script intentionally cannot connect to any hosted Firebase project.
 *
 * Usage:
 *   npx firebase emulators:exec --only firestore --project demo-r4calendar-restore \
 *     "node tools/restore-backup-emulator.js /path/to/R4Calendar_Firestore_Backup.json"
 */
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const EXPECTED_SOURCE_PROJECT = "r4calendar-1cb70";
const EMULATOR_PROJECT_ID = "demo-r4calendar-restore";
const PRODUCTION_PROJECT_IDS = new Set(["r4calendar-1cb70", "r4calendar-2c6f8"]);
const backupPath = process.argv[2];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function parseEmulatorHost(value = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080") {
  const [host, portText, ...extra] = value.split(":");
  const port = Number(portText);
  if (extra.length || !["127.0.0.1", "localhost"].includes(host) ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Only a local emulator host (127.0.0.1 or localhost) is allowed.");
  }
  return { host, port };
}

function validateBackup(backup) {
  if (!backup || backup.projectId !== EXPECTED_SOURCE_PROJECT || !backup.collections ||
      typeof backup.collections !== "object" || Array.isArray(backup.collections)) {
    throw new Error("Backup format/projectId does not match the expected old R4Calendar export.");
  }
  const docs = [];
  for (const [collection, entries] of Object.entries(backup.collections)) {
    if (!/^[^/]+$/.test(collection) || !Array.isArray(entries)) {
      throw new Error(`Invalid collection envelope: ${collection}`);
    }
    const seen = new Set();
    for (const entry of entries) {
      if (!entry || typeof entry.id !== "string" || !entry.id || entry.id.includes("/") ||
          !entry.data || typeof entry.data !== "object" || Array.isArray(entry.data)) {
        throw new Error(`Invalid document envelope in collection ${collection}`);
      }
      if (seen.has(entry.id)) throw new Error(`Duplicate document ID: ${collection}/${entry.id}`);
      seen.add(entry.id);
      docs.push({ collection, id: entry.id, data: entry.data });
    }
  }
  return docs;
}

if (!backupPath) {
  console.error("Usage: node tools/restore-backup-emulator.js <backup.json>");
  process.exit(2);
}

try {
  const { host, port } = parseEmulatorHost();
  if (PRODUCTION_PROJECT_IDS.has(EMULATOR_PROJECT_ID)) {
    throw new Error("Refusing to use a production Firebase project ID.");
  }
  const raw = await readFile(path.resolve(backupPath), "utf8");
  const backup = JSON.parse(raw);
  const docs = validateBackup(backup);
  const rulesPath = fileURLToPath(new URL("../firestore.rules", import.meta.url));
  const rules = await readFile(rulesPath, "utf8");
  const testEnv = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: { host, port, rules },
  });

  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (const item of docs) {
        await setDoc(doc(db, item.collection, item.id), item.data);
      }

      let verified = 0;
      for (const item of docs) {
        const snapshot = await getDoc(doc(db, item.collection, item.id));
        if (!snapshot.exists() || !isDeepStrictEqual(snapshot.data(), item.data)) {
          throw new Error(`Read-back verification failed: ${item.collection}/${item.id}`);
        }
        verified++;
      }
      console.log("LOCAL EMULATOR RESTORE TEST PASSED");
      console.log(`Source export: ${backup.projectId}`);
      console.log(`Target: ${EMULATOR_PROJECT_ID} (local emulator only)`);
      console.log(`Collections: ${Object.keys(backup.collections).length}`);
      console.log(`Documents written and verified: ${verified}`);
      console.log("Document contents and embedded images were not printed.");
    });
  } finally {
    await testEnv.cleanup();
  }
} catch (error) {
  fail(error?.message || String(error));
}
