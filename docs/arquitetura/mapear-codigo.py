"""Mapa tela -> rota -> tabela, por analise estatica do codigo.

Nao adivinha: segue import local a partir de cada page.tsx, junta tudo que
aquele subgrafo toca, e so entao cruza com as tabelas reais do banco.
"""
import re, os, json, collections, sys

RAIZ = "src"
TABELAS = set(json.load(open(sys.argv[1]))["linhas"])

def resolver(imp, de):
    if imp.startswith("@/"): base = os.path.join(RAIZ, imp[2:])
    elif imp.startswith("."): base = os.path.normpath(os.path.join(os.path.dirname(de), imp))
    else: return None
    for suf in (".ts", ".tsx", "/index.ts", "/index.tsx", ""):
        p = base + suf
        if os.path.isfile(p): return p
    return None

CACHE = {}
def ler(p):
    if p not in CACHE:
        try: CACHE[p] = open(p, encoding="utf-8", errors="ignore").read()
        except Exception: CACHE[p] = ""
    return CACHE[p]

RE_IMPORT = re.compile(r'''(?:from|import)\s+["']([^"']+)["']''')
RE_FETCH  = re.compile(r'''["'`](/api/[a-zA-Z0-9/_\-\[\]\.:${}]+)''')
# drizzle: .from(tabela) / .insert(tabela) / .update(tabela) / join(tabela
RE_DRIZZLE = re.compile(r'\.(?:from|insert|update|delete|innerJoin|leftJoin|rightJoin)\(\s*([a-zA-Z_][a-zA-Z0-9_]*)')
# SQL cru
RE_SQL = re.compile(r'\b(?:FROM|JOIN|INTO|UPDATE)\s+(?:ONLY\s+)?"?([a-z_][a-z0-9_]*)"?', re.I)

def camel_para_snake(n):
    return re.sub(r'(?<!^)(?=[A-Z])', '_', n).lower()

def toques(p):
    """Tabelas que ESTE arquivo toca."""
    s = ler(p); achadas = set()
    for m in RE_DRIZZLE.findall(s):
        for cand in (m, camel_para_snake(m)):
            if cand in TABELAS: achadas.add(cand)
    for m in RE_SQL.findall(s):
        if m.lower() in TABELAS: achadas.add(m.lower())
    return achadas

def subgrafo(inicio, limite=400):
    """Arquivos alcancaveis por import local a partir de um ponto."""
    vistos, fila = set(), [inicio]
    while fila and len(vistos) < limite:
        p = fila.pop()
        if p in vistos: continue
        vistos.add(p)
        for imp in RE_IMPORT.findall(ler(p)):
            q = resolver(imp, p)
            if q and q not in vistos: fila.append(q)
    return vistos

# 1) rotas do Hono e do Next: que tabelas cada uma toca
rotas = {}
for d, nome in [("src/api-server/routes", "hono"), ("src/app/api", "next")]:
    for raiz, _, arqs in os.walk(d):
        for a in arqs:
            if not a.endswith((".ts", ".tsx")) or ".test." in a: continue
            p = os.path.join(raiz, a)
            tocadas = set()
            for q in subgrafo(p, 150): tocadas |= toques(q)
            chave = p.replace("src/api-server/routes/", "").replace(".ts", "") if nome == "hono" \
                    else "/" + os.path.relpath(raiz, "src/app").replace("api/", "api/")
            rotas[p] = {"tipo": nome, "nome": chave, "tabelas": sorted(tocadas)}

# 2) telas
telas = {}
for raiz, _, arqs in os.walk("src/app"):
    if "page.tsx" not in arqs: continue
    p = os.path.join(raiz, "page.tsx")
    rota_url = "/" + os.path.relpath(raiz, "src/app")
    rota_url = re.sub(r'/?\([^)]*\)', '', rota_url).replace("//", "/") or "/"
    sg = subgrafo(p)
    tocadas, endpoints = set(), set()
    for q in sg:
        tocadas |= toques(q)
        endpoints |= {e.split("?")[0] for e in RE_FETCH.findall(ler(q))}
    telas[rota_url] = {"arquivo": p, "arquivos_no_subgrafo": len(sg),
                       "tabelas": sorted(tocadas), "endpoints": sorted(endpoints)}

json.dump({"telas": telas, "rotas": rotas}, open("/private/tmp/claude-501/-Users-Scott-Documents-Scott-Studio-onface-ux-rebuild/d96f57c9-5f1c-477c-9d94-fbbc841fe571/scratchpad/mapa-codigo.json", "w"), indent=1)
print(f"telas={len(telas)} rotas={len(rotas)}")
print("telas sem nenhuma tabela:", sum(1 for t in telas.values() if not t["tabelas"]))
print("media de tabelas por tela:", round(sum(len(t['tabelas']) for t in telas.values())/max(1,len(telas)), 1))
