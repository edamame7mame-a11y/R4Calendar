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

describe("R4Calendar area isolation candidate rules", () => {
  it("allows member read/write to member collections", async () => {
    await assertSucceeds(setDoc(doc(member(), "events", "e1"), { title: "test" }));
    await assertSucceeds(getDoc(doc(member(), "events", "e1")));
    await assertSucceeds(setDoc(doc(member(), "memo_images", "m1"), { imageData: "test" }));
  });

  it("denies general access to member collections", async () => {
    await assertFails(getDoc(doc(general(), "events", "e1")));
    await assertFails(setDoc(doc(general(), "memos", "m1"), { title: "no" }));
    await assertFails(getDoc(doc(general(), "plunders", "p1")));
  });

  it("allows general read/write only to general collections", async () => {
    await assertSucceeds(setDoc(doc(general(), "general_memos", "g1"), { text: "ok" }));
    await assertSucceeds(getDoc(doc(general(), "general_memos", "g1")));
    await assertSucceeds(setDoc(doc(general(), "general_calendar", "g2"), { text: "ok" }));
  });

  it("allows member read/write to general collections", async () => {
    await assertSucceeds(setDoc(doc(member(), "general_memos", "g1"), { text: "member edit" }));
    await assertSucceeds(getDoc(doc(member(), "general_memos", "g1")));
    await assertSucceeds(setDoc(doc(member(), "general_polls", "g2"), { text: "member edit" }));
  });

  it("allows admin access to both areas and admin configuration", async () => {
    await assertSucceeds(setDoc(doc(admin(), "events", "e1"), { title: "admin" }));
    await assertSucceeds(setDoc(doc(admin(), "general_memos", "g1"), { text: "admin" }));
    await assertSucceeds(setDoc(doc(admin(), "admin_config", "settings"), { theme: "plain" }));
  });

  it("denies unauthenticated access and unknown collections", async () => {
    await assertFails(getDoc(doc(anonymous(), "events", "e1")));
    await assertFails(setDoc(doc(anonymous(), "general_memos", "g1"), { text: "no" }));
    await assertFails(setDoc(doc(member(), "unknown_collection", "x"), { value: 1 }));
    await assertFails(setDoc(doc(general(), "admin_config", "settings"), { value: 1 }));
    await assertFails(getDoc(doc(general(), "events", "member-only")));
  });
});
