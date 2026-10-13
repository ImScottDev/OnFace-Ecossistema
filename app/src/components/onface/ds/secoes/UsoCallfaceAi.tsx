"use client";

/** Uso da Callface AI — exemplos do laboratório.
 *
 * Os componentes são os mesmos do produto (`components/onface/callface-ai`);
 * o que muda é só o dado, aqui estático e determinístico no formato exato de
 * `lib/callface-ai/uso`. Dado de uso real só existe em produção, então é aqui
 * que a tela se confere localmente: cada estado do contrato (vínculo por
 * evidência, pendente, sem vínculo, sem coleta, erro, carregando) e a carteira
 * com a fila de vínculos. */

import * as React from "react";
import { toast } from "sonner";
import { Bloco, Regras, Secao } from "../lab";
import { UsoDoClientePainel, UsoDoClienteCarregando } from "@/components/onface/callface-ai/UsoDoClientePainel";
import { UsoCarteiraWorkspace } from "@/components/onface/callface-ai/UsoCarteiraWorkspace";
import type {
  AcoesDeVinculo, DiaDeUso, FlagUso, ItemCarteiraDeUso, SugestaoDeVinculo, UsoDoCliente, VinculoPendente,
} from "@/components/onface/callface-ai/tipos";

const AGORA = new Date(2026, 9, 13, 11, 20);
const iso = (...a: [number, number, number, number?]) => new Date(a[0], a[1], a[2], a[3] ?? 12).toISOString();

/** Ruído determinístico: o laboratório não pode mudar a cada recarga. */
function serie(base: number, fator: (diasAtras: number) => number): DiaDeUso[] {
  return Array.from({ length: 90 }, (_, k) => {
    const i = 89 - k;
    const d = new Date(Date.UTC(2026, 9, 13 - i));
    const fds = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    const ruido = ((k * 37) % 23) / 23;
    const minutos = fds ? 0 : Math.round(base * fator(i) * (0.7 + ruido * 0.6));
    const chamadas = Math.round(minutos / 3.4);
    return { dia: d.toISOString().slice(0, 10), chamadas, finalizadas: Math.round(chamadas * 0.62), minutos, usuariosAtivos: minutos ? 5 : 0 };
  });
}

const SINC = { status: "ok", ultimoSyncEm: iso(2026, 9, 13, 11), ultimoSucessoEm: iso(2026, 9, 13, 11), erro: null, idadeHoras: 0.3 };
const vazio = (empresaNome: string, sugestoes: SugestaoDeVinculo[]): UsoDoCliente => ({
  empresaId: "lab-" + empresaNome, empresaNome,
  vinculo: { estado: sugestoes.length ? "pendente" : "sem", orgCallfaceId: null, nomeOrg: null, evidencia: null, vinculadoEm: null, decididoPor: null, sugestoes },
  sincronizacao: SINC, plano: null, minutos: null, ligacoes: null, usuarios: null, campanhas: null, agentes: null, integracoes: null,
  ultimaAtividadeEm: null, diasSemAtividade: null, flags: [],
});

