#!/usr/bin/env python3
"""Gera (e opcionalmente aplica) carga/5-ltv/01_receita_mensal_historica.sql.

POR QUE EXISTE
--------------
O Scott quer, dentro do cliente, um grafico de quanto ele pagou mes a mes e o
LTV. A tabela canonica `cliente_receita_mensal` ja existia e estava VAZIA. A
fonte da receita historica nao esta no banco: esta em 4 planilhas do financeiro
(ISO-8859-1, ';', 1.234,56). Este script le as 4, agrega UMA LINHA POR
(documento, competencia, source) e emite um .sql auto-contido com os VALUES —
assim o repo guarda o dado versionado e a carga roda em qualquer maquina sem
depender de ~/Downloads.

NAO e o importar-receita-mensal-historica.py: aquele aponta para o xlsx de uma
auditoria antiga. As regras (normalizacao de documento, source_hash, ON
CONFLICT) foram aproveitadas; a fonte e outra.

ARMADILHA (confirmada nas 4 fontes): TODAS tem linha de total no rodape.
  - julho  : ";;; 445.376,74"      -> sem CardName e sem CPFCNPJ
  - agosto : ";;;; 435.626,64"
  - setembro: ";;;; 512.404,49"
  - base   : "Total Geral;;;;; 23.349; ..."  <- essa quase passou batido
Importar qualquer uma delas DOBRA a receita do mes. O filtro e "documento
normalizado vazio", nunca "nome comeca com TOTAL": a linha 614 da base e a
cliente real TOTAL QUALITY MEDICINA DIAGNOSTICA.

CLASSIFICACAO — so o que a fonte diz, sem chute
-----------------------------------------------
A coluna "Business Line" da base e a unica evidencia de produto que existe nas
planilhas. Mapeamento (vocabulario de servicos_canonicos: PABX / CALLFACE_AI /
WHITE_LABEL / UNKNOWN e MRR / SETUP / UNKNOWN):
  CALL FACE - CLOUD/PABX -> service_family PABX, revenue_nature MRR
  CALL FACE - SETUP      -> family UNKNOWN (a linha diz a natureza, nao o
                            produto), revenue_nature SETUP
  CALL FACE - PLATAFORM  -> UNKNOWN / UNKNOWN  (nao ha de-para oficial de
                            "PLATAFORM" para as 3 familias; chutar CALLFACE_AI
                            seria inventar)
  CALL FACE - LEASE      -> UNKNOWN / UNKNOWN  (locacao de equipamento)
Quando a agregacao do mes junta business lines que mapeiam para familias
diferentes, a linha fica UNKNOWN — nao se escolhe uma. As planilhas mensais de
jul/ago/set NAO tem business line: ficam UNKNOWN/UNKNOWN por falta de dado.
Para dar caminho de resolucao humana, `evidence.familia_canonica_sugerida`
carrega a familia que servicos_canonicos tem para aquele documento quando e
unica — SUGESTAO, nao e gravada em service_family.

confidence (resolvido no SQL, depende do banco no momento da carga):
  CONFIRMED  = documento casou com exatamente 1 empresa E familia resolvida
  PROBABLE   = so um dos dois
  UNRESOLVED = nenhum dos dois  -> fila de revisao humana

Uso:
  python3 app/scripts/gerar-carga-receita-mensal.py            # so gera o .sql
  python3 app/scripts/gerar-carga-receita-mensal.py --aplicar  # gera e aplica
"""
from __future__ import annotations

import collections
import csv
import json
import re
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

DOWNLOADS = Path("/Users/Scott/Downloads")
OUT = Path(__file__).resolve().parents[1] / "src/lib/db/carga/5-ltv/01_receita_mensal_historica.sql"
DSN = "postgresql://callface@localhost:5432/callface_crm_ensaio_virada"

