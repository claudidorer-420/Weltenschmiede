// Baut die Auftragsliste für die Monster-Porträts: tools/sdxl/portraits.json
// Aufruf: node tools/build-portrait-jobs.mjs
// Die SRD-Monster heißen auf Deutsch; für SDXL brauchen wir englische Begriffe.
// Die Namen sind fast alle zusammengesetzt, deshalb reicht ein Wörterbuch + ein paar Sonderfälle.
import { writeFileSync } from 'node:fs';
import { MONSTERS } from '../js/data/monsters-srd.js';

const WORT = {
  // Drachen
  ausgewachsener: 'adult', ausgewachsene: 'adult', junger: 'young', junge: 'young', uralter: 'ancient', uralte: 'ancient',
  drache: 'dragon', drachen: 'dragon', drachennestling: 'dragon wyrmling', drachenveteran: 'dragonborn veteran',
  blauer: 'blue', blaue: 'blue', roter: 'red', rote: 'red', grüner: 'green', grüne: 'green', schwarzer: 'black', schwarze: 'black',
  weißer: 'white', weiße: 'white', bronzedrache: 'bronze dragon', golddrache: 'gold dragon', kupferdrache: 'copper dragon',
  messingdrache: 'brass dragon', silberdrache: 'silver dragon', bronzedrachennestling: 'bronze dragon wyrmling',
  golddrachennestling: 'gold dragon wyrmling', kupferdrachennestling: 'copper dragon wyrmling',
  messingdrachennestling: 'brass dragon wyrmling', silberdrachennestling: 'silver dragon wyrmling',
  halbroter: 'half-red', pseudodrache: 'pseudodragon', drachenschildkröte: 'dragon turtle',
  // Riesen und Elementare
  riese: 'giant', hügelriese: 'hill giant', frostriese: 'frost giant', feuerriese: 'fire giant', steinriese: 'stone giant',
  wolkenriese: 'cloud giant', sturmriese: 'storm giant', erdelementar: 'earth elemental', feuerelementar: 'fire elemental',
  luftelementar: 'air elemental', wasserelementar: 'water elemental', 'dampf-mephit': 'steam mephit', 'eis-mephit': 'ice mephit',
  'magma-mephit': 'magma mephit', 'staub-mephit': 'dust mephit', magmin: 'magmin', xorn: 'xorn', azer: 'azer',
  // Untote
  skelett: 'skeleton', zombie: 'zombie', ogerzombie: 'ogre zombie', 'minotaurus-skelett': 'minotaur skeleton',
  'streitross-skelett': 'warhorse skeleton', ghul: 'ghoul', grul: 'ghast', gruftschrecken: 'wight', mumie: 'mummy',
  mumienfürst: 'mummy lord', lich: 'lich', vampir: 'vampire', vampirbrut: 'vampire spawn', geist: 'ghost',
  schatten: 'shadow', schreckgespenst: 'specter', todesalb: 'wraith', geisternaga: 'spirit naga', wächternaga: 'guardian naga',
  // Teufel und Dämonen
  bartteufel: 'bearded devil', eisteufel: 'ice devil', kettenteufel: 'chain devil', klingenteufel: 'barbed devil',
  knochenteufel: 'bone devil', hornteufel: 'horned devil', höllenschlundteufel: 'pit fiend', teufelchen: 'imp',
  erinnye: 'erinyes', lemure: 'lemure', quasit: 'quasit', dretch: 'dretch', vrock: 'vrock', hezrou: 'hezrou',
  glabrezu: 'glabrezu', nalfeshnee: 'nalfeshnee', marilith: 'marilith', balor: 'balor', rakshasa: 'rakshasa',
  'sukkubus/inkubus': 'succubus incubus', nachtmahr: 'nightmare horse', höllenhund: 'hell hound',
  // Himmlische und Feen
  deva: 'deva angel', planetar: 'planetar angel', solar: 'solar angel', couatl: 'couatl', einhorn: 'unicorn',
  pegasus: 'pegasus', dryade: 'dryad', satyr: 'satyr', feengeist: 'sprite', drinne: 'drider', baumhirte: 'treant',
  'erwachter baum': 'awakened tree', 'erwachter busch': 'awakened shrub', dschinni: 'djinni', ifriti: 'efreeti',
  // Humanoide
  adeliger: 'noble', akolyth: 'acolyte', assassine: 'assassin', bandit: 'bandit', banditenhauptmann: 'bandit captain',
  berserker: 'berserker', druide: 'druid', erzmagier: 'archmage', gladiator: 'gladiator', gemeiner: 'commoner',
  kultist: 'cultist', kultfanatiker: 'cult fanatic', magier: 'mage', priester: 'priest', ritter: 'knight',
  schläger: 'thug', späher: 'scout', spion: 'spy', stammeskrieger: 'tribal warrior', veteran: 'veteran', wache: 'guard',
  goblin: 'goblin', hobgoblin: 'hobgoblin', kobold: 'kobold', gnoll: 'gnoll', ork: 'orc', oger: 'ogre', seeoger: 'merrow',
  troll: 'troll', ettin: 'ettin', duergar: 'duergar dwarf', 'drow (elf)': 'drow dark elf', echsenmensch: 'lizardfolk',
  meervolk: 'merfolk', sahuagin: 'sahuagin', grimlock: 'grimlock', bullywug: 'bullywug', grottenschrat: 'bugbear',
  'gnom, tiefengnom (svirfneblin)': 'deep gnome svirfneblin', zentaur: 'centaur', minotaurus: 'minotaur',
  medusa: 'medusa', harpyie: 'harpy', lamia: 'lamia', oni: 'oni ogre mage', 'grüne vettel': 'green hag',
  seevettel: 'sea hag', nachtvettel: 'night hag', doppelgänger: 'doppelganger', werbär: 'werebear',
  wereber: 'wereboar', werratte: 'wererat', wertiger: 'weretiger', werwolf: 'werewolf',
  // Bestien
  adler: 'eagle', riesenadler: 'giant eagle', eule: 'owl', rieseneule: 'giant owl', falke: 'hawk', blutfalke: 'blood hawk',
  rabe: 'raven', rabenschwarm: 'swarm of ravens', geier: 'vulture', riesengeier: 'giant vulture', dachs: 'badger',
  riesendachs: 'giant badger', bär: 'bear', braunbär: 'brown bear', schwarzbär: 'black bear', eisbär: 'polar bear',
  eber: 'boar', rieseneber: 'giant boar', kamel: 'camel', katze: 'cat', krokodil: 'crocodile',
  riesenkrokodil: 'giant crocodile', hirsch: 'deer', reh: 'deer', elch: 'elk', riesenelch: 'giant elk',
  elefant: 'elephant', frosch: 'frog', riesenfrosch: 'giant frog', riesenkröte: 'giant toad', hyäne: 'hyena',
  riesenhyäne: 'giant hyena', schakal: 'jackal', löwe: 'lion', eidechse: 'lizard', rieseneidechse: 'giant lizard',
  mammut: 'mammoth', menschenaffe: 'ape', riesenaffe: 'giant ape', pavian: 'baboon', maultier: 'mule',
  oktopus: 'octopus', riesenoktopus: 'giant octopus', panther: 'panther', pony: 'pony', pferd: 'horse',
  reitpferd: 'riding horse', streitross: 'warhorse', zugpferd: 'draft horse', ratte: 'rat', riesenratte: 'giant rat',
  rattenschwarm: 'swarm of rats', hai: 'shark', jagdhai: 'hunter shark', riesenhai: 'giant shark', riffhai: 'reef shark',
  schlange: 'snake', giftschlange: 'poisonous snake', riesengiftschlange: 'giant poisonous snake',
  würgeschlange: 'constrictor snake', riesenwürgeschlange: 'giant constrictor snake', 'fliegende schlange': 'flying snake',
  spinne: 'spider', riesenspinne: 'giant spider', riesenwolfsspinne: 'giant wolf spider', phasenspinne: 'phase spider',
  skorpion: 'scorpion', riesenskorpion: 'giant scorpion', tiger: 'tiger', säbelzahntiger: 'saber-toothed tiger',
  wiesel: 'weasel', riesenwiesel: 'giant weasel', wolf: 'wolf', schreckenswolf: 'dire wolf', winterwolf: 'winter wolf',
  worg: 'worg', ziege: 'goat', riesenziege: 'giant goat', krabbe: 'crab', riesenkrabbe: 'giant crab',
  quipper: 'quipper fish', quippernschwarm: 'swarm of quippers', seepferdchen: 'sea horse',
  riesenseepferdchen: 'giant sea horse', killerwal: 'killer whale', fledermaus: 'bat', riesenfledermaus: 'giant bat',
  fledermausschwarm: 'swarm of bats', insektenschwarm: 'swarm of insects', riesenfeuerkäfer: 'giant fire beetle',
  riesenwespe: 'giant wasp', riesentausendfüßler: 'giant centipede', blutmücke: 'stirge', dogge: 'mastiff dog',
  todeshund: 'death dog', flimmerhund: 'blink dog', nashorn: 'rhinoceros', triceratops: 'triceratops',
  plesiosaurier: 'plesiosaur', 'tyrannosaurus rex': 'tyrannosaurus rex', axtschnabel: 'axe beak',
  // Ungeheuer und Konstrukte
  aboleth: 'aboleth', androsphinx: 'androsphinx', gynosphinx: 'gynosphinx', ankheg: 'ankheg', atterkopp: 'ettercap',
  basilisk: 'basilisk', behir: 'behir', chimäre: 'chimera', chuul: 'chuul', darkmantle: 'darkmantle',
  düstermantel: 'darkmantle', eulenbär: 'owlbear', gargyl: 'gargoyle', gorgone: 'gorgon', greif: 'griffon',
  pferdegreif: 'hippogriff', grick: 'grick', hydra: 'hydra', kraken: 'kraken', mantikor: 'manticore',
  mantler: 'cloaker', mimik: 'mimic', otyugh: 'otyugh', purpurwurm: 'purple worm', remorhaz: 'remorhaz',
  roch: 'roc', rostmonster: 'rust monster', schreckhahn: 'cockatrice', seiler: 'roper', landhai: 'bulette',
  tarraske: 'tarrasque', unsichtbarer: 'invisible', pirscher: 'stalker', wyvern: 'wyvern', irrlicht: 'will-o-wisp',
  homunkulus: 'homunculus', schildwächter: 'shield guardian', eisengolem: 'iron golem', lehmgolem: 'clay golem',
  fleischgolem: 'flesh golem', steingolem: 'stone golem', 'belebte rüstung': 'animated armor',
  'fliegendes schwert': 'flying sword', 'teppich des erstickens': 'rug of smothering',
  'plapperndes hundertmaul': 'gibbering mouther', 'modernder schlurfer': 'shambling mound', kreischer: 'shrieker fungus',
  'violetter pilz': 'violet fungus', gallertwürfel: 'gelatinous cube', grauschlick: 'gray ooze',
  ockergallerte: 'ochre jelly', 'schwarzer blob': 'black pudding',
};

