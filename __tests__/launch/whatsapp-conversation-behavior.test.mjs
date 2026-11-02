import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const mockData = {
  categories: ["Libros de texto","Lectura y literatura","Material escolar","Uniformes","Tecnología y calculadoras","Mochilas y estuches","Música","Deporte escolar","Material universitario","Otros"],
  gradeLevels: ["Infantil","1o Primaria","2o Primaria","3o Primaria","1o ESO","2o ESO","3o ESO","4o ESO","Universidad","Otros"],
  conditions: [
    { value:"new_with_tags", label:"Nuevo con etiquetas" },
    { value:"new_without_tags", label:"Nuevo sin etiquetas" },
    { value:"very_good", label:"Muy bueno" },
    { value:"good", label:"Bueno" },
    { value:"satisfactory", label:"Satisfactorio" },
  ],
  bookFormats: ["Tapa blanda","Tapa dura","Cuaderno de actividades","Libro digital con código","Lote de libros","Otros"],
  bookLanguages: ["Español","Inglés","Francés","Alemán","Italiano","Portugués","Catalán","Euskera","Gallego","Valenciano","Árabe","Chino","Japonés","Ruso","Hindi"],
};

function load(path, dependencies) {
  const js = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports){ ${js}\n})`)(
    (name) => {
      if (!(name in dependencies)) throw Error("Unexpected dependency " + name);
      return dependencies[name];
    }, mod, mod.exports
  );
  return mod.exports;
}
const isbn = {
  isValidIsbn: (x) => x.replace(/[^0-9X]/gi,"") === "9780306406157",
  normalizeIsbn: (x) => ({ canonicalIsbn: x.replace(/[^0-9X]/gi,"") }),
};
const category = load("lib/whatsapp/category-fields.ts", { "@/lib/mock-data": mockData });
const conversation = load("lib/whatsapp/conversation.ts", {
  "@/lib/mock-data": mockData,
  "@/lib/books/isbn": isbn,
  "@/lib/whatsapp/category-fields": category,
});
const form = load("lib/whatsapp/form.ts", {
  "@/lib/mock-data": mockData,
  "@/lib/books/isbn": isbn,
  "@/lib/whatsapp/category-fields": category,
  "@/lib/whatsapp/conversation": conversation,
});
const ID = "12345678-1234-4123-8123-123456789abc";
const PRIVATE = `${ID}/approved.jpg`;
const DESC = "Calculadora escolar con carcasa resistente, pantalla y teclas para operaciones matemáticas.";
const suggest = {
  category: "Tecnología y calculadoras",
  title: "Calculadora científica escolar",
  description: DESC,
  gradeLevel: null,
  specificType: "Calculadora científica",
  brand: "Casio",
  model: "fx-82SP CW",
};

test("AI prepares form values only; no free-text publication functions remain", () => {
  assert.equal(conversation.advanceWhatsappListing, undefined);
  assert.equal(conversation.updateGroupedDetails, undefined);
  assert.equal(conversation.formatWhatsappReview, undefined);
  const prepared = conversation.startWhatsappListing(ID, PRIVATE, suggest);
  assert.equal(prepared.state.step, "form");
  assert.equal(prepared.state.payload.brand, "Casio");
  assert.equal(prepared.state.payload.model, "fx-82SP CW");
  assert.equal(prepared.state.payload.condition, undefined);
  assert.equal(prepared.state.payload.kind, undefined);
  assert.equal(prepared.state.payload.price, undefined);
});

test("form rejects missing state and selling intent instead of inventing them", () => {
  const result = form.normalizeWhatsappForm(suggest, ID, PRIVATE);
  assert.ok(result.errors.condition);
  assert.ok(result.errors.kind);
  assert.equal(result.errors.price, undefined);
});

test("valid selling form requires positive price, optional original price", () => {
  const result = form.normalizeWhatsappForm({
    ...suggest, condition: "good", kind: "sale", price: "12,50",
  }, ID, PRIVATE);
  assert.deepEqual(Object.keys(result.errors), []);
  assert.equal(result.draft.price, 12.5);
  assert.equal(result.draft.originalPrice, null);
  assert.equal(conversation.isValidWhatsappDraft(result.draft, PRIVATE), true);
});

test("books require course, optional ISBN must pass checksum", () => {
  const book = {
    category: "Libros de texto",
    title: "Libro de matemáticas de secundaria",
    description: DESC,
    condition: "good", kind: "donation",
    subject: "Matemáticas",
  };
  const noCourse = form.normalizeWhatsappForm(book, ID, PRIVATE);
  assert.ok(noCourse.errors.gradeLevel);
  const invalid = form.normalizeWhatsappForm({
    ...book, gradeLevel: "3o ESO", isbn: "9789999999999",
  }, ID, PRIVATE);
  assert.ok(invalid.errors.isbn);
  const valid = form.normalizeWhatsappForm({
    ...book, gradeLevel: "3o ESO", isbn: "9780306406157",
  }, ID, PRIVATE);
  assert.deepEqual(Object.keys(valid.errors), []);
});

test("uniform's fields never inherit calculator details from untrusted input", () => {
  const uniform = form.normalizeWhatsappForm({
    ...suggest,
    category: "Uniformes",
    title: "Jersey para uniforme escolar",
    condition: "good", kind: "donation",
    specificType: "Sudadera o jersey", sizeLabel: "10", season: "Invierno",
  }, ID, PRIVATE);
  assert.deepEqual(Object.keys(uniform.errors), []);
  assert.equal(uniform.draft.brand, undefined);
  assert.equal(uniform.draft.model, undefined);
  assert.equal(uniform.draft.sizeLabel, "10");
});

test("no photo or a forged donation price cannot bypass publication rules", () => {
  const result = form.normalizeWhatsappForm({
    ...suggest, condition: "good", kind: "donation", price: 100,
  }, ID, null);
  assert.ok(result.errors.photo);
  assert.equal(result.draft.price, null);
});

test("AI prefill never guesses category details after a category mismatch", () => {
  const prepared = conversation.startWhatsappListing(ID, PRIVATE, {
    ...suggest, category: "Uniformes",
  });
  assert.equal(prepared.state.payload.brand, undefined);
  assert.equal(prepared.state.payload.model, undefined);
  assert.equal(prepared.state.payload.specificType, undefined);
});
