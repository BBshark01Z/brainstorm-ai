// Print the full Thai Unicode block (0E00-0E7F) as: code  char  name
// so we have a trustworthy reference for decoding codepoint dumps.
const names = {
  0xe01:"ko kai",0xe02:"kho khwai",0xe03:"cho chang",0xe04:"kho khon",0xe05:"kho khuat",
  0xe06:"kho khai",0xe07:"ngo ngu",0xe08:"cho chan",0xe09:"cho ching",0xe0a:"cho chang",
  0xe0b:"so so",0xe0c:"cho che",0xe0d:"yo ying",0xe0e:"do chada",0xe0f:"to pata",
  0xe10:"tho than",0xe11:"tho nong",0xe12:"tho phaphan",0xe13:"no nenu",0xe14:"do dek",
  0xe15:"to tao",0xe16:"tho thung",0xe17:"tho thahan",0xe18:"no nu",0xe19:"bo baimai",
  0xe1a:"po pla",0xe1b:"pho phung",0xe1c:"fo fa",0xe1d:"pho phan",0xe1e:"fo fan",
  0xe1f:"pho phan",0xe20:"mo ma",0xe21:"yo yak",0xe22:"ro rua",0xe23:"lo ling",
  0xe24:"wo waen",0xe25:"so suea",0xe26:"so sala",0xe27:"so so",0xe28:"ho hip",
  0xe29:"lo chula",0xe2a:"o ang",0xe2b:"ho hu",
  0xe2c:"sara a",0xe2d:"sara aa",0xe2e:"sara am",0xe2f:"sara i",0xe30:"sara ii",
  0xe31:"sara ue",0xe32:"sara u",0xe33:"sara uee",0xe34:"sara uu",0xe35:"phinthu",
  0xe36:"maitaikhu",0xe37:"sara e",0xe38:"sara ae",0xe39:"sara o",0xe3a:"sara ai maimuan",
  0xe47:"maitaikhu",0xe48:"mai ek",0xe49:"mai tho",0xe4a:"mai tri",0xe4b:"mai chattawa",
  0xe4c:"nikhahit",0xe4d:"thanthakhat",0xe4e:"sara a above",0xe4f:"sara aa above",
  0xe50:"sara am",0xe51:"sara i",0xe52:"sara ii",0xe53:"sara ue",0xe54:"sara u",
  0xe55:"sara uee",0xe56:"sara uu",0xe57:"sara e",0xe58:"sara ae",0xe59:"sara o",
  0xe5a:"sara ai maimuan",0xe5b:"sara ai maimalai",0xe5c:"sara aa maimalai",
  0xe5d:"angkhankhu",0xe5e:"khomut",
};
for (let cp = 0xe00; cp <= 0xe7f; cp++) {
  const ch = String.fromCodePoint(cp);
  const name = names[cp] || (cp >= 0xe3b && cp <= 0xe3f ? "sign" : cp >= 0xe60 && cp <= 0xe69 ? "digit " + (cp - 0xe60) : "spacing");
  console.log("0E" + cp.toString(16).toUpperCase() + "  " + ch + "  " + name);
}
