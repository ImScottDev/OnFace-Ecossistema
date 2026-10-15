/**
 * As fixtures do protótipo não voltam a aparecer para quem usa.
 *
 * Os arquivos `*Liga.tsx` e `*Desenho.tsx` são GERADOS do handoff e não se
 * editam — e o handoff tem dado de exemplo dentro: linhas de contato
 * inventadas, um mapa fixo que dá "Callface AI · 40 ramais" a quem não é
 * cliente, timeline de "WhatsApp recebido — ontem, 13:42" para qualquer
 * registro, badge "3" no Atendimento e "3 avisos · 2 insights" no NEXO.
 *
 * Em runtime nada disso aparece: cada adaptador (`*Proto.tsx`) escreve por
 * cima. Mas até 14/10/2026 NENHUM teste garantia isso. A auditoria desse dia
 * mediu cinco fixtures vivas, neutralizadas só pelos overrides — e uma
 * refatoração que perdesse um campo do adaptador devolveria o protótipo à
 * produção em silêncio, sem quebrar um único teste. É o pior tipo de regressão
 * deste repo: a tela continua funcionando e passa a mentir.
 *
 * Esta trava prende os cinco pontos. Falha ruidosa quando o override sai.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registroDoDesenho } from "@/components/onface/proto/registro-do-desenho";
import type { DetalheLead } from "@/lib/vendas/consultas";

const PROTO = path.join(process.cwd(), "src", "components", "onface", "proto");
const ler = (arquivo: string) => fs.readFileSync(path.join(PROTO, arquivo), "utf8");

/* `assert.ok` e não `assert.match`: o `match` despeja o arquivo inteiro na
   falha, e a mensagem — que aqui é o conteúdo do aviso — se perde no meio. */
const exige = (txt: string, re: RegExp, msg: string) => assert.ok(re.test(txt), msg);

