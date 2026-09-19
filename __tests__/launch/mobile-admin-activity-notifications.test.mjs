import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("activity renders the notifications that feed the header badge", () => {
  const page = read("app/account/activity/page.tsx");
  const list = read("components/notifications/activity-notifications-list.tsx");

  assert.match(page, /from\("notifications"\)/);
  assert.match(page, /ActivityNotificationsList initialNotifications=\{notifications\}/);
  assert.match(list, /Aquí aparecen los avisos que generan el contador del header/);
  assert.match(list, /\/api\/notifications\/read-all/);
  assert.match(list, /\/api\/notifications\/read/);
  assert.match(list, /school_registration_requested/);
  assert.match(list, /\/admin\/super\?tab=schools/);
});

test("superadmin school review is immediately actionable on mobile", () => {
  const dashboard = read("components/admin/super-admin-dashboard.tsx");

  assert.match(dashboard, /useSearchParams/);
  assert.match(dashboard, /normalizeSchoolRequestStatus\(request\.status\) === "pending"/);
  assert.match(dashboard, /const \[activeTab, setActiveTab\] = useState\(initialTab\)/);
  assert.match(dashboard, /setActiveTab\("schools"\)/);
  assert.match(dashboard, /Hay 1 alta de centro pendiente/);
  assert.match(dashboard, /grid h-auto w-full grid-cols-2/);
  assert.match(dashboard, /Altas de centros/);
  assert.match(dashboard, /pendingSchoolRequestCount/);
  assert.match(dashboard, /Aprobar y crear centro/);
  assert.match(dashboard, /Rechazar/);
});
