const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) results = results.concat(walk(full));
    else if (full.endsWith('.tsx') || full.endsWith('.ts') || full.endsWith('.css')) results.push(full);
  }
  return results;
}

const files = walk('c:/src/mes projets/edu-matrix/src');
let total = 0;

const replacements = [
  // text-blue-XXX → text-emerald-XXX
  [/text-blue-400/g, 'text-emerald-400'],
  [/text-blue-500/g, 'text-emerald-500'],
  [/text-blue-600/g, 'text-emerald-600'],
  [/text-blue-700/g, 'text-emerald-600'],
  [/text-blue-800/g, 'text-emerald-700'],

  // bg-blue-XXX → bg-emerald-XXX
  [/bg-blue-50(?!\d)/g, 'bg-emerald-50'],
  [/bg-blue-100(?!\d)/g, 'bg-emerald-100'],
  [/bg-blue-500\/10/g, 'bg-emerald-500/10'],
  [/bg-blue-500\/20/g, 'bg-emerald-500/20'],
  [/bg-blue-600(?!\/)/g, 'bg-emerald-600'],
  [/bg-blue-700(?!\/)/g, 'bg-emerald-700'],

  // border-blue-XXX → border-emerald-XXX
  [/border-blue-100(?!\d)/g, 'border-emerald-100'],
  [/border-blue-200(?!\d)/g, 'border-emerald-200'],
  [/border-blue-500\/20/g, 'border-emerald-500/20'],
  [/border-blue-500\/30/g, 'border-emerald-500/30'],

  // ring-blue-XXX
  [/ring-blue-/g, 'ring-emerald-'],
  [/focus:ring-blue-/g, 'focus:ring-emerald-'],

  // hover:text-blue → hover:text-emerald
  [/hover:text-blue-400/g, 'hover:text-emerald-400'],
  [/hover:text-blue-500/g, 'hover:text-emerald-500'],
  [/hover:text-blue-600/g, 'hover:text-emerald-600'],

  // hover:border-blue → hover:border-emerald
  [/hover:border-blue-/g, 'hover:border-emerald-'],

  // group-hover:text-blue
  [/group-hover:text-blue-/g, 'group-hover:text-emerald-'],
  [/group-hover\/log:text-blue-/g, 'group-hover/log:text-emerald-'],

  // shadow-blue-XXX
  [/shadow-blue-500\/\d+/g, (m) => m.replace('blue', 'emerald')],

  // Indigo → emerald
  [/text-indigo-400/g, 'text-emerald-400'],
  [/text-indigo-500/g, 'text-emerald-500'],
  [/text-indigo-600/g, 'text-emerald-600'],
  [/text-indigo-700/g, 'text-emerald-600'],
  [/text-indigo-800/g, 'text-emerald-700'],

  [/bg-indigo-50(?!\d)/g, 'bg-emerald-50'],
  [/bg-indigo-100(?!\d)/g, 'bg-emerald-100'],
  [/bg-indigo-500\/10/g, 'bg-emerald-500/10'],
  [/bg-indigo-500\/20/g, 'bg-emerald-500/20'],
  [/bg-indigo-600(?!\/)/g, 'bg-emerald-600'],

  [/border-indigo-100(?!\d)/g, 'border-emerald-100'],
  [/border-indigo-200(?!\d)/g, 'border-emerald-200'],
  [/border-indigo-500\/20/g, 'border-emerald-500/20'],

  [/hover:text-indigo-/g, 'hover:text-emerald-'],
  [/hover:border-indigo-/g, 'hover:border-emerald-'],
  [/focus-within:text-indigo-/g, 'focus-within:text-emerald-'],
  [/group-focus-within:text-indigo-/g, 'group-focus-within:text-emerald-'],

  [/activeTab === 'teacher' \? 'text-indigo-600 border-b-2 border-indigo-600/g, "activeTab === 'teacher' ? 'text-emerald-600 border-b-2 border-emerald-600"],
  [/activeTab === 'classe' \? 'text-indigo-600 border-b-2 border-indigo-600/g, "activeTab === 'classe' ? 'text-emerald-600 border-b-2 border-emerald-600"],
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('✅ Updated:', file.replace('c:/src/mes projets/edu-matrix/src/', ''));
    total++;
  }
});

console.log(`\n🎨 Total files updated: ${total}`);