test("Contatos só lista quem tem lead real por trás", () => {
  const txt = ler("ContatosProto.tsx");
  // `super.base()` traz as linhas do handoff (nomes e empresas inventados). O
  // filtro por `lead.real` / `leadsEmp.some(l => l.real)` é o que as remove.
  exige(txt, /super\.base\(\)\s*\.filter\(/,
    "ContatosProto deixou de filtrar `super.base()`: as linhas de exemplo do handoff voltam à lista de Contatos & Empresas");
  exige(txt, /!!r\.lead\?\.real/,
    "o filtro de pessoa não olha mais `lead.real`: linha sem registro no banco volta a aparecer");
  exige(txt, /leadsEmp[^\n]*\.some\(/,
    "o filtro de empresa não olha mais os leads reais dela: empresa de exemplo volta a aparecer");
});

test("o bloco de relação do Atendimento vem do negócio real, nunca do mapa fixo", () => {
  const liga = ler("AtendimentoLiga.tsx");
  const proto = ler("AtendimentoProto.tsx");

  // A fixture continua no arquivo gerado — é de lá que ela tem de ser coberta.
  // Se o handoff for regerado sem ela, melhor ainda: a asserção avisa para
  // simplificar o override em vez de deixar código morto.
  exige(liga, /const REL = \{/,
    "o mapa fixo REL saiu do Liga gerado: confira se o override do AtendimentoProto ainda é necessário");

  // O override: só o negócio real do lead (contexto.negocios[L.id]) escreve o
  // bloco. As chaves do mapa ("l13", "l9"…) nunca casam um UUID de verdade, mas
  // o `L.etapa === "oportunidade"` do fallback casa — e é ele que inventava
  // "Chance 20%" e "Valor: A definir".
  exige(proto, /P\.contexto\?\.negocios \?\? \{\}\)\[L\.id\]/,
    "AtendimentoProto não lê mais o negócio real do lead: o bloco Oportunidade/Cliente volta ao mapa fixo do protótipo (plano, MRR e CSM inventados)");
  exige(proto, /relTitulo:\s*"Cliente"/,
    "o ramo Cliente (negócio ganho) saiu do override");
  exige(proto, /relTitulo:\s*"Oportunidade"/,
    "o ramo Oportunidade saiu do override");
  exige(proto, /relTitulo === "Oportunidade"/,
    'o conserto de "Chance/Previsão/Valor" para "—" saiu: o fallback do protótipo volta a mostrar 20% e "A definir" para lead sem negócio');
});

test("a ficha sempre tem registro, e por isso nunca cai na timeline de exemplo", () => {
  // Os ramos mortos: EmpresaLiga (`E.registro ? … : [fixture]`) e PessoaLiga
  // (`L.registro ? … : [fixture]`). Eles só morrem porque o adaptador preenche
  // `registro` SEMPRE. Dois asserts, um para cada metade do contrato.
  const lead = {
    id: "9e1c0a52-4b3e-4a6f-9c71-0b6d2a3f4e55",
    pessoa: { nome: "Fulana", cargo: null, email: null, telefone: null, whatsapp: null, linkedin: null, observacao: null, cidade: null },
    empresa: { id: null, nome: "", cnpj: null, cidade: null, setor: null, website: null, telefone: null, observacoes: null },
    tags: [],
    etapa: "novo",
    classificacao: { classe: "lead" },
    responsavel: { nome: "Ninguém" },
    atribuicao: { origem: null, campanha: null, metaAdId: null },
    qualificacao: null,
    proximaAcao: null,
    criadoEm: new Date().toISOString(),
    respostasFormulario: [],
    metaRastreio: null,
    leadScore: null,
    servicos: [],
  } as unknown as DetalheLead;

  assert.equal(registroDoDesenho(lead).registro, lead.id,
    "`registroDoDesenho` parou de preencher `registro`: a Empresa e a Pessoa voltam a montar a timeline de exemplo do handoff (\"WhatsApp recebido — Ontem, 13:42\", campanha inventada)");

  /* A expressão EXATA de cada ramo. `registro ?` genérico não serve de trava:
     as duas Ligas o usam uma dúzia de vezes, e o teste passava verde com a
     condição da timeline trocada por `true`. */
  const ramos: Array<[arquivo: string, ramo: RegExp]> = [
    ["EmpresaLiga.tsx", /\.concat\(E\.registro \? \[/],
    ["PessoaLiga.tsx", /const semente = L\.registro \? \[/],
  ];
  for (const [arquivo, ramo] of ramos) {
    exige(ler(arquivo), ramo,
      `${arquivo} não condiciona mais a timeline a \`registro\`: a fixture do protótipo ("WhatsApp recebido — Ontem, 13:42", "Campanha …") deixa de ser ramo morto e pode virar o caminho normal`);
  }
});

test("os contadores do Atendimento e do NEXO são contagem real", () => {
  const liga = ler("CascaLiga.tsx");
  const proto = ler("CascaProto.tsx");

  // As duas fixtures do handoff: "3" no atalho do Atendimento e o resumo do NEXO.
  exige(liga, /nexoResumo: "3 avisos/,
    "o resumo fixo do NEXO saiu do Liga gerado: confira se o override da CascaProto ainda é necessário");

  exige(proto, /v\.nexoResumo\s*=\s*S\.nexoResumoReal/,
    'a CascaProto parou de sobrescrever o resumo do NEXO: o botão volta a dizer "3 avisos · 2 insights" para todo mundo, sempre');
  exige(proto, /it\.l === "Atendimento"/,
    'a CascaProto parou de trocar o badge do Atendimento: volta o "3" fixo do protótipo no Acesso rápido');
  exige(proto, /=\s*this\.props\.naoLidas/,
    "o badge do Atendimento deixou de sair da contagem real que o layout manda");
  exige(proto, /v\.temNotificacao\s*=\s*\(S\.naoLidasNotificacao/,
    "o ponto do sino voltou a sair da prop do protótipo em vez das notificações lidas do usuário");
});
