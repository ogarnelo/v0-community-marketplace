import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("slider keeps pointer movement local and commits filters on release", () => {
  const slider = read("components/ui/slider.tsx");
  assert.match(slider, /const \[visualValues, setVisualValues\]/);
  assert.match(slider, /onValueChange=\{handleValueChange\}/);
  assert.match(slider, /onValueCommit=\{handleValueCommit\}/);
  assert.match(slider, /onValueChange\?\.\(nextValues\)/);
});

test("authenticated mobile navbar avoids hidden realtime subscriptions", () => {
  const messages = read("components/messages/navbar-messages-badge.tsx");
  const notifications = read("components/notifications/navbar-notifications-bell.tsx");
  assert.match(messages, /matchMedia\("\(max-width: 767px\)"\)/);
  assert.match(notifications, /matchMedia\("\(max-width: 767px\)"\)/);
});