const SERIE_VIDA = serie(320, (i) => 1 + (90 - i) / 140);
const SAUDAVEL: UsoDoCliente = {
  ...vazio("Clínica Vida Plena", []),
  vinculo: {
    estado: "auto", orgCallfaceId: "org_8f21", nomeOrg: "Clínica Vida Plena", vinculadoEm: iso(2026, 8, 2), decididoPor: null, sugestoes: [],
    evidencia: { origem: "auto", regra: "cnpj_igual", decididoEm: iso(2026, 8, 2), sinais: [
      { chave: "CNPJ", valor: "12.345.678/0001-90", onface: "12.345.678/0001-90", saas: "12345678000190" },
      { chave: "Domínio", valor: "vidaplena.com.br", onface: "contato@vidaplena.com.br", saas: "admin@vidaplena.com.br" },
    ] },
  },
  plano: {
    principal: "Growth",
    porPlano: [{ plano: "Growth", motivo: "PAGO", licencas: 8, atribuidas: 8, minutos: 6000, semLimite: false }],
    licencas: { contratadas: 8, atribuidas: 8, emUso: 7, trial: 0, minutosContratados: 6000, minutosSemLimite: false, percentualEmUso: 87.5 },
  },
  minutos: { hoje: 139, d7: 2080, d30: 8436, mesCorrente: 5240, contratadosMes: 6000, percentualDoLimite: 87.3 },
  ligacoes: { hoje: 41, d7: 612, d30: 2481, mesCorrente: 1104, taxaConexao30d: 61.8, ambiguas30d: 12, serieDiaria90d: SERIE_VIDA },
  usuarios: {
    total: 9, ativos: 8, pendentes: 1, comAtividade7d: 5, comAtividade30d: 7,
    lista: [
      { nome: "Marina Lopes", email: "marina@vidaplena.com.br", papel: "Administradora", aceite: "aceito", ativo: true, ultimaChamadaEm: iso(2026, 9, 13, 9), chamadas7d: 140, chamadas30d: 610 },
      { nome: "Rafael Couto", email: "rafael@vidaplena.com.br", papel: "Operador", aceite: "aceito", ativo: true, ultimaChamadaEm: iso(2026, 9, 11, 16), chamadas7d: 88, chamadas30d: 402 },
      { nome: "Ana Beatriz", email: "ana@vidaplena.com.br", papel: "Operadora", aceite: "aceito", ativo: true, ultimaChamadaEm: null, chamadas7d: 0, chamadas30d: 0 },
    ],
  },
  campanhas: { ativas: 3, concluidas30d: 2, porStatus: { rodando: 3, pausada: 1 }, recentes: [
    { nome: "Reativação de pacientes", status: "Rodando", total: 1800, discados: 1210, atualizadaEm: iso(2026, 9, 13) },
    { nome: "Confirmação de consulta", status: "Rodando", total: 420, discados: 398, atualizadaEm: iso(2026, 9, 13) },
    { nome: "Pesquisa NPS", status: "Pausada", total: 600, discados: 140, atualizadaEm: iso(2026, 9, 2) },
  ] },
  agentes: { prontos: 2, porStatus: { pronto: 2 }, lista: [{ nome: "Recepção (voz)", status: "Pronto", criadoEm: iso(2026, 6, 1) }, { nome: "Cobrança gentil", status: "Pronto", criadoEm: iso(2026, 7, 9) }] },
  integracoes: { apps: [{ nome: "Google Agenda", ativo: true }, { nome: "WhatsApp", ativo: false }], appsAtivos: 1, webhooksAtivos: 2 },
  ultimaAtividadeEm: iso(2026, 9, 13, 10),
  diasSemAtividade: 0,
  flags: [{ codigo: "perto_do_limite", rotulo: "Perto do limite", detalhe: "87% do limite de minutos (oportunidade de expansão).", gravidade: "atencao" }],
};

const FLAGS_AURORA: FlagUso[] = [
  { codigo: "inativo_14d", rotulo: "Inativo", detalhe: "22 dias sem atividade.", gravidade: "atencao" },
  { codigo: "queda_40", rotulo: "Queda de uso", detalhe: "88% menos minutos que nos 30 dias anteriores.", gravidade: "risco" },
];

const SUG_AURORA: SugestaoDeVinculo[] = [
  { candidatoId: "c1", orgCallfaceId: "org_9", nomeOrg: "Aurora Cobranças", score: 0.72, sinal: "dominio_email_admin", razao: "Domínio do e-mail do administrador (@grupoaurora.com.br) igual ao do contato principal", evidencia: null },
  { candidatoId: "c2", orgCallfaceId: "org_10", nomeOrg: "Aurora Serviços", score: 0.41, sinal: "nome_parecido", razao: "Nome parecido (Aurora)", evidencia: null },
];

const SEM_COLETA: UsoDoCliente = { ...vazio("Ótica Visão Clara", []), vinculo: { ...SAUDAVEL.vinculo, nomeOrg: "Visão Clara", estado: "confirmado", decididoPor: "Kauã" } };

const ok = async () => { await new Promise((r) => setTimeout(r, 500)); toast("Exemplo do laboratório: no produto isto grava e audita."); return { ok: true as const, estado: "confirmado" as const, orgCallfaceId: "org" }; };
const ACOES: AcoesDeVinculo = { confirmar: ok, remover: ok };

