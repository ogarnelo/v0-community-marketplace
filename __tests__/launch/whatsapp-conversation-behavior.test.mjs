import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

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
  bookFormats: ["Tapa blanda","Tapa dura","Cuaderno de actividades","Libro digital con código","Lote de libros","Otros"],
  bookLanguages: ["Español","Inglés","Francés","Alemán","Italiano","Portugués","Catalán","Euskera","Gallego","Valenciano","Árabe","Chino","Japonés","Ruso","Hindi"],
};

function loadModule(path, deps) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports) { ${output}\n})`)(
    (name) => {
      if (!(name in deps)) throw Error(`Unexpected dependency: ${name}`);
      return deps[name];
    }, module, module.exports,
  );
  return module.exports;
}
const catalog = loadModule("lib/whatsapp/category-fields.ts", {
  "@/lib/mock-data": mockData,
});
const isbnHelpers = {
  isValidIsbn: (value) => value.replace(/[^0-9X]/gi,"") === "9780306406157",
  normalizeIsbn: (value) => ({ canonicalIsbn: value.replace(/[^0-9X]/gi,"") }),
};
const { startWhatsappListing, advanceWhatsappListing, isValidWhatsappDraft } =
  loadModule("lib/whatsapp/conversation.ts", {
    "@/lib/mock-data": mockData,
    "@/lib/books/isbn": isbnHelpers,
    "@/lib/whatsapp/category-fields": catalog,
  });
const id = "12345678-1234-4123-8123-123456789abc";
const path = `${id}/demo.jpg`;
const description = "Calculadora escolar con pantalla digital, carcasa rígida y teclas para operaciones matemáticas.";
const defaultSuggestion = {
  category: "Tecnología y calculadoras", gradeLevel: null,
  title: "Calculadora científica escolar", description,
  specificType: "Calculadora científica", brand: "Casio", model: "fx-82SP CW",
};
const begin = (overrides={}) => startWhatsappListing(id, path, { ...defaultSuggestion, ...overrides });
const move = (last, message) => advanceWhatsappListing(last.state, message);

function throughToDetails(suggestion={}) {
  let step = begin(suggestion);
  assert.equal(step.state.step, "category");
  assert.match(step.response,/Título: /);
  assert.match(step.response,/Descripción: /);
  assert.match(step.response,/Categoría: /);
  assert.match(step.response,/SI — aceptar los tres/);
  step = move(step,"SI");
  assert.equal(step.state.step, "details");
  return step;
}

test("technology asks type, brand and model, then requires condition, sale, price, optional original price and confirmation", () => {
  let step = throughToDetails();
  assert.match(step.response,/Tipo de dispositivo/);
  step = move(step,"SI"); assert.match(step.response,/Marca/);
  step = move(step,"SI"); assert.match(step.response,/Modelo/);
  step = move(step,"SI"); assert.equal(step.state.step,"condition");
  step = move(step,"4");
  assert.equal(step.state.payload.condition,"good");
  step = move(step,"1"); assert.equal(step.state.step,"price");
  step = move(step,"12,50");
  assert.equal(step.state.step,"originalPrice");
  step = move(step,"OMITIR");
  assert.equal(step.state.step,"review");
  assert.equal(step.state.payload.price,12.5);
  assert.match(step.response,/Descripción:/);
  assert.match(step.response,/Marca: Casio/);
  assert.match(step.response,/Modelo: fx-82SP CW/);
  assert.equal(isValidWhatsappDraft(step.state.payload, step.state.draftPhotoPath),true);
  assert.notEqual(move(step,"publicar ahora").publish,true);
  const confirmed = move(step,"PUBLICAR");
  assert.equal(confirmed.publish,true);
  assert.equal(confirmed.state.step,"review");
});

test("user may edit the combined proposal and correct description before proceeding", () => {
  let step = begin();
  step = move(step,"EDITAR");
  assert.equal(step.state.step,"title");
  step = move(step,"SI");
  assert.equal(step.state.step,"description");
  step = move(step,"muy corto");
  assert.equal(step.state.step,"description");
  const full = "Calculadora con funda protectora y manual de instrucciones, incluye tapa y pilas nuevas.";
  step = move(step,full);
  assert.equal(step.state.step,"details");
  assert.equal(step.state.payload.description,full);
});

test("books require grade and validate ISBN; optional details can be skipped", () => {
  let step = throughToDetails({
    category: "Libros de texto",
    title: "Libro de Matemáticas de secundaria",
    isbn: "9780306406157",
    subject: "Matemáticas",
    gradeLevel: null,
  });
  assert.match(step.response,/ISBN/);
  step = move(step,"9999999999999");
  assert.equal(step.state.step,"details");
  assert.match(step.response,/no supera la validación/);
  step = move(step,"SI"); // use validated suggested ISBN
  step = move(step,"OMITIR TODO");
  assert.equal(step.state.step,"grade");
  step = move(step,"OMITIR"); // grade required
  assert.equal(step.state.step,"grade");
  step = move(step,"3º ESO");
  assert.equal(step.state.payload.gradeLevel,"3o ESO");
  step = move(step,"4"); step = move(step,"1"); step = move(step,"8");
  assert.equal(step.state.step,"originalPrice");
  step = move(step,"18");
  assert.equal(step.state.step,"review");
  assert.match(step.response,/ISBN: 9780306406157/);
  assert.equal(move(step,"PUBLICAR").publish,true);
});

test("uniform asks garment size and season; donation omits price", () => {
  let step = throughToDetails({
    category: "Uniformes", title: "Jersey del uniforme escolar",
    specificType: "Sudadera o jersey", sizeLabel: "10", season: "Invierno",
  });
  assert.match(step.response,/Prenda/);
  step = move(step,"SI"); step = move(step,"SI"); step = move(step,"SI");
  assert.equal(step.state.step,"condition");
  step = move(step,"3"); step = move(step,"2");
  assert.equal(step.state.step,"review");
  assert.match(step.response,/Talla: 10/);
  assert.match(step.response,/Temporada: Invierno/);
  assert.equal(step.state.payload.price,null);
  assert.equal(move(step,"PUBLICAR").publish,true);
  const cancel = move(step,"CANCELAR");
  assert.equal(cancel.state.step,"idle"); assert.equal(cancel.cleanup,true);
});

test("changing category clears incompatible AI filter suggestions", () => {
  let step = begin();
  step = move(step,"4"); // Uniformes
  assert.equal(step.state.payload.category,"Uniformes");
  assert.equal(step.state.payload.brand,undefined);
  assert.equal(step.state.payload.model,undefined);
  assert.equal(step.state.payload.specificType,undefined);
});

test("category-specific mapping supports bags, supplies, and other products without unnecessary fields", () => {
  assert.deepEqual(Array.from(catalog.detailFieldsForCategory("Mochilas y estuches").map(x=>x.key)),["specificType","brand"]);
  assert.deepEqual(Array.from(catalog.detailFieldsForCategory("Material escolar").map(x=>x.key)),["specificType"]);
  assert.equal(catalog.detailFieldsForCategory("Deporte escolar").length,0);
});

test("no missing category/title/description gets silently accepted", () => {
  let step = begin({ category: null, title: null, description: null });
  step = move(step,"SI");
  assert.equal(step.state.step,"category");
  step = move(step,"5"); assert.equal(step.state.step,"title");
  step = move(step,"SI"); assert.equal(step.state.step,"title");
  step = move(step,"Calculadora científica escolar");
  assert.equal(step.state.step,"description");
  step = move(step,"SI"); assert.equal(step.state.step,"description");
});

test("one SI accepts complete proposal but still requires condition, kind, price and final PUBLICAR", () => {
  let step = begin();
  assert.match(step.response, /📷 He preparado esta propuesta de anuncio/);
  assert.match(step.response, /Marca: Casio/);
  assert.match(step.response, /Modelo: fx-82SP CW/);
  assert.doesNotMatch(step.response, /1\. Libros de texto/);
  step = move(step, "SI");
  assert.equal(step.state.step, "details");
  step = move(step, "OMITIR TODO");
  assert.equal(step.state.step, "condition");
  assert.notEqual(step.publish, true);
  step = move(step, "4");
  assert.equal(step.state.step, "intent");
  step = move(step, "1");
  assert.equal(step.state.step, "price");
  step = move(step, "12");
  assert.equal(step.state.step, "originalPrice");
  step = move(step, "OMITIR");
  assert.equal(step.state.step, "review");
  assert.notEqual(move(step, "SI").publish, true);
  assert.equal(move(step, "PUBLICAR").publish, true);
});

test("category choice appears only when requested and changes clear incompatible details", () => {
  let step = begin();
  step = move(step, "CAMBIAR");
  assert.equal(step.state.step, "category");
  assert.match(step.response, /1\. Libros de texto/);
  step = move(step, "4");
  assert.equal(step.state.step, "title");
  assert.equal(step.state.payload.category, "Uniformes");
  assert.equal(step.state.payload.brand, undefined);
});