const ADJ = new Set(['adult', 'young', 'ancient', 'blue', 'red', 'green', 'black', 'white', 'giant', 'invisible', 'half-red']);

function englisch(name) {
  const clean = name.replace(/\s*Variante:.*$/i, '').trim();
  const ganz = WORT[clean.toLowerCase()];
  if (ganz) return ganz;
  const teile = clean.split(/[\s,]+/).filter(Boolean).map((w) => WORT[w.toLowerCase().replace(/[(),]/g, '')] || null);
  if (teile.every(Boolean)) return teile.join(' ');
  // Teilweise übersetzbar: bekannte Wörter tauschen, Rest so lassen (viele Namen sind ohnehin Kunstwörter)
  return clean.split(/[\s,]+/).map((w) => WORT[w.toLowerCase().replace(/[(),]/g, '')] || w).join(' ');
}

// ── Aussehen: Rüstung und Kleidung kommen aus dem Statblock, nicht aus der Fantasie ──
// Zwei Listen: „look“ sagt nur, was WIRKLICH zu sehen ist (positiv, kurz – SDXL schneidet nach 77 Token ab),
// „neg“ sagt, was auf keinen Fall aufs Bild darf. Verneinungen im Positiv-Prompt wirken bei SDXL nicht.
const RUESTUNG = [
  [/plattenr|ritterr/i, { look: 'in full steel plate armour', neg: '' }],
  [/schienenpanzer/i, { look: 'in splint mail', neg: '' }],
  [/halbplatte/i, { look: 'in half plate armour', neg: '' }],
  [/brustplatte/i, { look: 'in a steel breastplate over fine clothes', neg: 'full plate armour, helmet' }],
  [/kettenpanzer|kettenr/i, { look: 'wearing a full chainmail hauberk', neg: 'plate armour, pauldrons' }],
  [/kettenhemd/i, { look: 'wearing chainmail armour over a tunic', neg: 'plate armour, pauldrons, shoulder plates, breastplate' }],
  [/schuppenpanzer/i, { look: 'in scale mail', neg: 'plate armour, pauldrons' }],
  [/ringpanzer/i, { look: 'in ring mail', neg: 'plate armour, pauldrons' }],
  [/beschlagenes leder|beschlagene leder/i, { look: 'in studded leather armour', neg: 'plate armour, metal armour, chainmail, pauldrons, helmet' }],
  [/lederr/i, { look: 'in brown leather armour', neg: 'plate armour, metal armour, chainmail, breastplate, pauldrons, helmet' }],
  [/fellr/i, { look: 'in fur and hide armour', neg: 'plate armour, metal armour, chainmail, breastplate, pauldrons, helmet' }],
  [/gepolstert/i, { look: 'in padded cloth armour', neg: 'plate armour, metal armour, chainmail' }],
  [/zusammengew|rüstungsteile|rossharnisch/i, { look: 'in scavenged mismatched armour scraps', neg: '' }],
  [/rindenhaut|magierr/i, { look: 'in long robes', neg: 'armour, plate armour, chainmail' }],
  [/natürliche r/i, { look: 'NATUR', neg: '' }],
];
// Ein Schild ist im Brustbild nicht zu sehen und lenkt den Bildaufbau nur ab – deshalb weggelassen.

