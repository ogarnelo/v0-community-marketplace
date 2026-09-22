import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const auth = read("components/auth/auth-form.tsx");
const newListing = read("components/marketplace/new-listing-form.tsx");
const mobileActions = read("components/marketplace/mobile-listing-actions.tsx");
const contactButton = read("components/messages/contact-seller-button.tsx");
const listingPage = read("app/marketplace/listing/[id]/page.tsx");
const deleteButton = read("components/account/delete-listing-button.tsx");

test("signup password can be shown and hidden", () => {
  assert.match(auth, /showPassword/);
  assert.match(auth, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(auth, /Mostrar contraseña/);
  assert.match(auth, /Ocultar contraseña/);
});

test("new listing form stays usable with long condition labels and Android numeric keyboard", () => {
  assert.match(newListing, /\[&>span\]:truncate/);
  assert.match(newListing, /window\.visualViewport/);
  assert.match(newListing, /keyboardOffset/);
  assert.match(newListing, /enterKeyHint="done"/);
  assert.match(newListing, /e\.currentTarget\.blur\(\)/);
});

test("mobile Contactar creates or opens the actual conversation", () => {
  assert.match(mobileActions, /ContactSellerButton/);
  assert.match(mobileActions, /sellerId=\{sellerId\}/);
  assert.doesNotMatch(mobileActions, /\/messages\?listing=/);
  assert.match(contactButton, /from\("conversations"\)/);
  assert.match(contactButton, /window\.location\.assign\(\`\/messages\/\$\{newConversation\.id\}\`\)/);
});

test("listing owners can delete from the listing detail", () => {
  assert.match(listingPage, /DeleteListingButton/);
  assert.match(listingPage, /redirectTo="\/account\/listings"/);
  assert.match(listingPage, /sellerId=\{listing\.seller_id\}/);
  assert.match(deleteButton, /redirectTo/);
  assert.match(deleteButton, /router\.push\(redirectTo\)/);
});
