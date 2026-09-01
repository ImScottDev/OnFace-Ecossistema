// Auditoria WCAG 2.1 AA dos pares de cor do Callface UI System.
// Rodar: node scratchpad/contraste.mjs
const hex=(h)=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
const lin=(c)=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
const lum=(r)=>0.2126*lin(r[0])+0.7152*lin(r[1])+0.0722*lin(r[2]);
const ratio=(a,b)=>{const[l1,l2]=[lum(hex(a)),lum(hex(b))].sort((x,y)=>y-x);return (l1+0.05)/(l2+0.05);};
const SW={50:'#edf7f3',100:'#dbf0e7',200:'#b8e0cf',500:'#4db386',600:'#3d8f6b',700:'#2e6b51',800:'#1f4736',950:'#0b1913'};

const pares = [
  ['texto primário / superfície', '#111827', '#ffffff', 4.5],
  ['texto secundário / superfície', '#4b5563', '#ffffff', 4.5],
  ['texto terciário / superfície', '#6b7280', '#ffffff', 4.5],
  ['texto primário / superfície alt', '#111827', '#f3f4f6', 4.5],
  ['AÇÃO: tinta / seaweed-500 (marca viva)', SW[950], SW[500], 4.5],
  ['marca sutil: seaweed-800 / seaweed-50', SW[800], SW[50], 4.5],
  ['positivo-fg / positivo-bg', SW[800], SW[50], 4.5],
  ['branco / positivo sólido (seaweed-700)', '#ffffff', SW[700], 4.5],
  ['ícone timeline: seaweed-700 / seaweed-100', SW[700], SW[100], 3],
  ['ícone timeline neutro: #4b5563 / #f3f4f6', '#4b5563', '#f3f4f6', 3],
  ['negativo-fg / negativo-bg', '#a11d21', '#fceded', 4.5],
  ['atencao-fg / atencao-bg', '#8a5a06', '#fdf1dd', 4.5],
  ['informativo-fg / informativo-bg', '#2542a8', '#eaeffe', 4.5],
  ['branco / negativo sólido', '#ffffff', '#d92d33', 4.5],
  ['tinta / atenção sólido', '#422006', '#f59e0b', 4.5],
  ['branco / informativo sólido', '#ffffff', '#4667e6', 4.5],
  ['chrome: texto / sidebar', '#ffffff', '#1c1f26', 4.5],
  ['chrome: secundário / sidebar', '#9ca3af', '#1c1f26', 4.5],
  ['hero: texto forte / hero-bg', '#f4f5f6', '#121316', 4.5],
  ['hero: texto muted / hero-bg', '#9ca0a9', '#121316', 4.5],
  ['borda de CONTROLE / superfície', '#767e8c', '#ffffff', 3],
];

console.log('\n  AUDITORIA DE CONTRASTE — WCAG 2.1 AA\n');
let falhas = 0;
for (const [nome, fg, bg, min] of pares) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) falhas++;
  console.log(`  ${ok ? 'PASS ' : 'FALHA'}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${nome}`);
}
console.log(`\n  ${falhas} falha(s) de ${pares.length} pares.\n`);
if (process.argv.includes('--strict') && falhas > 0) process.exit(1);
