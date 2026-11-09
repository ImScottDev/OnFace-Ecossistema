/**
 * A chave de um campo customizado tem UM gerador.
 *
 * Em 09/11 havia três implementações da mesma regra: um `slugify` dentro de
 * `/ajustes/campos-custom`, um `chaveDoRotulo` dentro do formulário de
 * levantamento do pós-venda, e o `chaveDoCampo` que o Núcleo exportou para
 * unificar os dois. As três produziam a mesma chave — naquele dia.
 *
 * Por que isso é trava e não estilo: a DEFINIÇÃO do campo nasce em
 * `custom_fields` pela tela de Ajustes, e o VALOR nasce em
 * `empresas.campos_custom` pelo projeto. As duas superfícies precisam produzir
 * a mesma chave para o mesmo rótulo, para sempre. No dia em que uma mudar —
 * um acento tratado diferente, um limite de tamanho, um hífen — "Horário de
 * pico" criado no projeto e "Horário de pico" criado em Ajustes viram dois
 * campos distintos, e o valor de um não aparece no outro. Sem erro, sem log:
 * o campo só fica vazio.
 *
 * ESCOPO, de propósito estreito. A primeira versão desta trava procurava
 * qualquer `normalize("NFD")` com classe `[^a-z0-9]` e acusou oito arquivos
 * que normalizam acento para outra coisa — busca, tag, importação de
 * planilha. Trava que nasce vermelha em código correto morre de desuso, e
 * ainda ensina o time a ignorar o portão. Então ela vigia só as duas
 * superfícies que de fato escrevem e leem `campos_custom`, nomeadas aqui.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.join(process.cwd(), "src");
const FONTE = path.join("lib", "pos-venda", "regras.ts");

/** As duas telas que compartilham a chave. Acrescentar aqui quando surgir uma terceira. */
const SUPERFICIES = [
  path.join("app", "(produto)", "ajustes", "campos-custom", "page.tsx"),
  path.join("components", "onface", "pos-venda", "projeto", "Levantamento.tsx"),
];

/* Gerar slug é tirar acento com NFD e trocar o que não é alfanumérico por
   separador, na mesma expressão. */
const CHEIRO_DE_SLUG = /normalize\(\s*["']NFD["']\s*\)[\s\S]{0,200}?\[\^a-z0-9\]/;

test("as duas superfícies de campo custom importam a chave, não a reescrevem", () => {
  const reincidentes: string[] = [];
  for (const rel of SUPERFICIES) {
    const abs = path.join(RAIZ, rel);
    assert.ok(fs.existsSync(abs), `${rel} mudou de lugar: atualize esta trava junto`);
    const fonte = fs.readFileSync(abs, "utf8");

    if (CHEIRO_DE_SLUG.test(fonte)) reincidentes.push(`${rel}: define a regra em vez de importar`);
    if (!/\bchaveDoCampo\b/.test(fonte)) reincidentes.push(`${rel}: não usa chaveDoCampo`);
  }

  assert.deepEqual(reincidentes, [],
    "A chave do campo custom precisa sair de `chaveDoCampo`:\n  " + reincidentes.join("\n  ") +
    "\nDuas cópias que precisam concordar para sempre é a divergência esperando " +
    "acontecer, e ela aparece como campo vazio, sem erro nenhum.");
});

test("`chaveDoCampo` continua exportado de onde as duas importam", () => {
  const regras = fs.readFileSync(path.join(RAIZ, FONTE), "utf8");
  assert.match(regras, /export function chaveDoCampo\s*\(/,
    "a função que as duas superfícies importam não muda de casa sem atualizar os chamadores");
});
