// Keyed by [lang][categoryId][LETTER] = [words...]
// Only covers the 8 default category ids (see lib/i18n.js CATEGORY_IDS) — custom
// categories the player adds have no data, so the bot simply skips them, which is
// realistic (a bot "doesn't know" a category it's never seen).
// Deliberately sparse on hard letters (K, Q, W, X, Y, Z, Ñ) — bots failing there
// is realistic, real players struggle with those too.

export const BOT_WORDBANK = {
  es: {
    name: {
      A: ["Ana", "Andrés", "Alejandro"], B: ["Beatriz", "Bruno", "Bárbara"], C: ["Carlos", "Camila", "Carmen"],
      D: ["Diego", "Daniela", "David"], E: ["Elena", "Eduardo", "Emilia"], F: ["Fernando", "Florencia", "Federico"],
      G: ["Gabriel", "Gabriela", "Gustavo"], H: ["Hugo", "Helena", "Horacio"], I: ["Ignacio", "Irene", "Iván"],
      J: ["Javier", "Julia", "Juan"], L: ["Lucas", "Laura", "Lorena"], M: ["María", "Martín", "Marcos"],
      N: ["Nicolás", "Natalia", "Nadia"], O: ["Oscar", "Olga", "Octavio"], P: ["Pedro", "Paula", "Patricia"],
      R: ["Ricardo", "Romina", "Rodrigo"], S: ["Sofía", "Santiago", "Sergio"], T: ["Tomás", "Teresa", "Tamara"],
      U: ["Ulises", "Urbano"], V: ["Valentina", "Víctor", "Vera"],
    },
    lastname: {
      A: ["Alvarez", "Acosta"], B: ["Benítez", "Bravo"], C: ["Castro", "Cabrera"], D: ["Díaz", "Duarte"],
      E: ["Espinoza", "Escobar"], F: ["Fernández", "Flores"], G: ["García", "Gómez"], H: ["Hernández", "Herrera"],
      I: ["Ibáñez", "Irigoyen"], J: ["Jiménez", "Juárez"], L: ["López", "Lima"], M: ["Martínez", "Molina"],
      N: ["Navarro", "Núñez"], O: ["Ortiz", "Ocampo"], P: ["Pérez", "Paredes"], R: ["Rodríguez", "Ramírez"],
      S: ["Sánchez", "Silva"], T: ["Torres", "Tapia"], U: ["Urquiza"], V: ["Vega", "Vargas"],
    },
    animal: {
      A: ["Araña", "Águila", "Ardilla"], B: ["Ballena", "Búho"], C: ["Caballo", "Cebra", "Conejo"],
      D: ["Delfín", "Dromedario"], E: ["Elefante", "Erizo"], F: ["Foca", "Flamenco"], G: ["Gato", "Gorila", "Ganso"],
      H: ["Hormiga", "Hipopótamo"], I: ["Iguana", "Impala"], J: ["Jabalí", "Jirafa"], L: ["León", "Lobo", "Lagarto"],
      M: ["Mono", "Murciélago"], N: ["Nutria"], O: ["Oso", "Oveja", "Orca"], P: ["Perro", "Pato", "Puma"],
      R: ["Rana", "Rinoceronte"], S: ["Serpiente", "Sapo"], T: ["Tigre", "Tortuga", "Toro"], U: ["Urraca"],
      V: ["Vaca", "Víbora"],
    },
    fruit: {
      A: ["Ananá", "Arándano"], B: ["Banana"], C: ["Cereza", "Ciruela"], D: ["Dátil"], F: ["Frutilla", "Frambuesa"],
      G: ["Granada", "Guayaba", "Guanábana"], L: ["Lima", "Limón"], M: ["Mango", "Manzana", "Melón"],
      N: ["Naranja", "Nectarina"], P: ["Pera", "Piña", "Palta"], S: ["Sandía"], T: ["Tomate", "Toronja"],
    },
    color: {
      A: ["Azul", "Amarillo"], B: ["Beige", "Blanco"], C: ["Celeste", "Café"], F: ["Fucsia"], G: ["Gris", "Granate"],
      L: ["Lila"], M: ["Magenta", "Marrón", "Morado"], N: ["Naranja", "Negro"], O: ["Ocre"], P: ["Púrpura", "Plateado"],
      R: ["Rojo", "Rosa"], T: ["Turquesa"], V: ["Verde", "Violeta"],
    },
    country: {
      A: ["Argentina", "Alemania"], B: ["Bolivia", "Brasil"], C: ["Colombia", "Chile", "Cuba"], D: ["Dinamarca"],
      E: ["Ecuador", "España", "Egipto"], F: ["Francia", "Filipinas"], G: ["Grecia", "Guatemala"],
      H: ["Honduras", "Holanda"], I: ["Italia", "India", "Irlanda"], J: ["Japón", "Jamaica"], L: ["Libia"],
      M: ["México", "Marruecos"], N: ["Nicaragua", "Noruega"], P: ["Perú", "Paraguay", "Portugal"],
      R: ["Rusia", "Rumania"], S: ["Suecia", "Suiza"], T: ["Turquía", "Tailandia"], U: ["Uruguay", "Ucrania"],
      V: ["Venezuela"],
    },
    object: {
      A: ["Anillo", "Auto"], B: ["Botella", "Bolso"], C: ["Cuchara", "Celular"], D: ["Destornillador"],
      E: ["Espejo", "Escoba"], F: ["Farol", "Florero"], G: ["Guitarra", "Gorra"], H: ["Hacha"], I: ["Impresora"],
      J: ["Jarrón"], L: ["Lámpara", "Llave"], M: ["Mesa", "Mochila"], P: ["Pluma", "Peine"], R: ["Reloj", "Regla"],
      S: ["Silla", "Sombrero"], T: ["Tijera", "Taza"], V: ["Vaso", "Ventilador"],
    },
    thing: {
      A: ["Aire"], B: ["Botón"], C: ["Caja"], D: ["Dinero"], E: ["Espuma"], F: ["Fuego"], G: ["Globo"],
      H: ["Hielo"], I: ["Idea"], J: ["Juguete"], L: ["Libro"], M: ["Moneda"], N: ["Nube"], P: ["Papel"],
      R: ["Ropa"], S: ["Sombra"], T: ["Tiempo"], U: ["Uña"], V: ["Viento"],
    },
  },
  en: {
    name: {
      A: ["Anna", "Andrew", "Alex"], B: ["Ben", "Beatrice", "Bruno"], C: ["Carlos", "Clara", "Charlie"],
      D: ["David", "Diana", "Daniel"], E: ["Emma", "Edward", "Elena"], F: ["Fiona", "Frank"], G: ["Grace", "George"],
      H: ["Hannah", "Henry"], I: ["Isabel", "Ian"], J: ["Jack", "Julia", "James"], L: ["Laura", "Leo"],
      M: ["Maria", "Mark", "Michael"], N: ["Nathan", "Nora"], O: ["Oscar", "Olivia"], P: ["Paul", "Patricia"],
      R: ["Robert", "Rachel"], S: ["Sophia", "Samuel", "Sarah"], T: ["Thomas", "Tina"], U: ["Ursula"],
      V: ["Victor", "Vanessa"],
    },
    lastname: {
      A: ["Anderson", "Allen"], B: ["Brown", "Baker"], C: ["Clark", "Collins"], D: ["Davis", "Diaz"],
      E: ["Evans"], F: ["Fisher", "Ford"], G: ["Garcia", "Green"], H: ["Harris", "Hughes"], I: ["Ingram"],
      J: ["Johnson", "Jones"], L: ["Lewis", "Lopez"], M: ["Martin", "Miller"], N: ["Nelson", "Newman"],
      O: ["Owens"], P: ["Parker", "Perez"], R: ["Robinson", "Rodriguez"], S: ["Smith", "Stewart"],
      T: ["Taylor", "Turner"], U: ["Underwood"], V: ["Vargas"],
    },
    animal: {
      A: ["Ant", "Alligator"], B: ["Bear", "Bat"], C: ["Cat", "Camel"], D: ["Dog", "Dolphin"],
      E: ["Elephant", "Eagle"], F: ["Fox", "Frog"], G: ["Giraffe", "Goat"], H: ["Horse", "Hippo"], I: ["Iguana"],
      J: ["Jaguar"], L: ["Lion", "Lizard"], M: ["Monkey", "Mouse"], N: ["Newt"], O: ["Owl", "Otter"],
      P: ["Pig", "Panda"], R: ["Rabbit", "Rat"], S: ["Snake", "Sheep"], T: ["Tiger", "Turtle"], U: ["Urchin"],
      V: ["Vulture"],
    },
    fruit: {
      A: ["Apple", "Apricot"], B: ["Banana"], C: ["Cherry", "Coconut"], D: ["Date"], F: ["Fig"],
      G: ["Grape", "Guava"], L: ["Lemon", "Lime"], M: ["Mango", "Melon"], O: ["Orange"], P: ["Peach", "Pear", "Plum"],
      R: ["Raspberry"], S: ["Strawberry"], T: ["Tangerine"],
    },
    color: {
      A: ["Amber", "Aqua"], B: ["Black", "Blue"], C: ["Coral", "Cyan"], G: ["Gold", "Green", "Gray"],
      I: ["Indigo"], M: ["Magenta", "Maroon"], N: ["Navy"], O: ["Orange"], P: ["Pink", "Purple"], R: ["Red"],
      S: ["Silver"], T: ["Teal", "Turquoise"], V: ["Violet"],
    },
    country: {
      A: ["Argentina", "Australia"], B: ["Brazil", "Belgium"], C: ["Canada", "Chile", "China"],
      D: ["Denmark"], E: ["Egypt", "Ecuador"], F: ["France", "Finland"], G: ["Germany", "Greece"],
      H: ["Hungary"], I: ["Italy", "India", "Ireland"], J: ["Japan", "Jamaica"], L: ["Laos"],
      M: ["Mexico", "Morocco"], N: ["Norway", "Nigeria"], P: ["Peru", "Portugal", "Poland"],
      R: ["Russia", "Romania"], S: ["Spain", "Sweden"], T: ["Turkey", "Thailand"], U: ["Uruguay", "Ukraine"],
      V: ["Vietnam", "Venezuela"],
    },
    object: {
      A: ["Axe", "Anchor"], B: ["Bottle", "Bag"], C: ["Cup", "Chair"], D: ["Desk", "Doll"], E: ["Eraser"],
      F: ["Fork", "Flag"], G: ["Glass", "Guitar"], H: ["Hammer"], I: ["Iron"], J: ["Jar"], L: ["Lamp", "Lock"],
      M: ["Mirror", "Mug"], N: ["Needle"], O: ["Oven"], P: ["Pencil", "Phone"], R: ["Ring", "Rope"],
      S: ["Spoon", "Shoe"], T: ["Table", "Towel"], U: ["Umbrella"], V: ["Vase"],
    },
    thing: {
      A: ["Air"], B: ["Box"], C: ["Coin"], D: ["Dust"], E: ["Egg"], F: ["Fire"], G: ["Gift"], H: ["Heat"],
      I: ["Ice"], J: ["Joke"], L: ["Light"], M: ["Money"], N: ["News"], O: ["Oil"], P: ["Paper"], R: ["Rain"],
      S: ["Smoke"], T: ["Time"], U: ["Unit"], V: ["Voice"],
    },
  },
  // Lighter banks — cover fewer letters/categories. Bots fall back to "no answer" for
  // gaps, which is realistic. Extend these arrays anytime without touching any logic.
  de: {
    name: { A: ["Anna", "Andreas"], B: ["Ben", "Bianca"], C: ["Clara"], D: ["David", "Daniela"], E: ["Emil", "Erika"],
      F: ["Felix", "Frieda"], G: ["Greta"], H: ["Hans", "Hanna"], J: ["Jan", "Julia"], K: ["Klaus"], L: ["Lena", "Lukas"],
      M: ["Maria", "Max"], N: ["Nina"], P: ["Paul", "Petra"], S: ["Stefan", "Sophie"], T: ["Thomas"] },
    animal: { A: ["Affe", "Adler"], B: ["Bär", "Biene"], E: ["Elefant", "Ente"], F: ["Fuchs", "Frosch"],
      H: ["Hund", "Hase"], K: ["Katze"], L: ["Löwe"], M: ["Maus"], P: ["Pferd"], S: ["Schaf", "Schlange"], T: ["Tiger"] },
    color: { B: ["Blau", "Braun"], G: ["Grün", "Gelb", "Grau"], L: ["Lila"], O: ["Orange"], R: ["Rot", "Rosa"],
      S: ["Schwarz"], T: ["Türkis"], W: ["Weiß"] },
    country: { D: ["Deutschland"], F: ["Frankreich"], I: ["Italien"], J: ["Japan"], K: ["Kanada"], M: ["Mexiko"],
      P: ["Peru"], S: ["Spanien", "Schweden"], U: ["Ungarn"] },
  },
  pt: {
    name: { A: ["Ana", "André"], B: ["Beatriz", "Bruno"], C: ["Carlos", "Camila"], D: ["Diego", "Daniela"],
      E: ["Elena", "Eduardo"], F: ["Fernando"], G: ["Gabriel"], H: ["Hugo"], I: ["Igor"], J: ["João", "Julia"],
      L: ["Lucas", "Laura"], M: ["Maria", "Marcos"], P: ["Pedro", "Paula"], R: ["Ricardo"], S: ["Sofia", "Sergio"],
      T: ["Tomás"], V: ["Valentina"] },
    animal: { A: ["Aranha", "Águia"], B: ["Baleia"], C: ["Cavalo", "Cobra"], E: ["Elefante"], G: ["Gato", "Girafa"],
      L: ["Leão", "Lobo"], M: ["Macaco"], O: ["Onça", "Urso"], P: ["Pato", "Peixe"], R: ["Rato"], T: ["Tigre", "Tartaruga"] },
    color: { A: ["Azul", "Amarelo"], B: ["Branco"], L: ["Laranja", "Lilás"], P: ["Preto", "Roxo"], R: ["Rosa"],
      V: ["Verde", "Vermelho"] },
    country: { A: ["Argentina", "Alemanha"], B: ["Brasil"], C: ["Chile", "Colômbia"], E: ["Espanha"], F: ["França"],
      I: ["Itália"], J: ["Japão"], M: ["México"], P: ["Peru", "Portugal"], U: ["Uruguai"] },
  },
};

export function botAnswerFor(lang, categoryId, letter) {
  const bank = BOT_WORDBANK[lang]?.[categoryId]?.[letter?.toUpperCase()];
  if (!bank || bank.length === 0) return null;
  return bank[Math.floor(Math.random() * bank.length)];
}
