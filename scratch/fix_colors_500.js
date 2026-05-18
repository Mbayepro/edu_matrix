const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('c:/src/mes projets/edu-matrix/src');

let totalReplaced = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    content = content.replace(/text-blue-500/g, 'text-blue-400');
    content = content.replace(/text-indigo-500/g, 'text-indigo-400');

    // restore the valid /10 and /20 tailwind classes if they were touched (e.g. bg-blue-500/10 became bg-blue-400/10, which we don't want)
    // Actually we only replaced 'text-blue-500', so 'bg-blue-500/10' is safe.
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
        totalReplaced++;
    }
});

console.log('Total files updated (500-level text):', totalReplaced);
