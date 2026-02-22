export interface BlogPost {
  id: number
  slug: string
  title: string
  description: string
  category: string
  readingTime: string
  date: string
  content: string[]
}

export const posts: BlogPost[] = [
  {
    id: 1,
    slug: "10-formas-ahorrar-material-escolar",
    title: "10 formas de ahorrar en material escolar esta temporada",
    description: "La vuelta al cole no tiene por que ser sinonimo de gasto excesivo. Te compartimos estrategias probadas para ahorrar hasta un 60% en material escolar.",
    category: "Ahorro",
    readingTime: "5 min lectura",
    date: "14 Feb 2026",
    content: [
      "La vuelta al cole es uno de los momentos mas costosos del ano para las familias espanolas. Segun datos del sector, el gasto medio por hijo puede superar los 400 euros entre libros de texto, material escolar y uniformes. Sin embargo, existen estrategias efectivas para reducir este gasto de forma significativa sin comprometer la calidad educativa.",
      "La primera y mas obvia es la reutilizacion de libros de texto. Plataformas como Wetudy permiten a las familias comprar y vender libros de segunda mano dentro de su propia comunidad escolar, lo que garantiza que los libros correspondan al curriculo del centro. El ahorro medio por libro es de entre un 50% y un 70% respecto al precio de venta al publico.",
      "Otra estrategia fundamental es comprar material escolar basico en grandes cantidades. Los cuadernos, boligrafos, lapices y carpetas suelen tener descuentos importantes cuando se compran en packs o al por mayor. Muchas familias organizan compras conjuntas a traves de las asociaciones de padres para beneficiarse de precios mayoristas.",
      "Los uniformes escolares representan otro gasto importante que se puede reducir drasticamente. Un uniforme completo puede costar mas de 150 euros, pero en buen estado puede durar varios cursos y transmitirse entre hermanos o entre familias del mismo centro. Las donaciones de uniformes son especialmente valiosas para familias con menos recursos.",
      "La tecnologia tambien ofrece oportunidades de ahorro. Antes de comprar una calculadora cientifica, un portatil o una tablet nueva, vale la pena explorar opciones de segunda mano. Estos dispositivos suelen tener una vida util muy superior a un curso escolar, y adquirirlos de segunda mano puede suponer ahorros de mas del 40%.",
      "Finalmente, planificar con antelacion es clave. Las familias que empiezan a buscar material dos o tres meses antes del inicio del curso encuentran mejores precios y mayor disponibilidad. No esperes a septiembre: empieza en junio a recopilar la lista de material y buscar opciones de reutilizacion.",
    ],
  },
  {
    id: 2,
    slug: "guia-evaluar-estado-libros-texto-usados",
    title: "Guia completa: como evaluar el estado de los libros de texto usados",
    description: "Aprende a identificar si un libro de segunda mano esta en condiciones optimas para el estudio. Criterios claros para compradores y vendedores.",
    category: "Consejos",
    readingTime: "4 min lectura",
    date: "10 Feb 2026",
    content: [
      "Comprar libros de texto de segunda mano es una de las formas mas inteligentes de ahorrar en la vuelta al cole. Sin embargo, es fundamental saber evaluar correctamente el estado de un libro para asegurar que cumple con las necesidades del estudiante. En Wetudy usamos un sistema de cinco niveles de estado que facilita esta tarea.",
      "El nivel 'Nuevo con etiquetas' corresponde a libros que nunca han sido utilizados y conservan su embalaje original o precinto. Es como comprarlo en la libreria, pero a una fraccion del precio. Esto ocurre mas de lo que pensamos: familias que compran el libro equivocado, cambios de centro o de asignaturas optativas.",
      "El nivel 'Nuevo sin etiquetas' abarca libros que, aunque fueron sacados de su embalaje, no han sido utilizados academicamente. Pueden tener el nombre del alumno escrito en la primera pagina, pero el contenido esta intacto, sin subrayados ni anotaciones.",
      "El nivel 'Muy bueno' es quiza el mas habitual en libros de un solo curso de uso. El libro ha sido utilizado, puede tener anotaciones a lapiz (borrables) o algun subrayado, pero todas las paginas estan completas y en buen estado. Es una excelente opcion calidad-precio.",
      "Los niveles 'Bueno' y 'Satisfactorio' corresponden a libros con mayor uso. Pueden tener anotaciones permanentes, desgaste en las tapas o lomos, y en el caso de 'Satisfactorio', alguna pagina suelta o desgaste significativo. Aun asi, si el contenido es legible, siguen siendo utiles y mucho mas accesibles economicamente.",
      "Como vendedor, la honestidad en la descripcion es esencial. Toma fotos claras de las tapas, el lomo, las paginas mas desgastadas y cualquier defecto. Una descripcion precisa genera confianza y evita reclamaciones posteriores. Recuerda que en Wetudy la reputacion del vendedor se construye con cada transaccion.",
    ],
  },
  {
    id: 3,
    slug: "impacto-ambiental-reutilizar-uniformes",
    title: "El impacto ambiental de reutilizar uniformes escolares",
    description: "Cada uniforme reutilizado ahorra 15 kg de CO2. Analizamos los datos y el impacto real de la economia circular en el ambito escolar.",
    category: "Sostenibilidad",
    readingTime: "6 min lectura",
    date: "5 Feb 2026",
    content: [
      "La industria textil es la segunda mas contaminante del mundo, responsable del 10% de las emisiones globales de carbono y del 20% de la contaminacion del agua. En este contexto, la reutilizacion de uniformes escolares se presenta como una accion concreta y medible para reducir nuestra huella ambiental colectiva.",
      "Un uniforme escolar tipico, compuesto por polo, jersey y pantalon, requiere aproximadamente 2.700 litros de agua para su fabricacion, lo equivalente al consumo de agua potable de una persona durante 2,5 anos. Ademas, la produccion emite alrededor de 15 kg de CO2, comparable a conducir un coche durante 80 km.",
      "Cuando una familia reutiliza un uniforme a traves de Wetudy, esta evitando directamente esa huella ambiental. Si consideramos que un centro escolar medio tiene 400 alumnos y un 30% reutiliza al menos una prenda del uniforme, el ahorro anual seria de 1.800 kg de CO2 y 324.000 litros de agua solo en ese centro.",
      "Pero el impacto va mas alla de las cifras de produccion. Cada prenda que no se fabrica tambien evita el transporte desde las fabricas (a menudo en Asia), el embalaje plastico, y el eventual destino en vertedero. En Espana, mas del 80% de la ropa desechada acaba en vertederos en lugar de ser reciclada.",
      "Las comunidades escolares tienen un poder transformador enorme. Cuando un centro educativo adopta una cultura de reutilizacion, no solo reduce su impacto ambiental, sino que educa a las nuevas generaciones en valores de sostenibilidad y consumo responsable. Los ninos que crecen en esta cultura son mas propensos a mantener estos habitos en su vida adulta.",
      "En Wetudy hemos medido que cada centro activo en nuestra plataforma evita una media de 450 kg de CO2 al ano, equivalente a plantar 22 arboles. A medida que mas centros se suman, el impacto agregado crece exponencialmente. Tu centro puede ser el proximo en contribuir.",
    ],
  },
  {
    id: 4,
    slug: "mejores-apps-organizar-estudio-hijos",
    title: "Las mejores apps para organizar el estudio de tus hijos",
    description: "Seleccion de aplicaciones gratuitas y de pago para gestionar horarios, deberes y examenes. Recomendadas por docentes.",
    category: "Tecnologia",
    readingTime: "7 min lectura",
    date: "1 Feb 2026",
    content: [
      "En la era digital, la tecnologia puede ser una aliada fundamental para la organizacion escolar. Desde aplicaciones de gestion de tareas hasta herramientas de planificacion de examenes, existen opciones adaptadas a cada edad y necesidad. Aqui analizamos las mas destacadas, recomendadas por docentes y familias.",
      "Para los mas pequenos (Primaria), apps como Google Classroom y ClassDojo han revolucionado la comunicacion entre centro y familias. ClassDojo permite a los profesores compartir fotos y actividades del aula, mientras que Google Classroom facilita la entrega de tareas digitales. Ambas son gratuitas y ampliamente utilizadas en centros espanoles.",
      "Para alumnos de ESO y Bachillerato, la gestion del tiempo se vuelve critica. Notion ofrece una version gratuita para educacion que permite crear bases de datos de tareas, calendarios de examenes y notas organizadas por asignatura. Su curva de aprendizaje es moderada, pero los resultados en organizacion son excepcionales.",
      "En cuanto a herramientas de estudio activo, Anki y Quizlet destacan para la memorizacion mediante tarjetas de repeticion espaciada. Son especialmente efectivas para idiomas, vocabulario cientifico y fechas historicas. Quizlet tiene una version gratuita muy completa, mientras que Anki es totalmente gratuita en su version de escritorio.",
      "Para la planificacion a largo plazo, My Study Life es una aplicacion gratuita disenada especificamente para estudiantes. Permite gestionar horarios rotativos (habituales en muchos institutos), registrar tareas con fechas de entrega y planificar periodos de examenes con recordatorios inteligentes.",
      "Un consejo importante: la tecnologia debe ser un complemento, no un sustituto. Los expertos recomiendan combinar herramientas digitales con tecnicas analogicas como la agenda en papel, los mapas mentales manuscritos y los resumenes escritos a mano, ya que la escritura manual mejora la retencion de informacion.",
    ],
  },
  {
    id: 5,
    slug: "ampas-transformando-economia-escolar",
    title: "Como los AMPAs estan transformando la economia escolar",
    description: "Casos de exito de asociaciones de padres que han implantado sistemas de reutilizacion en sus centros con resultados sorprendentes.",
    category: "Educacion",
    readingTime: "5 min lectura",
    date: "28 Ene 2026",
    content: [
      "Las Asociaciones de Madres y Padres de Alumnos (AMPAs) estan demostrando que las comunidades educativas pueden ser motores de cambio real. En toda Espana, decenas de AMPAs han implementado sistemas de reutilizacion de material escolar que generan ahorros significativos y refuerzan los lazos comunitarios.",
      "El caso del CEIP San Miguel en Madrid es paradigmatico. Su AMPA implemento Wetudy como plataforma oficial de intercambio en septiembre de 2025, y en solo tres meses, 342 familias participaron activamente. El ahorro medio por familia fue de 78 euros, y se donaron 156 articulos a familias con dificultades economicas.",
      "Otro caso destacado es el del IES Cervantes, tambien en Madrid, donde el AMPA organizo una 'Feria de Reutilizacion' presencial combinada con la plataforma digital. El evento atrajo a mas de 200 familias en una sola jornada y genero un volumen de intercambios que normalmente llevaria meses.",
      "La clave del exito segun estas AMPAs es la confianza. Al ser una plataforma cerrada por comunidad escolar, las familias saben que estan tratando con vecinos y companeros del mismo centro. Esto elimina las barreras de desconfianza habituales en plataformas de segunda mano generalistas.",
      "Para las AMPAs que quieran implementar un sistema similar, el proceso es sencillo: registrar el centro en Wetudy, recibir un codigo de acceso exclusivo, y comunicar la iniciativa a las familias a traves de los canales habituales del centro. El soporte de Wetudy incluye materiales de comunicacion y asistencia en la puesta en marcha.",
      "El impacto social de estas iniciativas trasciende lo economico. Familias que apenas se conocian comienzan a interactuar, se crean redes de apoyo mutuo, y se genera un sentimiento de comunidad que beneficia a todo el entorno escolar. La reutilizacion es solo la excusa; la comunidad es el verdadero resultado.",
    ],
  },
  {
    id: 6,
    slug: "vuelta-al-cole-2026-lista-material-curso",
    title: "Vuelta al cole 2026: lista de material por curso",
    description: "Listado actualizado de material escolar necesario para cada curso, desde Infantil hasta Bachillerato. Descarga gratuita incluida.",
    category: "Economia",
    readingTime: "3 min lectura",
    date: "22 Ene 2026",
    content: [
      "Cada ano, las familias se enfrentan al mismo reto: conseguir todo el material escolar que sus hijos necesitan sin dejarse el sueldo en el intento. Para facilitar esta tarea, hemos elaborado un listado orientativo del material tipico por etapa educativa, actualizado para el curso 2026-2027.",
      "En Educacion Infantil (3-5 anos), el material suele ser basico: babi, mochila sin ruedas, botella de agua, almuerzo, y material de papeleria que generalmente se compra de forma colectiva a traves del centro. El coste medio oscila entre 80 y 120 euros.",
      "En Educacion Primaria (6-11 anos), la lista crece: libros de texto (el gasto mas importante, entre 200 y 300 euros nuevos), cuadernos, material de escritura, regla, pegamento, tijeras, agenda, y el uniforme si el centro lo requiere. Aqui es donde la reutilizacion marca mayor diferencia, ya que los libros de Primaria apenas cambian de un ano a otro.",
      "En ESO (12-15 anos), se anaden calculadora cientifica, diccionarios, material de dibujo tecnico, y libros de lectura obligatoria. El gasto en libros de texto puede superar los 350 euros, aunque la tendencia de muchos centros a usar libros digitales esta reduciendo este coste.",
      "En Bachillerato (16-17 anos), el material se especializa segun la modalidad elegida. Los libros de texto siguen siendo el gasto principal, y a ellos se suman materiales especificos como calculadoras graficas, material de laboratorio o programas informaticos.",
      "Nuestro consejo principal: antes de comprar nada nuevo, consulta la plataforma Wetudy de tu centro. Es probable que encuentres la mayoria del material que necesitas a una fraccion del precio, en buen estado, y contribuyendo a la sostenibilidad de tu comunidad educativa.",
    ],
  },
]

export const categoryColors: Record<string, string> = {
  Ahorro: "bg-[#7EBA28] text-[#fff]",
  Consejos: "bg-primary text-primary-foreground",
  Sostenibilidad: "bg-[#7EBA28] text-[#fff]",
  Tecnologia: "bg-primary text-primary-foreground",
  Educacion: "bg-primary text-primary-foreground",
  Economia: "bg-[#7EBA28] text-[#fff]",
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find(p => p.slug === slug)
}
