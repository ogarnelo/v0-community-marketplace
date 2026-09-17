export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  readingTime: string;
  date: string;
  publishedAt: string;
  content: string[];
}

export const posts: BlogPost[] = [
  {
    id: 1,
    slug: "10-formas-ahorrar-material-escolar",
    title: "10 formas de ahorrar en material escolar reutilizando mejor",
    description:
      "Ideas prácticas para planificar el curso, reutilizar lo que ya tienes y encontrar libros, uniformes y material escolar de segunda mano.",
    category: "Ahorro",
    readingTime: "5 min lectura",
    date: "18 Sep 2026",
    publishedAt: "2026-09-18",
    content: [
      "Ahorrar en material escolar empieza antes de comprar. Revisa lo que quedó del curso anterior, separa lo que sigue en buen estado y contrasta la lista del centro para evitar duplicados.",
      "Pregunta primero en tu entorno cercano. Libros, uniformes, mochilas, calculadoras y material de dibujo suelen tener una vida útil mayor que un solo curso y pueden pasar de una familia a otra.",
      "Cuando busques libros usados, comprueba edición, editorial e ISBN si lo tienes disponible. Dos libros con una portada parecida pueden pertenecer a ediciones distintas, así que conviene confirmar el dato antes de acordar la entrega.",
      "En prendas y uniformes, pide medidas además de la talla. Las tallas cambian entre fabricantes y una medida sencilla de pecho, cintura o largo reduce errores.",
      "Prioriza anuncios con fotos reales y una descripción clara del estado. Si hay marcas, subrayados o desgaste, es mejor saberlo antes de contactar.",
      "Guarda búsquedas cuando todavía no haya resultados. Así puedes volver a ellas y recibir avisos si aparece material compatible.",
      "Agrupa necesidades por prioridad: lo imprescindible para el primer día, lo que puede esperar unas semanas y lo que quizá puedas pedir prestado. Esa separación ayuda a decidir con calma.",
      "Si publicas lo que ya no necesitas, describe el artículo con el mismo detalle que te gustaría encontrar como comprador. Una buena publicación facilita que el material siga circulando.",
      "Para donaciones, deja claro el estado y acuerda directamente con la otra parte cómo se hará la entrega. Wetudy conserva el contacto y el historial del acuerdo.",
      "La mejor estrategia no es comprar más barato a cualquier precio, sino comprar menos cosas nuevas cuando ya existen alternativas útiles, cercanas y en buen estado.",
    ],
  },
  {
    id: 2,
    slug: "guia-evaluar-estado-libros-texto-usados",
    title: "Cómo evaluar el estado de un libro de texto usado",
    description:
      "Una guía para revisar edición, ISBN, páginas, anotaciones, lomo y señales de desgaste antes de acordar la compra de un libro usado.",
    category: "Consejos",
    readingTime: "4 min lectura",
    date: "18 Sep 2026",
    publishedAt: "2026-09-18",
    content: [
      "Antes de valorar el estado físico, confirma que el libro es el correcto. Revisa título, editorial, curso y, cuando esté disponible, el ISBN. Es la forma más fiable de distinguir ediciones similares.",
      "Mira las tapas y el lomo. Un roce superficial no suele afectar al uso, pero un lomo despegado o una encuadernación muy abierta pueden hacer que las páginas terminen soltándose.",
      "Comprueba que no falten páginas y que las actividades importantes sigan siendo legibles. En cuadernos de ejercicios, pregunta si están escritos y hasta qué punto.",
      "Las anotaciones a lápiz suelen ser más fáciles de gestionar que los subrayados permanentes. Lo importante es que el anuncio las describa y las fotos permitan hacerse una idea realista.",
      "Si el libro incluye códigos digitales, licencias o material complementario, no des por hecho que siguen disponibles. Pregunta expresamente antes de cerrar el acuerdo.",
      "Como vendedor, fotografía la portada, el lomo y cualquier defecto relevante. Describir bien el estado reduce malentendidos y ayuda a que la otra familia decida con información suficiente.",
    ],
  },
  {
    id: 3,
    slug: "impacto-ambiental-reutilizar-uniformes",
    title: "Por qué reutilizar uniformes escolares alarga su vida útil",
    description:
      "Claves para cuidar, revisar y reutilizar uniformes escolares antes de sustituir prendas que todavía pueden seguir usándose.",
    category: "Sostenibilidad",
    readingTime: "5 min lectura",
    date: "18 Sep 2026",
    publishedAt: "2026-09-18",
    content: [
      "La fabricación de una prenda requiere materias primas, energía, agua, transporte y embalaje. Cuando un uniforme que todavía está en buen estado pasa a otra familia, se aprovecha durante más tiempo el trabajo y los recursos ya incorporados en esa prenda.",
      "Reutilizar no significa aceptar cualquier estado. Revisa costuras, cremalleras, botones, manchas permanentes y zonas de mayor roce. Una pequeña reparación puede ser suficiente para prolongar su uso.",
      "Para publicar un uniforme, indica talla y medidas reales cuando sea posible. Las fotos con buena luz y una descripción de los defectos ayudan mucho más que una etiqueta genérica de estado.",
      "El cuidado también importa. Seguir las instrucciones de lavado, evitar temperaturas innecesariamente altas y reparar pronto pequeños descosidos puede alargar la vida de la prenda.",
      "Cuando ya no sea reutilizable como uniforme, consulta las opciones de recogida o reciclaje textil disponibles en tu municipio. Reutilizar es una parte del ciclo; gestionar bien el final de vida también cuenta.",
      "Wetudy facilita que las familias encuentren prendas escolares cercanas y se contacten por chat. La decisión sobre el artículo y la entrega corresponde directamente a las partes.",
    ],
  },
  {
    id: 4,
    slug: "mejores-apps-organizar-estudio-hijos",
    title: "Herramientas digitales para organizar el estudio en familia",
    description:
      "Qué funciones buscar en calendarios, listas de tareas, temporizadores y herramientas de estudio sin depender de una app concreta.",
    category: "Tecnologia",
    readingTime: "5 min lectura",
    date: "18 Sep 2026",
    publishedAt: "2026-09-18",
    content: [
      "La herramienta más útil no siempre es la que tiene más funciones. Para organizar el estudio suele bastar con un calendario claro, una lista de tareas y una forma sencilla de dividir trabajos grandes en pasos pequeños.",
      "Un calendario compartido puede servir para exámenes, entregas y actividades. Conviene mantener pocas categorías y revisar la semana en un momento fijo para que la herramienta no se convierta en otra tarea pendiente.",
      "Las listas de tareas funcionan mejor cuando cada elemento describe una acción concreta. En lugar de 'estudiar ciencias', resulta más manejable separar lectura, ejercicios y repaso.",
      "Los temporizadores pueden ayudar a crear bloques de concentración y descansos, pero no existe una duración universal. La edad, el tipo de tarea y las necesidades de cada estudiante importan más que seguir una fórmula rígida.",
      "Antes de instalar una aplicación, revisa qué datos solicita, si requiere crear una cuenta y qué opciones de privacidad ofrece. En herramientas usadas por menores, la supervisión familiar y las políticas del centro son especialmente importantes.",
      "Si una libreta o un calendario de papel funciona bien, no hay obligación de digitalizarlo. La mejor herramienta es la que la familia puede mantener de forma sencilla y constante.",
    ],
  },
  {
    id: 5,
    slug: "ampas-transformando-economia-escolar",
    title: "Cómo puede un AMPA impulsar la reutilización de material escolar",
    description:
      "Una guía práctica para organizar comunicación, donaciones e intercambio de material escolar sin inventar cifras de impacto.",
    category: "Educacion",
    readingTime: "5 min lectura",
    date: "18 Sep 2026",
    publishedAt: "2026-09-18",
    content: [
      "Un programa de reutilización funciona mejor cuando las reglas son fáciles de entender: qué material se admite, cómo se describe su estado y quién se encarga de cada parte del proceso.",
      "El primer paso puede ser simplemente informar a las familias de que existe una vía para publicar lo que ya no necesitan y buscar antes de comprar nuevo. No hace falta empezar con una campaña compleja.",
      "Para libros de texto, ayuda recordar la importancia de edición, editorial e ISBN. Para uniformes, son útiles las tallas y medidas. Para otros artículos, las fotos y una descripción honesta del estado suelen ser suficientes.",
      "Un centro o AMPA puede actuar como referencia de comunidad sin tener que convertirse en intermediario de cada entrega. En Wetudy, las partes pueden contactar por chat y acordar directamente los detalles.",
      "Si se quiere medir el resultado, conviene empezar por indicadores observables: número de anuncios, acuerdos confirmados y donaciones registradas. Las estimaciones económicas o ambientales necesitan una metodología propia antes de publicarse como hechos.",
      "La confianza se construye con normas claras, moderación cuando hace falta y datos verificables. Es preferible empezar con un proceso pequeño y medible e ir ampliándolo con la experiencia real de la comunidad.",
    ],
  },
  {
    id: 6,
    slug: "vuelta-al-cole-2026-lista-material-curso",
    title: "Vuelta al cole 2026: checklist para preparar el material",
    description:
      "Una lista orientativa para revisar libros, papelería, mochila, uniforme y material específico antes de empezar el curso.",
    category: "Economia",
    readingTime: "4 min lectura",
    date: "18 Sep 2026",
    publishedAt: "2026-09-18",
    content: [
      "Cada centro y cada curso tiene necesidades distintas, así que la lista oficial del colegio debe ser siempre la referencia principal. Esta checklist sirve para ordenar la revisión antes de comprar.",
      "Empieza por los libros: comprueba asignatura, editorial, edición e ISBN cuando esté disponible. Si vas a reutilizar un libro del curso anterior, confirma que el centro mantiene la misma edición.",
      "Revisa cuadernos, carpetas, estuche y material de escritura. Muchos artículos parcialmente usados pueden seguir siendo válidos y no necesitan sustituirse al inicio de cada curso.",
      "Comprueba mochila, bolsa deportiva y recipientes reutilizables. Limpieza, cremalleras y costuras son buenos puntos de revisión antes de decidir si hace falta reemplazarlos.",
      "Si hay uniforme o ropa deportiva específica, prueba las prendas con tiempo. Lo que se haya quedado pequeño puede publicarse para otra familia mientras buscas la talla que necesitas.",
      "Deja para el final el material específico de asignaturas o actividades cuando el centro todavía no haya confirmado requisitos. Esperar a tener información precisa evita compras innecesarias.",
      "En Wetudy puedes buscar por título, categoría, curso, ISBN y distancia, o guardar una búsqueda si todavía no aparece el material que necesitas.",
    ],
  },
];

export const categoryColors: Record<string, string> = {
  Ahorro: "bg-[#7EBA28] text-[#fff]",
  Consejos: "bg-primary text-primary-foreground",
  Sostenibilidad: "bg-[#7EBA28] text-[#fff]",
  Tecnologia: "bg-primary text-primary-foreground",
  Educacion: "bg-primary text-primary-foreground",
  Economia: "bg-[#7EBA28] text-[#fff]",
};

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug);
}
