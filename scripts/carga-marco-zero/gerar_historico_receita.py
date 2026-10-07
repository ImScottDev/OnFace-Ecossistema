#!/usr/bin/env python3
"""Gera revisao/historico_receita.tsv (TSV, tab), a entrada do passo 08 (cliente_receita_mensal).

Fonte: faturamento_por_cliente_mes.csv, que o db-export/2026-10-06/analise/
faturamento_script_reconstrucao.py regera do xlsx oficial (base_faturamento_callface.xlsx,
com centavos, ate 2026-06) mais os fechamentos de jul/ago/set. Totais conferidos em
06/10: R$ 25.295.202,48, 602 documentos, jul 445.375,74, ago 435.626,64, set 512.404,49.

Este script so acrescenta o que o passo 08 precisa por linha: natureza da receita,
familia, confianca, fonte. Os dados reais ficam em revisao/ (ignorado pelo git).

Natureza (regra do Scott, 06/10): MRR | SETUP | DEBITO_RECUPERADO. Aqui so o que a
planilha prova: linha de negocio SETUP = SETUP; o resto = MRR. LEASE e aluguel
recorrente (MRR). jul/ago/set vem dos fechamentos, que nao trazem natureza: ficam MRR
com confianca PROBABLE (excecoes de set/26 sao tratadas no SQL, pelo documento).
"""
import argparse, csv, sys

FAMILIA = {'PABX': 'PABX', 'PLATAFORMA': 'CALLFACE_AI', 'WHITE_LABEL': 'WHITE_LABEL'}  # resto = UNKNOWN
CONFIANCA_BL = {'base:business_line_da_planilha': 'CONFIRMED', 'base:linha_unica': 'PROBABLE',
                'onface:servicos_canonicos': 'PROBABLE', 'base:valor_mais_proximo': 'PROBABLE',
                'stripe_ou_nf_spedy_via_stripe': 'PROBABLE',
                'inferido:valor_e_multiplo_de_preco_callface_ai': 'PROBABLE', 'sem_evidencia': 'UNRESOLVED'}

ap = argparse.ArgumentParser()
ap.add_argument('--por-cliente-mes', default='../../db-export/2026-10-06/analise/faturamento_por_cliente_mes.csv')
ap.add_argument('--saida', default='revisao/historico_receita.tsv')
a = ap.parse_args()

total = 0.0
with open(a.por_cliente_mes, encoding='utf-8') as f, open(a.saida, 'w', encoding='utf-8') as o:
    limpa = lambda t: ' '.join(str(t).split())  # tab/quebra de linha no nome quebrariam o TSV
    w = lambda cols: o.write('\t'.join(limpa(c) for c in cols) + '\n')
    w(['documento', 'nome', 'competencia', 'business_line', 'valor', 'natureza', 'service_family',
                'confidence', 'evidencia', 'fonte', 'linha'])
    for i, r in enumerate(csv.DictReader(f, delimiter=';'), start=2):
        bl, v = r['business_line'], float(r['valor'].replace(',', '.'))
        total += v
        w([r['customer_key'], r['nome'], r['competencia'], bl, f'{v:.2f}',
                    'SETUP' if bl == 'SETUP' else 'MRR', FAMILIA.get(bl, 'UNKNOWN'),
                    CONFIANCA_BL.get(r['evidencia_business_line'], 'CONFIRMED'),
                    r['evidencia_business_line'] or 'base:business_line_da_planilha', r['fonte'], i])
print(f'total {total:.2f}', file=sys.stderr)
