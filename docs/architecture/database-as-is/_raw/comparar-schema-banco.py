#!/usr/bin/env python3
"""
Compara o schema Drizzle (app/src/lib/db/schema.ts) com o estado real do
PostgreSQL local, lido dos dumps em _raw/.

Somente leitura. Nao toca no banco, nao edita o schema.ts.

Uso:
    python3 comparar-schema-banco.py            # imprime o markdown em stdout
    python3 comparar-schema-banco.py --json     # despeja o diff cru em JSON

Entradas (relativas a este arquivo):
    ../../../../app/src/lib/db/schema.ts
    ./colunas.txt        tabela|coluna|tipo|nullable(YES/NO)|default
    ./foreign-keys.txt   tabela|coluna|tab_destino|col_destino|constraint|delete_rule|nullability
    ./indices.txt        tabela|nome_indice|definicao
    ./views.txt          nome_view|is_view
"""

import json
import os
import re
import sys
from collections import defaultdict

AQUI = os.path.dirname(os.path.abspath(__file__))
SCHEMA_TS = os.path.normpath(os.path.join(AQUI, "..", "..", "..", "..", "app", "src", "lib", "db", "schema.ts"))
COLUNAS = os.path.join(AQUI, "colunas.txt")
FKS = os.path.join(AQUI, "foreign-keys.txt")
INDICES = os.path.join(AQUI, "indices.txt")
VIEWS = os.path.join(AQUI, "views.txt")

# helpers de coluna do drizzle-orm/pg-core usados neste schema.
# o primeiro argumento string de cada um e o nome FISICO da coluna.
TIPOS = (
    "uuid|text|timestamp|jsonb|json|integer|bigint|smallint|serial|bigserial|"
    "boolean|numeric|decimal|real|doublePrecision|date|time|inet|cidr|macaddr|"
    "varchar|char|uniqueIndex_NAO_E_TIPO"
).replace("|uniqueIndex_NAO_E_TIPO", "")
RE_COLUNA = re.compile(r'^\s*([A-Za-z_$][\w$]*)\s*:\s*(' + TIPOS + r')\s*\(\s*"([^"]+)"')
RE_TABELA = re.compile(r'export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*pgTable\s*\(')
RE_REF = re.compile(r'\.references\(\s*\(\s*\)\s*(?::\s*[\w<>\[\]]+\s*)?=>\s*([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)')
RE_INDICE = re.compile(
    r'\b(uniqueIndex|index)\s*\(\s*"([^"]+)"\s*\)\s*(?:\.on\(([^()]*)\))?'
)
RE_IDX_COLS = re.compile(r'USING\s+\w+\s*\((.*?)\)(?:\s+WHERE|\s*$)', re.S)


# ---------------------------------------------------------------- parsing TS

def tira_comentarios(src):
    """Remove // e /* */ respeitando strings e template literals."""
    out = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if c in '"\'`':
            aspas = c
            out.append(c)
            i += 1
            while i < n:
                if src[i] == "\\":
                    out.append(src[i:i + 2])
                    i += 2
                    continue
                out.append(src[i])
                if src[i] == aspas:
                    i += 1
                    break
                i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            i += 2
            while i + 1 < n and not (src[i] == "*" and src[i + 1] == "/"):
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def bloco_balanceado(src, i, abre="(", fecha=")"):
    """src[i] deve ser `abre`. Devolve (texto_interno, indice_apos_fecha)."""
    assert src[i] == abre
    prof, j = 0, i
    n = len(src)
    while j < n:
        c = src[j]
        if c in '"\'`':
            aspas = c
            j += 1
            while j < n:
                if src[j] == "\\":
                    j += 2
                    continue
                if src[j] == aspas:
                    break
                j += 1
            j += 1
            continue
        if c == abre:
            prof += 1
        elif c == fecha:
            prof -= 1
            if prof == 0:
                return src[i + 1:j], j + 1
        j += 1
    raise ValueError("bloco nao fechado em %d" % i)


