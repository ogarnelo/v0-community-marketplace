import fs from "node:fs";
import assert from "node:assert/strict";

const listingPage = fs.readFileSync("app/marketplace/listing/[id]/page.tsx", "utf8");
const accountPage = fs.readFileSync("app/account/page.tsx", "utf8");
const accountForm = fs.readFileSync("components/account/account-profile-form.tsx", "utf8");
const skeleton = fs.readFileSync("components/ui/skeleton.tsx", "utf8");

assert.match(listingPage, /Resumen/);
assert.match(listingPage, /Ver perfil del vendedor/);
assert.match(listingPage, /Wetudy facilita el contacto y conserva el historial/);
assert.match(listingPage, /La entrega y el pago se acuerdan directamente entre las partes/);
assert.doesNotMatch(listingPage, /fuera de Wetudy|fuera de la plataforma/);

assert.match(accountPage, /datos opcionales de contacto/);
assert.match(accountForm, /Datos opcionales de contacto/);
assert.match(accountForm, /No son obligatorios/);
assert.doesNotMatch(accountForm, /Sendcloud|etiquetas automáticas/);

assert.match(skeleton, /bg-slate-200/);
assert.doesNotMatch(skeleton, /bg-accent/);

console.log("Product page polish contracts passed");
