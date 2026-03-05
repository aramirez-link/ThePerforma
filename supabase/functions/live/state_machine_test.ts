import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { applySessionTransition, canTransitionSession, desiredDestinationStatus } from "./_shared/stateMachine.ts";

Deno.test("session state machine allows forward and idempotent transitions", () => {
  assertEquals(canTransitionSession("DRAFT", "DRAFT"), true);
  assertEquals(canTransitionSession("DRAFT", "READY"), true);
  assertEquals(canTransitionSession("READY", "LIVE"), true);
  assertEquals(canTransitionSession("LIVE", "ENDED"), true);
  assertEquals(canTransitionSession("ENDED", "ENDED"), true);
});

Deno.test("session state machine blocks invalid transitions", () => {
  assertEquals(canTransitionSession("DRAFT", "LIVE"), false);
  assertEquals(canTransitionSession("READY", "ENDED"), false);
  assertThrows(() => applySessionTransition("READY", "ENDED"));
});

Deno.test("destination desired status derives from enablement + session status", () => {
  assertEquals(desiredDestinationStatus(false, "LIVE"), "DISABLED");
  assertEquals(desiredDestinationStatus(true, "READY"), "CONNECTING");
  assertEquals(desiredDestinationStatus(true, "LIVE"), "CONNECTING");
  assertEquals(desiredDestinationStatus(true, "ENDED"), "DISABLED");
});

