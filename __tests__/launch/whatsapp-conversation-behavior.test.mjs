import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const text = readFileSync("lib/whatsapp/conversation.ts", "utf8");
const compiled = ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: "conversation.ts",
}).outputText;

const mockData = {
  categories: ["Libros de texto","Lectura y literatura","Material escolar","Uniformes","Tecnología y calculadoras","Mochilas y estuches","Música","Deporte escolar","Material universitario","Otros"],
  gradeLevels: ["Infantil","1o Primaria","2o Primaria","3o Primaria","1o ESO","2o ESO","3o ESO","4o ESO","Universidad","Otros"],
  conditions: [
    { value: "new_with_tags", label: "Nuevo con etiquetas" },
    { value: "new_without_tags", label: "Nuevo sin etiquetas" },
    { value: "very_good", label: "Muy bueno" },
    { value: "good", label: "Bueno" },
    { value: "satisfactory", label: "Satisfactorio" },
  ],
};
const mod = { exports: {} };
vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`)(
  (name) => {
    if (name === "@/lib/mock-data") return mockData;
    throw Error(`Unexpected dependency: ${name}`);
  },
  mod,
  mod.exports
);
const { startWhatsappListing, advanceWhatsappListing, isValidWhatsappDraft } = mod.exports;

const id = "12345678-1234-4123-8123-123456789abc";
const longDescription = "Calculadora científica para uso escolar, con pantalla digital y teclas para operaciones matemáticas.";

function start(category="Tecnología y calculadoras", gradeLevel=null) {
  return startWhatsappListing(id, `12345678-1234-4123-8123-123456789abc/wa.jpg`, {
    title: "Calculadora científica escolar",
    description: longDescription,
    category,
    gradeLevel,
  });
}
const advance = (current, message) => advanceWhatsappListing(current.state, message);

test("nothing publishes without an exact explicit PUBLICAR after valid review", () => {
  let step = start();
  assert.equal(step.state.step, "title");
  assert.notEqual(step.publish, true);
  step = advance(step, "SI");
  assert.equal(step.state.step, "condition");
  step = advance(step, "4");
  assert.equal(step.state.payload.condition, "good");
  step = advance(step, "1");
  assert.equal(step.state.step, "price");
  step = advance(step, "12,50");
  assert.equal(step.state.step, "review");
  assert.equal(step.state.payload.price, 12.5);
  assert.equal(isValidWhatsappDraft(step.state.payload, step.state.draftPhotoPath), true);
  const invalid = advance(step, "publicar ahora");
  assert.notEqual(invalid.publish, true);
  assert.equal(invalid.state.step, "review");
  const confirm = advance(step, "PUBLICAR");
  assert.equal(confirm.publish, true);
  assert.equal(confirm.state.step, "review");
});

test("donation never gains a price; cancellation discards private photo", () => {
  let step = start();
  step = advance(step, "SI");
  step = advance(step, "3");
  step = advance(step, "2");
  assert.equal(step.state.step, "review");
  assert.equal(step.state.payload.kind, "donation");
  assert.equal(step.state.payload.price, null);
  const cancel = advance(step, "CANCELAR");
  assert.equal(cancel.state.step, "idle");
  assert.equal(cancel.state.draftPhotoPath, null);
  assert.equal(cancel.cleanup, true);
});

test("books require a valid course, and invalid price cannot publish", () => {
  let step = start("Libros de texto");
  step = advance(step, "SI");
  step = advance(step, "4");
  step = advance(step, "1");
  step = advance(step, "0");
  assert.equal(step.state.step, "price");
  step = advance(step, "10");
  assert.equal(step.state.step, "grade");
  step = advance(step, "3º ESO");
  assert.equal(step.state.step, "review");
  assert.equal(step.state.payload.gradeLevel, "3o ESO");
  assert.equal(advance(step, "publicar").publish, true);
});

test("a title shorter than 12 characters is rejected", () => {
  const step = startWhatsappListing(id, "abc/x.jpg", {
    title: null, description: null, category: null, gradeLevel: null
  });
  const titleAttempt = advance(step, "libro");
  assert.equal(titleAttempt.state.step, "title");
  const accepted = advance(step, "Libro de ejercicios 2 ESO");
  assert.equal(accepted.state.step, "description");
});
