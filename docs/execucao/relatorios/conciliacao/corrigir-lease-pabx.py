#!/usr/bin/env python3
"""Aplica a decisão de 12/10/2026 (Scott): 'CALL FACE - LEASE' pertence à família PABX.

Evidência: cada célula LEASE da planilha base (doc + competência + valor) casa com uma linha de
cliente_receita_mensal hoje em UNKNOWN. A Business Line original é preservada em evidence; a natureza
da receita NÃO é alterada (família PABX não implica recorrência). Idempotente e reversível
(evidence.familia_anterior). Padrão: simulação. Use --aplicar para gravar (banco do DATABASE_URL de app/.env).
"""
import re, subprocess, sys, openpyxl
from decimal import Decimal

APLICAR = "--aplicar" in sys.argv
FONTE = "db-export/2026-10-12/relatorios/fontes/base_faturamento_callface.xlsx"
U = [l.split("=", 1)[1].strip() for l in open("app/.env") if l.startswith("DATABASE_URL=")][0]
psql = lambda q: subprocess.run(["psql", U, "-At", "-F", "|", "-c", q], capture_output=True, text=True, check=True).stdout.strip().splitlines()

ws = openpyxl.load_workbook(FONTE, read_only=True, data_only=True)["Base"]
rows = list(ws.iter_rows(values_only=True))
cols = {i: re.sub(r"(\d{4})-M(\d{2})", r"\1-\2-01", str(h)) for i, h in enumerate(rows[0]) if re.match(r"\d{4}-M\d{2}", str(h))}
lease = []  # (doc, competência, valor)
for n, r in enumerate(rows[1:-1], start=2):
    if "LEASE" not in str(r[3]): continue
    for i, c in cols.items():
        if r[i] not in (None, 0): lease.append((re.sub(r"\D", "", str(r[1] or "")), c, Decimal(str(r[i])), n))

ids, soma_antes, nao_achou, ambiguas = [], Decimal(0), [], []
for doc, comp, valor, linha in lease:
    achados = psql(f"""select id from cliente_receita_mensal where source='planilha_base_faturamento'
        and regexp_replace(documento,'\\D','','g')='{doc}' and competencia='{comp}' and valor={valor}
        and service_family='UNKNOWN'""")
    if len(achados) == 1: ids.append((achados[0], valor, linha)); soma_antes += valor
    elif not achados:
        ja = psql(f"""select 1 from cliente_receita_mensal where regexp_replace(documento,'\\D','','g')='{doc}'
            and competencia='{comp}' and valor={valor} and evidence->>'business_line_original'='CALL FACE - LEASE'""")
        if not ja: nao_achou.append((doc, comp, valor))
    else: ambiguas.append((doc, comp, valor))
print(f"células LEASE na planilha: {len(lease)} | linhas UNKNOWN casadas 1:1: {len(ids)} (R$ {soma_antes}) | já corrigidas: {len(lease)-len(ids)-len(nao_achou)-len(ambiguas)} | sem casamento: {len(nao_achou)} | ambíguas: {len(ambiguas)}")
if nao_achou or ambiguas:
    print("NÃO APLICO: casamento incompleto", nao_achou[:3], ambiguas[:3]); sys.exit(1)
if not APLICAR:
    print("simulação; nada gravado. Rode com --aplicar."); sys.exit(0)
lista = ",".join(f"'{i}'" for i, _, _ in ids)
psql(f"""update cliente_receita_mensal set service_family='PABX', updated_at=now(),
    evidence = evidence || jsonb_build_object('business_line_original','CALL FACE - LEASE','familia_anterior','UNKNOWN',
      'regra','LEASE pertence a PABX (decisao Scott 12/10/2026); natureza inalterada')
  where id in ({lista}) and service_family='UNKNOWN'""")
print("aplicado:", psql(f"select count(*), sum(valor) from cliente_receita_mensal where id in ({lista}) and service_family='PABX'"))