BASE_FILE = "base_faturamento_callface(Base).csv"
MENSAIS = [
    # (competencia, arquivo, idx_nome, idx_doc, idx_valor)
    ("2026-07-01", "Faturamento Julho -Callface (1)(Planilha1) (4).csv", 1, 2, 3),
    ("2026-08-01", "Callface 08-2026 --(Planilha1).csv", 2, 3, 4),
    ("2026-09-01", "Faturamento callface 09-2026-(Planilha1).csv", 2, 3, 4),
]
SRC_BASE = "planilha_base_faturamento"
SRC_MENSAL = "planilha_faturamento_mensal"

BUSINESS_LINE = {
    "CALL FACE - CLOUD/PABX": ("PABX", "MRR"),
    "CALL FACE - SETUP": ("UNKNOWN", "SETUP"),
    "CALL FACE - PLATAFORM": ("UNKNOWN", "UNKNOWN"),
    "CALL FACE - LEASE": ("UNKNOWN", "UNKNOWN"),
}


def digits(v: str) -> str:
    return re.sub(r"\D", "", v or "")


def brl(v: str) -> Decimal:
    s = (v or "").strip()
    if s in ("", "-"):
        return Decimal(0)
    return Decimal(s.replace(".", "").replace(",", "."))


def ler(nome: str) -> list[list[str]]:
    with (DOWNLOADS / nome).open(encoding="latin-1", newline="") as fh:
        return [r for r in csv.reader(fh, delimiter=";") if any(c.strip() for c in r)]


class Agg:
    __slots__ = ("nome", "valor", "n", "bls", "linhas", "arquivo")

    def __init__(self, nome, arquivo):
        self.nome, self.arquivo = nome, arquivo
        self.valor, self.n = Decimal(0), 0
        self.bls, self.linhas = collections.Counter(), []


def coletar() -> tuple[dict, dict]:
    agg: dict[tuple[str, str, str], Agg] = {}
    descartes = collections.Counter()

    rows = ler(BASE_FILE)
    head = [h.strip().lstrip("﻿") for h in rows[0]]
    meses = {i: f"{head[i][:4]}-{head[i][6:8]}-01" for i in range(5, len(head))}
    for ln, r in enumerate(rows[1:], start=2):
        doc, bl = digits(r[1]), r[3].strip()
        if not doc and not bl:  # linha "Total Geral" do rodape
            descartes[f"{BASE_FILE}:linha_total"] += 1
            continue
        if not doc:
            descartes[f"{BASE_FILE}:sem_documento"] += 1
            continue
        for i, comp in meses.items():
            v = brl(r[i] if i < len(r) else "")
            if v == 0:
                continue
            a = agg.setdefault((doc, comp, SRC_BASE), Agg(r[0].strip(), BASE_FILE))
            a.valor += v
            a.n += 1
            a.bls[bl or "(vazio)"] += 1
            a.linhas.append(ln)

    for comp, arq, inome, idoc, ival in MENSAIS:
        for ln, r in enumerate(ler(arq)[1:], start=2):
            doc = digits(r[idoc])
            if not doc:  # linha de total ";;;; 512.404,49"
                descartes[f"{arq}:linha_total"] += 1
                continue
            v = brl(r[ival])
            a = agg.setdefault((doc, comp, SRC_MENSAL), Agg(r[inome].strip(), arq))
            a.valor += v
            a.n += 1
            a.linhas.append(ln)
    return agg, descartes


def psql_csv(sql: str) -> list[dict]:
    p = subprocess.run(["psql", DSN, "-X", "-v", "ON_ERROR_STOP=1", "--csv", "-q", "-c", sql],
                       text=True, capture_output=True)
    if p.returncode:
        raise SystemExit(p.stderr)
    return list(csv.DictReader(p.stdout.splitlines()))


def familias_canonicas() -> dict[str, str]:
    """documento -> familia, so quando servicos_canonicos tem UMA familia conhecida."""
    sql = ("SELECT regexp_replace(coalesce(e.cnpj,''),'\\D','','g') AS doc, "
           "       min(s.service_family) AS fam "
           "FROM servicos_canonicos s JOIN empresas e ON e.id = s.empresa_id "
           "WHERE s.service_family <> 'UNKNOWN' "
           "  AND regexp_replace(coalesce(e.cnpj,''),'\\D','','g') <> '' "
           "GROUP BY 1 HAVING count(DISTINCT s.service_family) = 1")
    return {r["doc"]: r["fam"] for r in psql_csv(sql)}