// Kreaturenarten, die nie Kleidung, Rüstung oder Schmuck tragen
const NACKT = /^(Tier|Schwarm|Schlick|Pflanze|Drache|Monstrosität|Elementar)/i;
const KEIN_ZEUG = 'clothing, clothes, armour, jewellery, necklace, collar, saddle, harness, straps, helmet, humanoid, anthropomorphic';

function aussehen(m) {
  const typ = String(m.type || '');
  const note = String(m.acNote || '');
  const eintrag = RUESTUNG.find(([re]) => re.test(note));
  const r = eintrag ? eintrag[1] : null;
  const natur = r && r.look === 'NATUR';
  const mitSchild = (s) => s;

  if (/^(Tier|Schwarm)/i.test(typ)) return { look: 'with natural fur, feathers or scales', neg: KEIN_ZEUG };
  if (/^Schlick/i.test(typ)) return { look: 'a shapeless glistening blob of thick slime, no face, no limbs, no hair', neg: `${KEIN_ZEUG}, hair, fur, face, eyes, limbs` };
  if (/^Pflanze/i.test(typ)) return { look: 'a body of bark, roots, vines and fungus', neg: KEIN_ZEUG };
  if (/^Elementar/i.test(typ)) return { look: 'a body made purely of raw element, featureless head with two glowing eyes', neg: `${KEIN_ZEUG}, face, mouth, nose, human face, dragon head` };
  if (NACKT.test(typ)) return { look: 'with thick scaled hide', neg: KEIN_ZEUG };
  if (/^Konstrukt/i.test(typ)) return { look: 'an artificial body of metal, stone or clay', neg: 'clothing, jewellery' };
  if (/^Untoter/i.test(typ)) return r && !natur ? { look: mitSchild(r.look), neg: r.neg } : { look: 'in rotten tattered rags', neg: 'intact armour, plate armour, jewellery' };
  if (/^Unhold/i.test(typ)) return r && !natur ? { look: mitSchild(r.look), neg: r.neg } : { look: 'with bare demonic hide', neg: 'clothing, armour, jewellery' };
  if (r && !natur) return { look: mitSchild(r.look), neg: r.neg };
  if (natur) return { look: mitSchild('with thick natural hide and scales'), neg: 'worn armour, plate armour, chainmail, clothing' };
  if (Number(m.ac) <= 11) return { look: 'in simple peasant clothes', neg: 'armour, plate armour, chainmail, leather armour, jewellery, necklace, amulet' };
  return { look: 'in plain travelling clothes', neg: 'plate armour, metal armour, breastplate, pauldrons' };
}

