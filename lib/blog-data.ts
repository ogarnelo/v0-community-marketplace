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
    id: 11,
    slug: "como-buscar-libros-texto-usados-isbn",
    title: "Cómo buscar libros de texto usados por ISBN y evitar equivocarte",
    description:
      "Aprende a usar el ISBN, la edición, la editorial y las fotos para encontrar el libro de texto usado correcto.",
    category: "Consejos",
    readingTime: "5 min lectura",
    date: "21 Sep 2026",
    publishedAt: "2026-09-21",
    content: [
      "Cuando buscas un libro de texto usado, el ISBN es uno de los datos más útiles para comprobar que estás mirando la edición correcta. Es un identificador asociado a una publicación concreta y suele aparecer cerca del código de barras o en las primeras páginas del libro.",
      "Empieza por la lista oficial del centro. Anota ISBN, título, asignatura, editorial y curso. Si el centro solo facilita el título, conviene confirmar la edición antes de cerrar ningún acuerdo, porque una misma colección puede tener versiones muy parecidas.",
      "Compara el ISBN completo, dígito a dígito. No te fíes únicamente de la portada: algunas editoriales mantienen diseños similares entre ediciones y otras cambian la cubierta sin que eso sea suficiente para identificar el contenido.",
      "El ISBN tampoco sustituye a revisar el estado. Pide fotos reales de portada, contraportada, lomo y varias páginas interiores. En cuadernos de actividades, comprueba especialmente si los ejercicios están escritos o si falta material complementario.",
      "Si el ISBN del anuncio no coincide con el de la lista del centro, no asumas que el libro sirve porque el título sea parecido. Pregunta al centro o al profesor antes de comprar. Una comprobación de un minuto puede evitar adquirir una edición que no se utilizará.",
      "Al publicar en Wetudy, incluir ISBN, editorial, curso y fotos claras facilita que otras familias encuentren el libro correcto mediante la búsqueda. La entrega y el pago se acuerdan directamente entre las partes.",
    ],
  },
  {
    id: 10,
    slug: "como-vender-libros-texto-usados",
    title: "Cómo vender libros de texto usados: fotos, ISBN, estado y precio",
    description:
      "Guía práctica para preparar un anuncio claro de libros de texto usados y reducir dudas antes de contactar.",
    category: "Ahorro",
    readingTime: "6 min lectura",
    date: "21 Sep 2026",
    publishedAt: "2026-09-21",
    content: [
      "Un buen anuncio de un libro de texto usado debe permitir que otra familia responda a tres preguntas rápidamente: si es la edición que necesita, en qué estado está y qué incluye exactamente.",
      "Antes de publicar, localiza el ISBN y comprueba el título, editorial, asignatura y curso. Es mejor copiar estos datos desde el propio libro que confiar en la memoria o en una descripción de otro anuncio.",
      "Haz fotos del ejemplar real con buena luz. Incluye portada, contraportada, lomo y cualquier defecto relevante. Si hay anotaciones, subrayados, pegatinas, páginas dobladas o ejercicios resueltos, enséñalos o descríbelos de forma clara.",
      "Al indicar el estado, evita expresiones ambiguas como 'perfecto' si el libro presenta desgaste. Describir de forma concreta el uso real ayuda a reducir malentendidos y permite comparar mejor distintas opciones.",
      "Para fijar un precio, ten en cuenta el estado, si la edición sigue vigente, si falta algún componente y qué precio tiene actualmente el material nuevo. No existe un porcentaje universal que sirva para todos los libros, así que es mejor valorar cada ejemplar de forma individual.",
      "Si vendes varios libros del mismo curso, puedes indicar en cada anuncio qué volumen o asignatura corresponde. No des por hecho que una familia necesita el lote completo: la información detallada hace más fácil encontrar coincidencias útiles.",
      "Cuando alguien contacte, confirma de nuevo el libro y sus condiciones antes de quedar. En Wetudy el chat sirve para resolver dudas y la entrega y el pago se acuerdan directamente entre las partes.",
    ],
  },
  {
    id: 9,
    slug: "uniformes-escolares-segunda-mano-guia",
    title: "Uniformes escolares de segunda mano: qué revisar antes de comprar",
    description:
      "Medidas, estado, costuras, manchas y modelo: una lista práctica para comprobar un uniforme escolar usado.",
    category: "Consejos",
    readingTime: "5 min lectura",
    date: "21 Sep 2026",
    publishedAt: "2026-09-21",
    content: [
      "Comprar o reutilizar un uniforme escolar de segunda mano puede alargar la vida de prendas que todavía están en buen estado, pero conviene comprobar algo más que la talla de la etiqueta.",
      "Empieza confirmando que la prenda corresponde al modelo que exige el centro. Revisa color, logotipo, tipo de tejido y cualquier detalle específico, porque algunos colegios actualizan sus prendas o trabajan con más de un proveedor.",
      "Pide medidas cuando sea posible. Largo total, cintura, contorno o longitud de manga pueden resultar más útiles que una talla genérica, especialmente si la prenda ha sido lavada muchas veces o si las marcas tallan de forma distinta.",
      "Comprueba las zonas de mayor desgaste: rodillas y bajos en pantalones, puños y cuello en polos y jerséis, cremalleras, botones, costuras y elásticos. Las fotos deben mostrar también manchas permanentes, reparaciones o decoloración.",
      "Pregunta si la prenda se ha lavado y sigue las instrucciones de su etiqueta antes de usarla. En artículos textiles compartidos, una limpieza adecuada antes del siguiente uso es una medida básica de cuidado.",
      "Si una prenda necesita un arreglo sencillo, valora el coste y el resultado antes de descartarla. Un botón, un bajo o una pequeña costura pueden ser reparables; un tejido muy deteriorado puede no compensar.",
      "En Wetudy puedes indicar talla, medidas, estado y fotos reales del uniforme para que otra familia valore si le sirve antes de contactar.",
    ],
  },
  {
    id: 8,
    slug: "que-hacer-libros-texto-curso-anterior",
    title: "Qué hacer con los libros de texto del curso anterior: reutilizar, vender o donar",
    description:
      "Pasos para decidir qué libros guardar, reutilizar, vender o donar al terminar el curso escolar.",
    category: "Organización",
    readingTime: "5 min lectura",
    date: "21 Sep 2026",
    publishedAt: "2026-09-21",
    content: [
      "Al terminar un curso es fácil guardar todos los libros en una caja y olvidarse de ellos. Revisarlos mientras todavía tienes a mano la lista, el curso y la edición facilita decidir cuáles pueden tener una segunda vida.",
      "Separa primero los libros que la familia puede necesitar de nuevo: lecturas que vayan a utilizar hermanos, diccionarios, atlas u otros materiales de consulta. Para los libros de texto, comprueba si el centro mantiene la misma edición para el curso siguiente.",
      "Después revisa el estado de cada ejemplar. Los libros completos, legibles y con un desgaste razonable suelen ser los mejores candidatos para reutilizar. Los cuadernos fungibles con la mayoría de ejercicios completados normalmente ofrecen menos posibilidades de uso.",
      "Anota el ISBN antes de guardar o publicar el libro. Ese dato permite a otra familia comparar exactamente la edición que necesita y evita depender solo del título o de la portada.",
      "Si quieres vender, prepara fotos claras y una descripción honesta del estado. Si prefieres donar, ofrece la misma información: una donación útil también necesita que la persona que la recibe sepa qué material es y en qué condiciones está.",
      "No hace falta decidir todo el mismo día. Puedes conservar temporalmente los libros cuya vigencia no esté confirmada y publicar el resto cuando el centro haya comunicado las listas definitivas.",
      "Reutilizar, vender o donar son opciones distintas para un mismo objetivo práctico: evitar que un material todavía útil quede almacenado sin uso o se sustituya antes de tiempo.",
    ],
  },
  {
    id: 7,
    slug: "material-escolar-segunda-mano-que-reutilizar",
    title: "Material escolar de segunda mano: qué merece la pena reutilizar",
    description:
      "Qué materiales escolares suelen admitir varios cursos y cuáles conviene revisar con más cuidado antes de reutilizarlos.",
    category: "Sostenibilidad",
    readingTime: "6 min lectura",
    date: "21 Sep 2026",
    publishedAt: "2026-09-21",
    content: [
      "No todo el material escolar envejece de la misma forma. Antes de comprar nuevo, conviene revisar qué artículos pueden seguir cumpliendo su función durante otro curso y cuáles son consumibles o necesitan una comprobación más cuidadosa.",
      "Mochilas, estuches, reglas, compases, calculadoras, diccionarios, instrumentos musicales y parte del material de dibujo suelen poder utilizarse durante varios cursos si funcionan correctamente y están en buen estado.",
      "En libros de texto, la clave no es solo el desgaste: también importa que la edición sea la correcta. Comprueba ISBN, editorial y curso. En libros de actividades, revisa si los ejercicios ya están completados.",
      "Para uniformes y ropa escolar, mira medidas, costuras, elásticos, cremalleras y manchas. Una prenda puede estar visualmente bien pero no ajustarse ya a las normas o al modelo vigente del centro.",
      "En material electrónico o de precisión, como calculadoras, comprueba botones, pantalla, tapa de pilas y funcionamiento. Si necesita accesorios específicos, confirma que estén incluidos o que puedan conseguirse por separado.",
      "Hay artículos personales, consumibles o deteriorados que pueden no ser adecuados para un segundo uso. El criterio debe ser que el material siga siendo funcional, seguro para su uso normal y esté descrito con transparencia.",
      "Hacer este inventario antes de cada curso ayuda a comprar solo lo que falta. Además, permite publicar con tiempo lo que ya no necesitas para que otra familia pueda aprovecharlo.",
    ],
  },
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