def lit(s: str) -> str:
    return "'" + str(s).replace("'", "''") + "'"


def main() -> None:
    agg, descartes = coletar()
    sugestao = familias_canonicas()
    contradicoes = 0

    linhas_sql = []
    for (doc, comp, src), a in sorted(agg.items(), key=lambda kv: (kv[0][2], kv[0][1], kv[0][0])):
        fams = {BUSINESS_LINE.get(bl, ("UNKNOWN", "UNKNOWN"))[0] for bl in a.bls}
        nats = {BUSINESS_LINE.get(bl, ("UNKNOWN", "UNKNOWN"))[1] for bl in a.bls}
        fam = fams.pop() if len(fams) == 1 else "UNKNOWN"
        nat = nats.pop() if len(nats) == 1 else "UNKNOWN"
        ev = {}
        if a.bls:
            ev["business_lines"] = sorted(a.bls)
        sug = sugestao.get(doc)
        if sug:
            ev["familia_canonica_sugerida"] = sug
            if fam != "UNKNOWN" and fam != sug:
                ev["contradiz_servicos_canonicos"] = True
                contradicoes += 1
        linhas_sql.append(
            f"({lit(doc)},{lit(a.nome or doc)},{lit(doc)},DATE {lit(comp)},{a.valor:.2f},{a.n},"
            f"{lit(fam)},{lit(nat)},{lit(src)},{lit(a.arquivo)},{lit(','.join(map(str, a.linhas[:20])))},"
            f"{lit(json.dumps(ev, ensure_ascii=False, sort_keys=True))}::jsonb)")

    cab = Path(__file__).read_text(encoding="utf-8").split('"""')[1].strip().splitlines()
    header = "\n".join("-- " + l if l else "--" for l in cab)
    por_comp = collections.Counter()
    for (d, c, s), a in agg.items():
        por_comp[c] += a.valor

    medido = [
        "-- MEDIDO na geracao deste arquivo:",
        f"--   linhas agregadas .............. {len(agg)}",
        f"--   documentos distintos .......... {len({k[0] for k in agg})}",
        f"--   competencias .................. {min(k[1] for k in agg)} .. {max(k[1] for k in agg)}",
        f"--   fechamento 2026-07/08/09 ...... {por_comp['2026-07-01']} / {por_comp['2026-08-01']} / {por_comp['2026-09-01']}",
        f"--   linhas de total descartadas ... {dict(descartes)}",
        f"--   base contradiz servicos_canonicos em {contradicoes} documentos (so registrado em evidence)",
    ]

    corpo_values = ",\n".join(linhas_sql)
    bloco_medido = "\n".join(medido)
    sql = f"""{header}

{bloco_medido}

BEGIN;

CREATE TEMP TABLE _receita_in (
  customer_key text, cliente_nome text, documento text, competencia date,
  valor numeric(14,2), quantidade_lancamentos int,
  service_family text, revenue_nature text,
  source text, source_file text, source_row text, evidence jsonb
) ON COMMIT DROP;

INSERT INTO _receita_in VALUES
{corpo_values};

WITH org AS (SELECT id FROM organizacoes ORDER BY created_at LIMIT 1),
     emp AS (
       SELECT regexp_replace(coalesce(cnpj,''),'\\D','','g') AS doc, min(id::text)::uuid AS id
       FROM empresas
       WHERE regexp_replace(coalesce(cnpj,''),'\\D','','g') <> ''
       GROUP BY 1 HAVING count(*) = 1
     )
INSERT INTO cliente_receita_mensal (
  organizacao_id, empresa_id, customer_key, cliente_nome, documento, competencia,
  valor, quantidade_lancamentos, service_family, revenue_nature, canonical_product,
  confidence, source, source_file, source_row, evidence, source_hash)
SELECT org.id, emp.id, i.customer_key, i.cliente_nome, i.documento, i.competencia,
       i.valor, i.quantidade_lancamentos, i.service_family, i.revenue_nature, NULL,
       CASE WHEN emp.id IS NOT NULL AND i.service_family <> 'UNKNOWN' THEN 'CONFIRMED'
            WHEN emp.id IS NOT NULL OR  i.service_family <> 'UNKNOWN' THEN 'PROBABLE'
            ELSE 'UNRESOLVED' END,
       i.source, i.source_file, i.source_row,
       i.evidence || jsonb_build_object('empresa_match',
         CASE WHEN emp.id IS NOT NULL THEN 'cnpj_unico' ELSE 'sem_empresa_unica' END),
       encode(sha256((i.documento || '|' || i.competencia || '|' || i.source)::bytea), 'hex')
FROM _receita_in i CROSS JOIN org LEFT JOIN emp ON emp.doc = i.documento
ON CONFLICT (organizacao_id, source_hash) DO UPDATE SET
  empresa_id = EXCLUDED.empresa_id,
  cliente_nome = EXCLUDED.cliente_nome,
  valor = EXCLUDED.valor,
  quantidade_lancamentos = EXCLUDED.quantidade_lancamentos,
  service_family = EXCLUDED.service_family,
  revenue_nature = EXCLUDED.revenue_nature,
  confidence = EXCLUDED.confidence,
  source_file = EXCLUDED.source_file,
  source_row = EXCLUDED.source_row,
  evidence = EXCLUDED.evidence,
  updated_at = now();

-- converge: linha que saiu da fonte nao pode sobreviver de uma carga anterior
DELETE FROM cliente_receita_mensal c
WHERE c.source IN ({lit(SRC_BASE)}, {lit(SRC_MENSAL)})
  AND NOT EXISTS (
    SELECT 1 FROM _receita_in i
    WHERE encode(sha256((i.documento || '|' || i.competencia || '|' || i.source)::bytea), 'hex') = c.source_hash
  );

COMMIT;

-- CONFERENCIA (rodar depois; os tres fechamentos tem que bater com o rodape das
-- planilhas de jul/ago/set: 445375.74 / 435626.64 / 512404.49):
--   SELECT competencia, count(*), sum(valor) FROM cliente_receita_mensal
--    WHERE competencia >= '2026-07-01' GROUP BY 1 ORDER BY 1;
--   SELECT count(*) FROM (SELECT documento, competencia FROM cliente_receita_mensal
--                          GROUP BY 1,2 HAVING count(*) > 1) t;   -- tem que ser 0
--
-- LIMITES CONHECIDOS DA FONTE (nao sao bug da carga):
--   * a base historica vem arredondada em reais inteiros; o proprio rodape "Total
--     Geral" da planilha diverge da soma das linhas em no maximo R$ 13 no mes e
--     R$ 332 em 64 meses (0,0014%). jul/ago/set vem com centavos e batem exato.
--   * 8 linhas tem valor negativo (estorno no mes). Sao reais, ficam gravadas.
--   * jul/ago/set nao trazem Business Line: service_family/revenue_nature UNKNOWN
--     por falta de dado, nao por falha de classificacao.
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(sql, encoding="utf-8")
    print(json.dumps({"arquivo": str(OUT), "linhas": len(agg), "kb": round(len(sql) / 1024),
                      "fechamento": {k: str(v) for k, v in sorted(por_comp.items()) if k >= "2026-07-01"},
                      "descartes": dict(descartes), "contradicoes": contradicoes}, ensure_ascii=False))

    if "--aplicar" in sys.argv:
        p = subprocess.run(["psql", DSN, "-X", "-v", "ON_ERROR_STOP=1", "-f", str(OUT)],
                           text=True, capture_output=True)
        print(p.stdout[-2000:] or p.stderr[-2000:])
        if p.returncode:
            raise SystemExit(p.returncode)


if __name__ == "__main__":
    main()
