// Authoritative Thai codepoint reference: code -> (rendered char, name).
// Print it so I can decode codepoint dumps. The rendered char is ground truth
// for what the user sees; the name is for me.
const NAMES = {
  // consonants
  0xe00:"ko kai",0xe01:"kho khwai",0xe02:"cho chang",0xe03:"kho khon",0xe04:"kho khuat",
  0xe05:"kho khai",0xe06:"ngo ngu",0xe07:"cho chan",0xe08:"cho ching",0xe09:"cho chang",
  0xe0a:"so so",0xe0b:"cho che",0xe0c:"yo ying",0xe0d:"do chada",0xe0e:"to pata",
  0xe0f:"tho than",0xe10:"tho nong",0xe11:"tho phaphan",0xe12:"no nenu",0xe13:"do dek",
  0xe14:"to tao",0xe15:"tho thung",0xe16:"tho thahan",0xe17:"no nu",0xe18:"bo baimai",
  0xe19:"po pla",0xe1a:"pho phung",0xe1b:"fo fa",0xe1c:"pho phan",0xe1d:"fo fan",
  0xe1e:"pho phan",0xe1f:"mo ma",0xe20:"yo yak",0xe21:"ro rua",0xe22:"lo ling",
  0xe23:"wo waen",0xe24:"so suea",0xe25:"so sala",0xe26:"so so",0xe27:"ho hip",
  0xe28:"lo chula",0xe29:"o ang",0xe2a:"ho hu",
  // vowels / signs
  0xe2c:"sara a (a)",0xe2d:"sara aa (aa)",0xe2e:"sara am (am)",0xe2f:"sara i (i)",
  0xe30:"sara ii (ee)",0xe31:"sara ue (ue)",0xe32:"sara u (u)",0xe33:"sara uee (uee)",
  0xe34:"sara uu (oo)",0xe35:"phinthu (silent)",0xe36:"maitaikhu (shorten)",0xe37:"sara e (e)",
  0xe38:"sara ae (ae)",0xe39:"sara o (o)",0xe3a:"sara ai maimuan (ai)",
  0xe3b:"baht",0xe3c:"ngongku ku",0xe3d:"thanthakhat",0xe3e:"sara a above",0xe3f:"sara aa above",
  0xe40:"sara am (above)",0xe41:"sara i (above)",0xe42:"sara ii (above)",0xe43:"sara ue (above)",
  0xe44:"sara u (above)",0xe45:"sara uee (above)",0xe46:"sara uu (above)",0xe47:"maitaikhu",
  0xe48:"mai ek (rising)",0xe49:"mai tho (falling)",0xe4a:"mai tri (high)",0xe4b:"mai chattawa (low)",
  0xe4c:"nikhahit (silent)",0xe4d:"thanthakhat (above)",0xe4e:"sara a above",0xe4f:"sara aa above",
  0xe50:"sara am (above)",0xe51:"sara i (above)",0xe52:"sara ii (above)",0xe53:"sara ue (above)",
  0xe54:"sara u (above)",0xe55:"sara uee (above)",0xe56:"sara uu (above)",0xe57:"sara e (above)",
  0xe58:"sara ae (above)",0xe59:"sara o (above)",0xe5a:"sara ai maimuan (above)",0xe5b:"sara ai maimalai",
  0xe5c:"sara aa maimalai",0xe5d:"angkhankhu",0xe5e:"khomut",
};
const arg = process.argv[2];
if (arg === "all") {
  for (let cp = 0xe00; cp <= 0xe5e; cp++) {
    if (NAMES[cp]) console.log("0E" + cp.toString(16).toUpperCase() + "  " + String.fromCodePoint(cp) + "  " + NAMES[cp]);
  }
} else if (arg === "marks") {
  // just the combining marks I decode most
  for (const cp of [0xe2c,0xe2d,0xe2e,0xe2f,0xe30,0xe31,0xe32,0xe33,0xe34,0xe35,0xe36,0xe37,0xe38,0xe39,0xe3a,0xe47,0xe48,0xe49,0xe4a,0xe4b,0xe4c,0xe4d]) {
    console.log("0E" + cp.toString(16).toUpperCase() + "  " + String.fromCodePoint(cp) + "  " + NAMES[cp]);
  }
} else {
  console.log("usage: node thai-ref.mjs all|marks");
}