// Einzelfälle: Was der Statblock nicht hergibt, steht hier – sonst malt SDXL Unsinn
// (ein Flimmerhund ist ein Hund, kein angezogenes Feenwesen; ein Schildwächter ist ein Golem, kein Schild).
const SONDERFALL = {
  flimmerhund: { art: 'a large wild dog', look: 'a big shaggy wolfhound with shimmering blue-grey fur, bare fur only', neg: `${KEIN_ZEUG}, gem, jewel, amulet, collar, ornament, headpiece, crown, fey, human, humanoid, robe, cloak` },
  ritter: { look: 'in full steel plate armour, empty hands', neg: 'sword, weapon, blade, floating object, shield' },
  'schwarzer-blob': { frame: 'full shape', art: 'a puddle of tar-like ooze', look: 'a glossy black mound of thick slime slowly dripping over stone, nothing else', neg: 'face, facial features, head, skull, snout, jaws, mouth, teeth, fangs, tongue, nose, hair, creature, beast, monster, dragon, human, humanoid, animal, eyes, fur, limbs' },
  luftelementar: { frame: 'full shape', art: 'a raging tornado of air', look: 'a spinning tornado of howling wind, dust and lightning, two small glowing white lights inside the swirl', neg: 'face, facial features, head, skull, snout, jaws, mouth, teeth, fangs, tongue, nose, hair, creature, beast, monster, dragon, human, humanoid, animal' },
  wasserelementar: { frame: 'full shape', art: 'a rearing column of seawater', look: 'a tall coiling pillar of clear seawater and foam, two small glowing blue lights inside', neg: 'face, facial features, head, skull, snout, jaws, mouth, teeth, fangs, tongue, nose, hair, creature, beast, monster, dragon, human, humanoid, animal' },
  schildwaechter: { look: 'a hulking armoured golem construct, broad metal shoulders, holding a large shield in one fist', neg: 'only a shield, floating shield, human, face, skin' },
  'ausgewachsener-blauer-drache': { look: 'head and long neck of a living blue dragon, horns and scales, glowing eyes', neg: 'skull, bone, skeleton, dead, full body, wings' },
  solar: { look: 'a radiant winged angel in flowing golden robes, fully covered chest and shoulders', neg: 'nudity, nipples, bare chest, topless, revealing clothing' },
};

const jobs = MONSTERS.map((m) => ({
  id: m.id,
  name: m.name,
  en: englisch(m.name),
  size: m.size || '',
  type: m.type || '',
  // was genau zu sehen sein soll – der größte Hebel für brauchbare Bilder
  look: (SONDERFALL[m.id] || aussehen(m)).look,
  // Bildausschnitt: „Brustbild“ passt nicht für Wesen ohne Kopf
  frame: SONDERFALL[m.id]?.frame || 'head and shoulders',
  ...(SONDERFALL[m.id]?.art ? { art: SONDERFALL[m.id].art } : {}),
  // Negativliste je Auftrag: was auf keinen Fall aufs Bild darf
  neg: (SONDERFALL[m.id] || aussehen(m)).neg,
}));

writeFileSync('tools/sdxl/portraits.json', JSON.stringify(jobs, null, 1), 'utf8');
const unklar = jobs.filter((j) => /[äöüß]/i.test(j.en));
console.log(`${jobs.length} Porträt-Aufträge → tools/sdxl/portraits.json`);
console.log(unklar.length ? `nicht übersetzt (${unklar.length}): ${unklar.map((j) => j.name).join(', ')}` : 'alle Namen übersetzt');
