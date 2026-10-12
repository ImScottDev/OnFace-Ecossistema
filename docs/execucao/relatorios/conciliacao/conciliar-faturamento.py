#!/usr/bin/env python3
"""Concilia as planilhas de faturamento (fontes originais) com cliente_receita_mensal, por competência.

Somente leitura. Oráculo independente: soma as células/linhas da planilha direto, sem usar o
script de importação. Uso (da raiz do repo):
    python3 docs/execucao/relatorios/conciliacao/conciliar-faturamento.py
Saída: tabela em stdout e CSV em db-export/2026-10-12/relatorios/conciliacao.csv
"""
import csv, os, re, subprocess, sys
from collections import defaultdict
from decimal import Decimal
import openpyxl

FONTES = "db-export/2026-10-12/relatorios/fontes/"
def cents(x): return int((Decimal(str(x)) * 100).to_integral_value())
def br(s): return Decimal(s.strip().replace(".", "").replace(",", ".") or "0")

fonte, linhas, docs = defaultdict(int), defaultdict(int), defaultdict(set)
rodape = {}
# 1) base histórica (Excel): uma coluna por competência, uma linha por documento + Business Line
ws = openpyxl.load_workbook(FONTES + "base_faturamento_callface.xlsx", read_only=True, data_only=True)["Base"]
rows = list(ws.iter_rows(values_only=True))
cab = rows[0]
comp_col = {i: re.sub(r"(\d{4})-M(\d{2})", r"\1-\2", str(h)) for i, h in enumerate(cab) if re.match(r"\d{4}-M\d{2}", str(h))}
for r in rows[1:]:
    if r[0] == "Total Geral":
        for i, c in comp_col.items():
            if r[i] is not None: rodape[c] = cents(r[i])
        continue
    for i, c in comp_col.items():
        v = r[i]
        if v not in (None, 0):
            fonte[c] += cents(v); linhas[c] += 1; docs[c].add(re.sub(r"\D", "", str(r[1] or "")))
# 2) fechamentos mensais (CSV): uma linha por fatura/documento, rodapé com o total
for arq, comp in [("06_fechamento_JULHO.csv", "2026-07"), ("Callface 08-2026 --(Planilha1).csv", "2026-08"), ("Faturamento callface 09-2026-(Planilha1).csv", "2026-09")]:
    with open(FONTES + arq, encoding="utf-8-sig", errors="replace") as f:
        leitor = list(csv.reader(f, delimiter=";"))
    for r in leitor[1:]:
        if not any(x.strip() for x in r): continue
        doc = re.sub(r"\D", "", r[-2]) if len(r) >= 2 else ""
        if not doc:  # linha de rodapé: só o total
            rodape[comp] = cents(br(r[-1])); continue
        fonte[comp] += cents(br(r[-1])); linhas[comp] += 1; docs[comp].add(doc)

# 3) banco
url = [l.split("=", 1)[1].strip() for l in open("app/.env") if l.startswith("DATABASE_URL=")][0]
out = subprocess.run(["psql", url, "-At", "-F", "|", "-c",
    "select to_char(competencia,'YYYY-MM'), (sum(valor)*100)::bigint, count(*), count(distinct regexp_replace(documento,'\\D','','g')) from cliente_receita_mensal group by 1 order by 1"],
    capture_output=True, text=True, check=True).stdout.strip().splitlines()
banco = {l.split("|")[0]: tuple(int(x) for x in l.split("|")[1:]) for l in out}

comps = sorted(set(fonte) | set(banco))
os.makedirs("db-export/2026-10-12/relatorios", exist_ok=True)
ruim = 0
with open("db-export/2026-10-12/relatorios/conciliacao.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["competencia", "fonte_centavos", "rodape_centavos", "banco_centavos", "dif_banco_fonte", "dif_fonte_rodape", "linhas_fonte", "linhas_banco", "docs_fonte", "docs_banco"])
    for c in comps:
        b = banco.get(c, (0, 0, 0))
        dif = b[0] - fonte.get(c, 0); difr = fonte.get(c, 0) - rodape.get(c, fonte.get(c, 0))
        if abs(dif) > 1 or abs(difr) > 1: ruim += 1
        w.writerow([c, fonte.get(c, 0), rodape.get(c, ""), b[0], dif, difr, linhas.get(c, 0), b[1], len(docs.get(c, ())), b[2]])
tot_f, tot_b = sum(fonte.values()), sum(v[0] for v in banco.values())
print(f"competências: fonte {len(fonte)} · banco {len(banco)} · fora de tolerância (>1 centavo): {ruim}")
print(f"total fonte R$ {tot_f/100:,.2f} · total banco R$ {tot_b/100:,.2f} · diferença R$ {(tot_b-tot_f)/100:,.2f}")
sys.exit(1 if ruim else 0)
