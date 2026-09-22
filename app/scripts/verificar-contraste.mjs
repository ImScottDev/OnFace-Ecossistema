// Auditoria WCAG 2.1 AA dos pares de cor do Callface UI System.
// Rodar: node scratchpad/contraste.mjs
const hex=(h)=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
const lin=(c)=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
const lum=(r)=>0.2126*lin(r[0])+0.7152*lin(r[1])+0.0722*lin(r[2]);
const ratio=(a,b)=>{const[l1,l2]=[lum(hex(a)),lum(hex(b))].sort((x,y)=>y-x);return (l1+0.05)/(l2+0.05);};
const SW={50:'#edf7f3',100:'#dbf0e7',200:'#b8e0cf',500:'#4db386',600:'#3d8f6b',700:'#2e6b51',800:'#1f4736',950:'#0b1913'};

// Paleta ONFACE. Os pares abaixo do divisor guardam a casca NOVA; os de cima
// continuam guardando o CRM legado enquanto ele existir.
//
// `coral` é a marca e não carrega texto: em cima dele branco dá 3,30:1. Por
// isso existem `coralAcao` (fundo de controle com texto branco) e `coralTexto`
// (coral como texto sobre papel ou sobre o coral a 10%). Os três estão em
// `onface.css` com a mesma conta anotada.
const OF = {
  coral: '#fe4f2b', coralDeep: '#d93c1a', coralTexto: '#b7391f',
  // coral-subtle é rgba(254,79,43,.1); composto sobre o papel dá isto:
  coralSubtleSobrePapel: '#f7e5df',
  papel: '#f6f6f3', branco: '#ffffff', grafite: '#090e14', pretoLogo: '#12171d',
  textoForte: '#12171d', textoCorpo: '#1f252c',
  textoMuted: '#616b78',   // cinza-2; o cinza (#6d747e) dava 4,36:1 no papel
  textoNaCasca: '#eeeff3', textoNaCascaMuted: '#8b949e',
  linha: '#dbdede',
};

// Fundos escuros do produto e os tons que o escopo `[data-cf2-superficie]`
// entrega em cima deles.
const ESC = {
  inverse: '#111827', chromeAlt: '#16171c',
  danger: '#f06a6f', warning: '#f5b638',
};

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

  // ── ONFACE (casca nova) ───────────────────────────────────────────────
  ['ONFACE texto forte / papel', OF.textoForte, OF.papel, 4.5],
  ['ONFACE texto corpo / papel', OF.textoCorpo, OF.papel, 4.5],
  ['ONFACE texto muted / papel', OF.textoMuted, OF.papel, 4.5],
  ['ONFACE texto muted / card branco', OF.textoMuted, OF.branco, 4.5],
  // O CTA primário do produto. Com o coral da marca dava 3,30:1. O coral
  // profundo já existia no projeto desde 18/09, pelo mesmo motivo.
  ['ONFACE branco / coral PROFUNDO (preenchimento)', OF.branco, OF.coralDeep, 4.5],
  // O número de sinal do resumo, sobre o coral a 10%.
  ['ONFACE coral de TEXTO / coral sutil', OF.coralTexto, OF.coralSubtleSobrePapel, 4.5],
  ['ONFACE coral de TEXTO / papel', OF.coralTexto, OF.papel, 4.5],
  // O terceiro grau existe porque o profundo resolve preenchimento e reprova
  // como letra: #D93C1A sobre papel dá 4,21:1 e sobre o coral a 10% dá 3,74:1.
  // Os dois pares acima guardam o grau certo em cada fundo.
  ['ONFACE sidebar: texto / grafite', OF.textoNaCasca, OF.grafite, 4.5],
  ['ONFACE sidebar: rótulo de grupo / grafite', OF.textoNaCascaMuted, OF.grafite, 4.5],
  // Elemento de interface, piso 3: a marca continua sendo a marca aqui.
  ['ONFACE indicador coral / grafite', OF.coral, OF.grafite, 3],
  ['ONFACE hairline / papel', OF.linha, OF.papel, 1.2],

  // ── Superfícies ESCURAS do produto ──────────────────────────────────────
  //
  // O produto tem dois fundos escuros: `--cf2-bg-inverse` (#111827) na faixa e
  // na triagem da Carteira, e `--cf2-chrome-bg-alt` (#16171c) nos cabeçalhos
  // de /negocios e /empresas e no Pulso do Financeiro.
  //
  // Quem escreve em cima deles é o escopo `[data-cf2-superficie="escura"]` do
  // `globals.css`. Uma superfície escura que ESQUECE de declarar o atributo
  // recebe os tokens calibrados para fundo branco — foi o que aconteceu na
  // faixa da Carteira, onde "Inadimplentes" dava 2,74:1. Os dois primeiros
  // pares guardam justamente o que o escopo entrega.
  ['ONFACE escuro: danger / inverse', ESC.danger, ESC.inverse, 3],
  ['ONFACE escuro: warning / inverse', ESC.warning, ESC.inverse, 3],
  ['ONFACE escuro: danger / chrome-alt', ESC.danger, ESC.chromeAlt, 3],
  // O accent em superfície escura era `#6ee7a8`, verde do sistema legado que
  // sobreviveu à virada da marca para coral. Coral de marca passa AA de texto
  // NORMAL nos dois fundos, então o piso aqui é 4,5 e não 3.
  ['ONFACE escuro: accent coral / inverse', OF.coral, ESC.inverse, 4.5],
  ['ONFACE escuro: accent coral / chrome-alt', OF.coral, ESC.chromeAlt, 4.5],
  // Tinta POR CIMA do accent coral, para quando ele é preenchimento e não texto.
  ['ONFACE escuro: tinta / accent coral', OF.pretoLogo, OF.coral, 4.5],
  ['ONFACE escuro: texto / inverse', '#ffffff', ESC.inverse, 4.5],
  // Rótulo a 58% de branco composto sobre o fundo escuro — é o que a faixa da
  // Carteira usa em `color-mix`, e alfa tem que ser composto antes de medir.
  ['ONFACE escuro: rótulo 58% / inverse', '#8b8f97', ESC.inverse, 4.5],
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
