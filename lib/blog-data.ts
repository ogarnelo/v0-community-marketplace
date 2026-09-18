export interface BlogPost {
  id: number
  slug: string
  title: string
  description: string
  category: string
  readingTime: string
  date: string
  publishedAt: string
  updatedAt?: string
  content: string[]
}

export const posts: BlogPost[] = [
  {
    id: 1,
    slug: "10-formas-ahorrar-material-escolar",
    title: "10 ideas para ahorrar en material escolar sin comprar de más",
    description:
      "Una guía práctica para reutilizar, comparar y planificar la compra de libros, uniformes y material escolar.",
    category: "Ahorro",
    readingTime: "5 min lectura",
    date: "14 Feb 2026",
    publishedAt: "2026-02-14",
    updatedAt: "2026-09-18",
    content: [
      "Ahorrar en material escolar empieza por revisar qué puede seguir utilizándose. Antes de comprar, conviene reunir libros, mochilas, estuches, uniformes y material de escritura del curso anterior y separar lo que está en buen estado.",
      "Con la lista del centro delante, marca qué artículos son obligatorios y cuáles son solo recomendaciones. Evitar compras duplicadas o adelantadas reduce gasto y también evita acumular material que después no se utiliza.",
      "En libros de texto, comprueba siempre ISBN, edición, editorial y curso. Dos libros con una portada parecida pueden corresponder a ediciones distintas, así que el ISBN es la referencia más fiable cuando está disponible.",
      "El material de segunda mano puede ser una buena opción para libros, uniformes, calculadoras, instrumentos y otros artículos duraderos. Revisa fotos, estado y descripción antes de acordar nada con la otra persona.",
      "Si vendes o donas, agrupa materiales relacionados y describe cualquier desgaste con claridad. Una publicación precisa evita preguntas repetidas y ayuda a que otra familia sepa si el artículo le sirve.",
      "Planificar con tiempo también ayuda. Si buscas con antelación puedes comparar más opciones, guardar búsquedas y esperar a que aparezca justo el material que necesitas.",
      "Por último, acuerda siempre entrega y pago con claridad. En Wetudy el contacto se realiza por chat y la entrega y el pago se acuerdan directamente entre las partes.",
    ],
  },
  {
    id: 2,
    slug: "guia-evaluar-estado-libros-texto-usados",
    title: "Cómo comprobar el estado de un libro de texto usado",
    description:
      "Qué revisar en tapas, lomo, páginas, ejercicios, ISBN y edición antes de comprar o publicar un libro de segunda mano.",
    category: "Consejos",
    readingTime: "4 min lectura",
    date: "10 Feb 2026",
    publishedAt: "2026-02-10",
    updatedAt: "2026-09-18",
    content: [
      "Antes de comprar un libro de texto usado, confirma que corresponde al curso, asignatura, editorial y edición que necesitas. Si tienes el ISBN de la lista del centro, compáralo con el del libro.",
      "Revisa las tapas y el lomo. Un desgaste superficial suele ser compatible con un uso normal, pero un lomo despegado, humedad o páginas sueltas pueden afectar a la vida útil del libro.",
      "Comprueba varias páginas interiores, no solo las primeras. Busca anotaciones permanentes, ejercicios completados, páginas recortadas o material adicional que falte.",
      "En cuadernos de actividades o libros fungibles, pregunta si están escritos. En muchos casos este tipo de material no es reutilizable si los ejercicios ya están resueltos.",
      "Las fotos deben enseñar el artículo real. Si eres vendedor, incluye portada, contraportada, lomo y cualquier defecto relevante. Si eres comprador y algo no se ve, pide una foto adicional por chat.",
      "Una descripción clara beneficia a ambas partes. En Wetudy el estado declarado y las fotos ayudan a decidir antes de contactar, y los detalles finales se acuerdan directamente entre las personas implicadas.",
    ],
  },
  {
    id: 3,
    slug: "impacto-ambiental-reutilizar-uniformes",
    title: "Por qué reutilizar uniformes escolares alarga la vida de la ropa",
    description:
      "Consejos para revisar, preparar y reutilizar uniformes escolares antes de sustituir prendas que todavía pueden usarse.",
    category: "Sostenibilidad",
    readingTime: "5 min lectura",
    date: "5 Feb 2026",
    publishedAt: "2026-02-05",
    updatedAt: "2026-09-18",
    content: [
      "Los uniformes escolares suelen tener una vida útil mayor que un solo curso. Cuando una prenda queda pequeña pero conserva buen estado, reutilizarla permite aprovechar durante más tiempo los materiales y el trabajo empleados en fabricarla.",
      "Antes de ofrecer un uniforme, revisa costuras, cremalleras, botones, elásticos y zonas de mayor roce. Lava la prenda siguiendo la etiqueta y señala cualquier marca o arreglo que deba conocer la siguiente familia.",
      "Las medidas son más útiles que la talla por sí sola. Añadir largo, cintura o contorno aproximado ayuda especialmente cuando las tallas cambian entre fabricantes.",
      "Si una prenda necesita una reparación sencilla, valorar un arreglo antes de desecharla puede prolongar su uso. Botones, bajos y pequeñas costuras suelen ser reparaciones asumibles.",
      "También es importante evitar afirmaciones ambientales difíciles de verificar para una prenda concreta. El beneficio más directo y fácil de explicar es que reutilizar reduce la necesidad de sustituir inmediatamente un artículo que todavía cumple su función.",
      "En Wetudy puedes publicar uniformes para venta o donación y dejar claros estado, talla y fotos. La entrega y el pago se acuerdan directamente entre las partes.",
    ],
  },
  {
    id: 4,
    slug: "mejores-apps-organizar-estudio-hijos",
    title: "Cómo elegir una app para organizar tareas y estudio",
    description:
      "Criterios sencillos para elegir herramientas de calendario, tareas y estudio sin depender de una lista de apps que quede desactualizada.",
    category: "Tecnología",
    readingTime: "5 min lectura",
    date: "1 Feb 2026",
    publishedAt: "2026-02-01",
    updatedAt: "2026-09-18",
    content: [
      "La mejor herramienta de organización no es necesariamente la que tiene más funciones, sino la que el estudiante puede mantener de forma constante.",
      "Para tareas y fechas de entrega, busca una vista clara de calendario, recordatorios configurables y una forma rápida de marcar lo completado. Cuantos menos pasos exija registrar una tarea, más probable es que se use.",
      "Si el centro ya trabaja con una plataforma concreta, suele ser útil empezar por ella para evitar duplicar información. Después puedes añadir una herramienta personal si necesitas separar estudio, exámenes y actividades.",
      "En estudiantes menores conviene revisar privacidad, permisos, publicidad y opciones de cuenta antes de instalar una aplicación. También es recomendable limitar las notificaciones a las que realmente ayudan.",
      "Para estudiar, las tarjetas de memoria, listas de repaso y temporizadores pueden ser útiles, pero ninguna app sustituye a un método de estudio adaptado a la asignatura y al estudiante.",
      "Prueba una herramienta durante unos días con un objetivo concreto. Si reduce olvidos y hace más fácil planificar, probablemente encaja; si añade trabajo administrativo, simplifica.",
    ],
  },
  {
    id: 5,
    slug: "ampas-transformando-economia-escolar",
    title: "Ideas para que un AMPA impulse la reutilización de material escolar",
    description:
      "Cómo organizar un sistema sencillo de intercambio y donación de material escolar con normas claras y participación de las familias.",
    category: "Educación",
    readingTime: "5 min lectura",
    date: "28 Ene 2026",
    publishedAt: "2026-01-28",
    updatedAt: "2026-09-18",
    content: [
      "Un programa de reutilización funciona mejor cuando el proceso es fácil de entender. El AMPA puede empezar definiendo qué materiales se aceptan, en qué estado y cómo se ponen en contacto las familias.",
      "Separar venta, donación e intercambio evita confusiones. También ayuda publicar criterios básicos sobre fotos, descripción del estado y datos que deben incluirse en libros de texto, como curso, editorial e ISBN.",
      "No es necesario centralizar el dinero ni la entrega para que el AMPA facilite la iniciativa. Puede actuar como impulsor de la comunidad y dejar que las familias acuerden directamente los detalles entre ellas.",
      "Las donaciones requieren especial cuidado con la privacidad y la dignidad de las familias. Evita publicar información sobre necesidades económicas concretas y utiliza procesos neutrales cuando haya que priorizar solicitudes.",
      "Conviene empezar con un grupo pequeño, observar qué categorías se mueven más y recoger dudas frecuentes. Esa información permite mejorar las reglas antes de ampliar la iniciativa.",
      "Wetudy permite usar el centro como referencia de comunidad, publicar material y conversar por chat. El alta de nuevos centros se revisa antes de activarse.",
    ],
  },
  {
    id: 6,
    slug: "vuelta-al-cole-2026-lista-material-curso",
    title: "Vuelta al cole 2026: cómo preparar la lista de material por curso",
    description:
      "Una plantilla práctica para revisar la lista del centro, separar lo reutilizable y buscar material por curso, asignatura, editorial o ISBN.",
    category: "Organización",
    readingTime: "4 min lectura",
    date: "22 Ene 2026",
    publishedAt: "2026-01-22",
    updatedAt: "2026-09-18",
    content: [
      "Las listas de material cambian entre centros y cursos, así que la referencia principal debe ser siempre la información facilitada por tu colegio o instituto.",
      "Empieza creando tres grupos: material que ya tienes y sigue sirviendo, material que debes sustituir y material que todavía necesitas confirmar con el centro.",
      "Para libros de texto, anota título, asignatura, editorial, edición e ISBN cuando aparezca. Estos datos hacen mucho más precisa la búsqueda de ejemplares usados.",
      "En Primaria y Secundaria suele ser útil revisar también calculadoras, diccionarios, material de dibujo, instrumentos y lecturas obligatorias, porque muchos de estos artículos pueden durar varios cursos.",
      "En uniformes, comprueba las medidas actuales antes de buscar. Si publicas prendas que ya no necesitas, añade talla, medidas orientativas y fotos del estado real.",
      "No compres por adelantado aquello que el centro todavía no haya confirmado. Esperar a la lista definitiva evita duplicados y cambios de última hora.",
      "En Wetudy puedes buscar por categoría, curso, título, editorial o ISBN y guardar búsquedas. Cuando encuentres una opción, contacta por chat para acordar los detalles directamente.",
    ],
  },
]

export const categoryColors: Record<string, string> = {
  Ahorro: "bg-[#7EBA28] text-[#fff]",
  Consejos: "bg-primary text-primary-foreground",
  Sostenibilidad: "bg-[#7EBA28] text-[#fff]",
  Tecnología: "bg-primary text-primary-foreground",
  Educación: "bg-primary text-primary-foreground",
  Organización: "bg-[#7EBA28] text-[#fff]",
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug)
}