def split_topo(txt, sep=","):
    """Split no nivel 0 de (), [], {} e fora de strings."""
    partes, prof, atual, i, n = [], 0, [], 0, len(txt)
    while i < n:
        c = txt[i]
        if c in '"\'`':
            aspas = c
            atual.append(c)
            i += 1
            while i < n:
                if txt[i] == "\\":
                    atual.append(txt[i:i + 2])
                    i += 2
                    continue
                atual.append(txt[i])
                if txt[i] == aspas:
                    i += 1
                    break
                i += 1
            continue
        if c in "([{":
            prof += 1
        elif c in ")]}":
            prof -= 1
        if c == sep and prof == 0:
            partes.append("".join(atual))
            atual = []
            i += 1
            continue
        atual.append(c)
        i += 1
    if "".join(atual).strip():
        partes.append("".join(atual))
    return partes


def parse_schema_ts(caminho):
    """-> {tabela_fisica: {var, colunas:{fisico:{prop,notnull,ref}}, indices:{nome:unique}}}"""
    src = tira_comentarios(open(caminho, encoding="utf-8").read())
    var2tabela = {}
    tabelas = {}

    for m in RE_TABELA.finditer(src):
        var = m.group(1)
        i_paren = src.index("(", m.end() - 1)
        args_txt, _ = bloco_balanceado(src, i_paren)
        args = split_topo(args_txt)
        if not args:
            continue

        mnome = re.search(r'"([^"]+)"', args[0])
        if not mnome:
            continue
        fisico = mnome.group(1)
        var2tabela[var] = fisico

        colunas = {}
        if len(args) > 1:
            corpo = args[1].strip()
            if corpo.startswith("{"):
                corpo = corpo[1:corpo.rindex("}")]
            for prop_txt in split_topo(corpo):
                mc = RE_COLUNA.match(prop_txt)
                if not mc:
                    continue
                colunas[mc.group(3)] = {
                    "prop": mc.group(1),
                    "tipo_ts": mc.group(2),
                    "notnull": ".notNull()" in prop_txt,
                    "pk": ".primaryKey()" in prop_txt,
                    "unique": ".unique()" in prop_txt,
                    "ref": RE_REF.search(prop_txt),
                }

        indices = {}
        if len(args) > 2:
            # arg3 e `(table) => [ index(...), uniqueIndex(...), ... ]`; o array
            # inteiro fica em profundidade > 0, entao varre o texto direto.
            for mi in RE_INDICE.finditer(args[2]):
                indices[mi.group(2)] = {
                    "unique": mi.group(1) == "uniqueIndex",
                    "props": re.findall(r'table\.([A-Za-z_$][\w$]*)', mi.group(3) or ""),
                }

        tabelas[fisico] = {"var": var, "colunas": colunas, "indices": indices}

    # resolve .references() agora que todas as vars sao conhecidas
    for fisico, t in tabelas.items():
        for col, meta in t["colunas"].items():
            m = meta.pop("ref")
            if not m:
                meta["ref"] = None
                continue
            alvo_var, alvo_prop = m.group(1), m.group(2)
            alvo_tab = var2tabela.get(alvo_var)
            alvo_col = None
            if alvo_tab:
                for c, cm in tabelas[alvo_tab]["colunas"].items():
                    if cm["prop"] == alvo_prop:
                        alvo_col = c
                        break
            meta["ref"] = (alvo_tab or alvo_var, alvo_col or alvo_prop)
    return tabelas


# ---------------------------------------------------------------- parsing DB

def carrega_pipe(caminho, n_campos):
    linhas = []
    with open(caminho, encoding="utf-8") as fh:
        for bruta in fh:
            bruta = bruta.rstrip("\n")
            if not bruta.strip():
                continue
            campos = bruta.split("|")
            if len(campos) < n_campos:
                campos += [""] * (n_campos - len(campos))
            linhas.append(campos[:n_campos])
    return linhas


def parse_banco():
    colunas = defaultdict(dict)
    for tab, col, tipo, nullable, default in carrega_pipe(COLUNAS, 5):
        colunas[tab][col] = {"tipo": tipo, "nullable": nullable == "YES", "default": default}

    fks = set()
    fk_detalhe = {}
    for tab, col, dtab, dcol, cons, rule, nul in carrega_pipe(FKS, 7):
        fks.add((tab, col))
        fk_detalhe[(tab, col)] = {"destino": (dtab, dcol), "constraint": cons, "delete_rule": rule}

    indices = defaultdict(dict)
    for tab, nome, definicao in carrega_pipe(INDICES, 3):
        mc = RE_IDX_COLS.search(definicao)
        cols = []
        if mc:
            cols = [c.strip() for c in mc.group(1).split(",") if c.strip()]
        indices[tab][nome] = {
            "unique": "CREATE UNIQUE INDEX" in definicao,
            "cols": cols,
            "parcial": " WHERE " in definicao,
            "def": definicao,
        }

    views = set()
    for campos in carrega_pipe(VIEWS, 2):
        views.add(campos[0])

    return colunas, fks, fk_detalhe, indices, views