const item = (empresaId: string, empresaNome: string, p: Partial<ItemCarteiraDeUso>): ItemCarteiraDeUso => ({
  empresaId, empresaNome, orgCallfaceId: "org_" + empresaId, estadoVinculo: "auto", plano: "Growth", minutos30d: 0, minutos30dAnteriores: 0,
  tendenciaPct: null, usuariosAtivos30d: 0, licencasContratadas: 0, licencasEmUso: 0, percentualMinutos: null,
  ultimaAtividadeEm: null, diasSemAtividade: null, idadeDadoHoras: 0.3, flags: [], ...p,
});
const CARTEIRA: ItemCarteiraDeUso[] = [
  item("a", "Clínica Vida Plena", { minutos30d: 8436, minutos30dAnteriores: 6900, tendenciaPct: 22.3, usuariosAtivos30d: 7, licencasContratadas: 8, licencasEmUso: 7, percentualMinutos: 87.3, ultimaAtividadeEm: SAUDAVEL.ultimaAtividadeEm, diasSemAtividade: 0, flags: SAUDAVEL.flags }),
  item("b", "Grupo Aurora", { plano: "Starter", minutos30d: 120, minutos30dAnteriores: 1000, tendenciaPct: -88, usuariosAtivos30d: 1, licencasContratadas: 5, licencasEmUso: 1, ultimaAtividadeEm: iso(2026, 8, 21), diasSemAtividade: 22, flags: FLAGS_AURORA }),
  item("c", "Imobiliária Horizonte", { minutos30d: 2210, minutos30dAnteriores: 4100, tendenciaPct: -46.1, usuariosAtivos30d: 3, licencasContratadas: 4, licencasEmUso: 3, ultimaAtividadeEm: iso(2026, 9, 12), diasSemAtividade: 1, idadeDadoHoras: 30, flags: [{ codigo: "queda_40", rotulo: "Queda de uso", detalhe: "46% menos minutos que nos 30 dias anteriores.", gravidade: "atencao" }] }),
  item("d", "Escola Saber Mais", { plano: "Starter", licencasContratadas: 3, flags: [{ codigo: "sem_uso_desde_a_contratacao", rotulo: "Nunca usou", detalhe: "Nenhuma ligação nem atividade registrada nos últimos 90 dias.", gravidade: "risco" }] }),
  item("e", "Ótica Visão Clara", { plano: null, minutos30d: 3980, minutos30dAnteriores: 3820, tendenciaPct: 4.2, usuariosAtivos30d: 4, ultimaAtividadeEm: iso(2026, 9, 13, 8), diasSemAtividade: 0 }),
];
const SERIES = Object.fromEntries(CARTEIRA.map((c, i) => [c.empresaId, serie([280, 40, 80, 0, 130][i], (k) => (i === 1 && k < 22 ? 0 : 1)).slice(-30).map((p) => p.minutos)]));

const PENDENTES: VinculoPendente[] = [
  { empresaId: "p1", empresaNome: "Grupo Aurora", cnpj: "33.444.555/0001-66", sugestoes: SUG_AURORA, situacao: "sugestao" },
  { empresaId: "p2", empresaNome: "Laboratório Pasteur", cnpj: null, situacao: "sugestao", sugestoes: [{ candidatoId: "c3", orgCallfaceId: "org_11", nomeOrg: "Pasteur Lab", score: 0.68, sinal: "telefone_admin", razao: "Telefone do administrador igual ao da empresa", evidencia: null }] },
  { empresaId: "p3", empresaNome: "Padaria Pão Nosso", cnpj: "11.222.333/0001-44", sugestoes: [], situacao: "sem_sugestao" },
];

export function SecaoUsoCallfaceAi() {
  return (
    <Secao titulo="Uso da Callface AI"
      chamada="Como cada cliente usa o SaaS: vínculo auditável com a organização, o número que decide, sinais com o porquê e a carteira lida pelo uso.">
      <Regras
        faca={{ titulo: "vínculo antes do número", texto: "Sem vínculo nenhum dado é do cliente; cada sinal diz quais números o dispararam e o vazio traz a ação que resolve." }}
        naoFaca={{ titulo: "dado presumido", texto: "Inventar % do plano sem franquia registrada, mostrar números da organização sugerida antes da confirmação ou somar uso de cliente sem vínculo." }}
      />
      <Bloco titulo="Cliente 360 · vinculado por evidência" arquivo="callface-ai/UsoDoClientePainel.tsx"
        importar='import { UsoDoClientePainel } from "@/components/onface/callface-ai/UsoDoClientePainel"' fundo="sunken" plano>
        <UsoDoClientePainel uso={SAUDAVEL} acoes={ACOES} agora={AGORA} />
      </Bloco>
      <Bloco titulo="Cliente 360 · vínculo pendente" descricao="Sugestões com a razão e a semelhança; nenhum número até alguém confirmar." fundo="sunken" plano>
        <UsoDoClientePainel uso={vazio("Grupo Aurora", SUG_AURORA)} acoes={ACOES} agora={AGORA} />
      </Bloco>
      <Bloco titulo="Cliente 360 · sem vínculo, sem coleta, erro e carregando" fundo="sunken" plano>
        <div className="flex flex-col gap-6">
          <UsoDoClientePainel uso={vazio("Padaria Pão Nosso", [])} acoes={ACOES} agora={AGORA} />
          <UsoDoClientePainel uso={SEM_COLETA} acoes={ACOES} agora={AGORA} />
          <UsoDoClientePainel uso={null} erro="A leitura do uso falhou no servidor. Recarregue; se continuar, o sincronizador pode estar fora do ar." aoMudar={() => toast("Tentaria de novo")} />
          <UsoDoClienteCarregando />
        </div>
      </Bloco>
      <Bloco titulo="Carteira por uso e fila de vínculos" arquivo="callface-ai/UsoCarteiraWorkspace.tsx" fundo="sunken" plano>
        <UsoCarteiraWorkspace carteira={CARTEIRA} pendentes={PENDENTES} series={SERIES} acoes={ACOES} agora={AGORA} />
      </Bloco>
    </Secao>
  );
}
