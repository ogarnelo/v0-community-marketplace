// Run ONLY in localhost Chromium, with deterministic in-memory Auth/Profile
// and local HTTP school-API adapters. Original join-school React page is real.
const React=require("react");
const {createRoot}=require("react-dom/client");
const JoinSchoolPage=require("../app/onboarding/join-school/page.tsx").default;
createRoot(document.getElementById("root")).render(React.createElement(JoinSchoolPage));