# ---------------------------------------------------------------- comparacao

def comparar():
    drz = parse_schema_ts(SCHEMA_TS)
    db_cols, db_fks, db_fk_det, db_idx, views = parse_banco()

    tabs_drz = set(drz)
    tabs_db = set(db_cols)
    comuns = sorted(tabs_drz & tabs_db)

    d = {
        "tabela_so_banco": sorted(tabs_db - tabs_drz),
        "tabela_so_drizzle": sorted(tabs_drz - tabs_db),
        "coluna_so_banco": [],
        "coluna_so_drizzle": [],
        "nullability": [],
        "fk_so_banco": [],
        "fk_so_drizzle": [],
        "fk_destino_divergente": [],
        "indice_so_banco": [],
        "indice_so_drizzle": [],
        "indice_unique_divergente": [],
        "views": sorted(views),
        "total_tabelas_drizzle": len(tabs_drz),
        "total_tabelas_banco": len(tabs_db),
        "total_comuns": len(comuns),
    }

    for tab in comuns:
        cd = drz[tab]["colunas"]
        cb = db_cols[tab]

        for col in sorted(set(cb) - set(cd)):
            d["coluna_so_banco"].append({
                "tabela": tab, "coluna": col,
                "tipo": cb[col]["tipo"],
                "nullable": cb[col]["nullable"],
                "default": cb[col]["default"],
            })
        for col in sorted(set(cd) - set(cb)):
            d["coluna_so_drizzle"].append({
                "tabela": tab, "coluna": col,
                "prop": cd[col]["prop"], "tipo_ts": cd[col]["tipo_ts"],
                "notnull": cd[col]["notnull"],
            })
        for col in sorted(set(cd) & set(cb)):
            drz_nn = cd[col]["notnull"] or cd[col]["pk"]
            db_nn = not cb[col]["nullable"]
            if drz_nn != db_nn:
                d["nullability"].append({
                    "tabela": tab, "coluna": col,
                    "drizzle": "notNull" if drz_nn else "nullable",
                    "banco": "NOT NULL" if db_nn else "nullable",
                    "default_banco": cb[col]["default"],
                })

        # FKs
        fks_drz = {c: m["ref"] for c, m in cd.items() if m.get("ref")}
        fks_db_tab = {c for (t, c) in db_fks if t == tab}
        for col in sorted(set(fks_drz) - fks_db_tab):
            if col not in cb:
                continue  # ja contado como coluna_so_drizzle
            d["fk_so_drizzle"].append({
                "tabela": tab, "coluna": col,
                "destino": "%s.%s" % fks_drz[col],
            })
        for col in sorted(fks_db_tab - set(fks_drz)):
            if col not in cd:
                continue  # ja contado como coluna_so_banco
            det = db_fk_det[(tab, col)]
            d["fk_so_banco"].append({
                "tabela": tab, "coluna": col,
                "destino": "%s.%s" % det["destino"],
                "constraint": det["constraint"],
                "delete_rule": det["delete_rule"],
            })
        for col in sorted(set(fks_drz) & fks_db_tab):
            alvo_drz = fks_drz[col]
            alvo_db = db_fk_det[(tab, col)]["destino"]
            if alvo_drz != alvo_db:
                d["fk_destino_divergente"].append({
                    "tabela": tab, "coluna": col,
                    "drizzle": "%s.%s" % alvo_drz,
                    "banco": "%s.%s" % alvo_db,
                })

        # indices
        idx_drz = drz[tab]["indices"]
        idx_db = db_idx.get(tab, {})
        prop2fisico = {m["prop"]: c for c, m in cd.items()}
        usados_por_rename = set()

        for nome in sorted(set(idx_drz) - set(idx_db)):
            meta = idx_drz[nome]
            cols_drz = [prop2fisico.get(p, p) for p in meta["props"]]
            # o mesmo indice logico pode existir no banco com OUTRO nome:
            # procura indice do banco com a mesma lista de colunas e mesma unicidade.
            gemeo = None
            for nome_db, mdb in idx_db.items():
                if nome_db in idx_drz:
                    continue
                if mdb["cols"] == cols_drz and mdb["unique"] == meta["unique"]:
                    gemeo = nome_db
                    break
            if gemeo:
                usados_por_rename.add(gemeo)
            d["indice_so_drizzle"].append({
                "tabela": tab, "indice": nome,
                "unique": meta["unique"],
                "colunas": cols_drz,
                "gemeo_no_banco": gemeo,
            })
        tem_pk_col = any(m["pk"] for m in cd.values())
        tem_unique_col = any(m["unique"] for m in cd.values())
        for nome in sorted(set(idx_db) - set(idx_drz)):
            # o Drizzle cria indice sem nome declarado em dois casos: .primaryKey()
            # (vira <tab>_pkey) e .unique() (vira <tab>_<col>_key/_unique).
            if nome.endswith("_pkey") and tem_pk_col:
                classe = "pk_implicita"
            elif nome in usados_por_rename:
                classe = "mesmo_indice_outro_nome"
            elif (nome.endswith("_key") or nome.endswith("_unique")) and tem_unique_col:
                classe = "unique_implicita"
            else:
                classe = "nao_declarado"
            d["indice_so_banco"].append({
                "tabela": tab, "indice": nome,
                "unique": idx_db[nome]["unique"],
                "colunas": idx_db[nome]["cols"],
                "classe": classe,
            })
        for nome in sorted(set(idx_drz) & set(idx_db)):
            if idx_drz[nome]["unique"] != idx_db[nome]["unique"]:
                d["indice_unique_divergente"].append({
                    "tabela": tab, "indice": nome,
                    "drizzle": "uniqueIndex" if idx_drz[nome]["unique"] else "index",
                    "banco": "UNIQUE" if idx_db[nome]["unique"] else "nao-unique",
                })

    return d, drz, db_cols


