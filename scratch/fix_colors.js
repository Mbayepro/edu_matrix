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

    // Badges blue
    content = content.replace(/bg-blue-50(\/10)? text-blue-[678]00/g, 'bg-blue-500/10 text-blue-400 border border-blue-500/20');
    content = content.replace(/bg-blue-100 text-blue-[78]00/g, 'bg-blue-500/10 text-blue-400 border border-blue-500/20');
    // Badges indigo
    content = content.replace(/bg-indigo-50(\/10)? text-indigo-[5678]00/g, 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20');
    content = content.replace(/bg-indigo-100 text-indigo-[78]00/g, 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20');

    // Standalone dark blues
    content = content.replace(/text-blue-800/g, 'text-blue-400');
    content = content.replace(/text-blue-700/g, 'text-blue-400');
    content = content.replace(/text-blue-600/g, 'text-blue-400');
    
    // Standalone dark indigos
    content = content.replace(/text-indigo-800/g, 'text-indigo-400');
    content = content.replace(/text-indigo-700/g, 'text-indigo-400');
    content = content.replace(/text-indigo-600/g, 'text-indigo-400');

    // Remove any double border border if it happened
    content = content.replace(/border border border/g, 'border border');
    content = content.replace(/border border-blue-500\/20 border-blue-200/g, 'border border-blue-500/20');
    content = content.replace(/border-blue-200/g, 'border-blue-500/20');
    content = content.replace(/border-indigo-200/g, 'border-indigo-500/20');
    content = content.replace(/border-indigo-100/g, 'border-indigo-500/20');

    // Some specific cases: bg-blue-50 alone
    content = content.replace(/bg-blue-50(?!\d)/g, 'bg-blue-500/10');
    content = content.replace(/bg-indigo-50(?!\d)/g, 'bg-indigo-500/10');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated', file);
        totalReplaced++;
    }
});

console.log('Total files updated:', totalReplaced);
