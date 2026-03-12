const fs = require('fs');
const path = require('path');

const filesToUpdate = ['src/pages/Dashboard.tsx', 'src/pages/RoomView.tsx'];

const replacements = {
  // Backgrounds
  'bg-slate-50': 'bg-transparent', 
  'bg-slate-100': 'bg-white/5',
  'bg-white/20': 'bg-white/10',
  'bg-white/30': 'bg-white/10',
  'bg-white': 'glass-dark',
  
  // Specific card backgrounds
  'bg-emerald-50': 'bg-emerald-950/30',
  'bg-amber-50': 'bg-amber-950/30',
  'bg-rose-50': 'bg-rose-950/30',
  
  // Borders
  'border-slate-200': 'border-white/10',
  'border-slate-100': 'border-white/5',
  'border-emerald-100': 'border-emerald-500/20',
  'border-emerald-200': 'border-emerald-500/30',
  
  // Text
  'text-slate-900': 'text-slate-100',
  'text-slate-800': 'text-slate-200',
  'text-slate-700': 'text-slate-300',
  'text-slate-600': 'text-slate-400',
  'text-slate-500': 'text-slate-400',
  
  // Hovers
  'hover:bg-slate-50': 'hover:bg-white/5',
  'hover:bg-slate-100': 'hover:bg-white/10',
  'hover:border-emerald-200': 'hover:border-emerald-500/50',
  'hover:shadow-xl': 'hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]',
  'shadow-sm': 'shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
  'shadow-md': 'shadow-[0_8px_30px_rgba(0,0,0,0.4)]',
  'shadow-lg': 'shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
  'shadow-xl': 'shadow-[0_20px_50px_rgba(0,0,0,0.6)]',
  
  // Custom classes
  'glass border-b border-slate-200': 'glass-dark border-b border-white/5',
};

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Hard replace exact matches in class strings
  for (const [oldClass, newClass] of Object.entries(replacements)) {
    // Regex to match the exact class word boundaries
    const regex = new RegExp(`\\b${oldClass}\\b`, 'g');
    content = content.replace(regex, newClass);
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${file}`);
});