def autocheck():
    """Falha se os helpers de parsing quebrarem. `python3 comparar-schema-banco.py --check`"""
    src = 'a = "x // nao e comentario"; // some\nb = 1; /* some\ntambem */ c = 2;'
    limpo = tira_comentarios(src)
    assert '"x // nao e comentario"' in limpo, limpo
    assert "some" not in limpo, limpo

    assert bloco_balanceado('f(a, g(b), ")")', 1)[0] == 'a, g(b), ")"'
    assert split_topo('a, g(b, c), [d, e], "f, g"') == ['a', ' g(b, c)', ' [d, e]', ' "f, g"']

    mini = 'export const t = pgTable("t_fis", { aB: uuid("a_b").notNull().references(() => o.id), c: text("c") }, (table) => [ index("i1").on(table.aB), uniqueIndex("i2").on(table.aB, table.c) ]);'
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".ts", delete=False) as fh:
        fh.write(mini)
        p = fh.name
    t = parse_schema_ts(p)["t_fis"]
    os.unlink(p)
    assert set(t["colunas"]) == {"a_b", "c"}, t["colunas"]
    assert t["colunas"]["a_b"]["notnull"] and not t["colunas"]["c"]["notnull"]
    assert t["colunas"]["a_b"]["ref"] == ("o", "id")
    assert t["indices"]["i1"] == {"unique": False, "props": ["aB"]}
    assert t["indices"]["i2"] == {"unique": True, "props": ["aB", "c"]}

    mc = RE_IDX_COLS.search("CREATE UNIQUE INDEX x ON public.t USING btree (a, b) WHERE (a IS NOT NULL)")
    assert mc and mc.group(1) == "a, b", mc
    print("autocheck ok")


if __name__ == "__main__":
    if "--check" in sys.argv:
        autocheck()
        sys.exit(0)
    diff, _drz, _db = comparar()
    if "--json" in sys.argv:
        print(json.dumps(diff, indent=2, ensure_ascii=False))
    else:
        for k, v in diff.items():
            if isinstance(v, list):
                print("%-28s %d" % (k, len(v)))
            else:
                print("%-28s %s" % (k, v))
