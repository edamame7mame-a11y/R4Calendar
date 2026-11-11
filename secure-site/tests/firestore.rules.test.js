import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const projectId = "r4calendar-2c6f8";
let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(new URL("../firestore.rules.candidate", import.meta.url), "utf8")
    }
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const member = () => testEnv.authenticatedContext("member-test", { area: "member" }).firestore();
const general = () => testEnv.authenticatedContext("general-test", { area: "general" }).firestore();
const admin = () => testEnv.authenticatedContext("admin-test", { area: "admin" }).firestore();
const anonymous = () => testEnv.unauthenticatedContext().firestore();

describe("R4Calendar current data access candidate rules", () => {
  it("allows member read/write to every migrated member collection", async () => {
    const db = member();
    const collections = [
      "events", "calendar_settings", "kuji_history", "kuji_settings",
      "memos", "memo_images", "plunders", "plunder_templates"
    ];
    for (const name of collections) {
      await assertSucceeds(setDoc(doc(db, name, "test-doc"), { test: true }));
      await assertSucceeds(getDoc(doc(db, name, "test-doc")));
    }
  });

  it("denies general-only access to all existing member collections", async () => {
    const db = general();
    const collections = [
      "events", "calendar_settings", "kuji_history", "kuji_settings",
      "memos", "memo_images", "plunders", "plunder_templates"
    ];
    for (const name of collections) {
      await assertFails(getDoc(doc(db, name, "member-only")));
      await assertFails(setDoc(doc(db, name, "new-doc"), { test: true }));
    }
  });

  it("does not grant access to undefined general-area collections yet", async () => {
    const db = general();
    for (const name of ["general_polls", "general_memos", "general_calendar"]) {
      await assertFails(getDoc(doc(db, name, "test-doc")));
      await assertFails(setDoc(doc(db, name, "test-doc"), { test: true }));
    }
  });

  it("allows admin read/write to member collections and admin configuration", async () => {
    const db = admin();
    await assertSucceeds(setDoc(doc(db, "events", "e1"), { title: "admin" }));
    await assertSucceeds(getDoc(doc(db, "events", "e1")));
    await assertSucceeds(setDoc(doc(db, "admin_config", "settings"), { theme: "plain" }));
  });

  it("denies member and general access to admin configuration", async () => {
    await assertFails(getDoc(doc(member(), "admin_config", "settings")));
    await assertFails(setDoc(doc(member(), "admin_config", "settings"), { value: 1 }));
    await assertFails(getDoc(doc(general(), "admin_config", "settings")));
    await assertFails(setDoc(doc(general(), "admin_config", "settings"), { value: 1 }));
  });

  it("denies anonymous access and every unlisted collection", async () => {
    await assertFails(getDoc(doc(anonymous(), "events", "e1")));
    await assertFails(setDoc(doc(anonymous(), "memos", "m1"), { title: "no" }));
    await assertFails(setDoc(doc(member(), "unknown_collection", "x"), { value: 1 }));
    await assertFails(getDoc(doc(general(), "unknown_collection", "x")));
  });
});
