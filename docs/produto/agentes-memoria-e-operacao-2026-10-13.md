# OnFace — Agentes operacionais e memória | Entrega 13/10/2026

## Norte de produto
Agentes são **usuários operacionais especializados**, com identidade, objetivo, gatilhos, autonomia, permissões, número/canal, supervisionamento e atribuição exclusiva. O NEXO é a inteligência/coprocessador transversal; Hermes coordena trabalhos; cadências são mensagens planejadas do time e **não** o motor do agente autônomo.

## O que já existia e foi preservado
- Runtime em `ai-platform/runtime/execute-agent.ts`, autorizações delegadas, limites, controladores do canal e governança.
- Atribuição persistente, operador humano, pausa/retomada/handoff e lease de conversa.
- Context Builder com CRM canônico, lead e negócio, empresas, notas, ligações, propostas, atendimento WhatsApp, reuniões, histórico e estado de operação.
- Memória factual `ai_memoria_fatos`, memória da organização, `memory_remember`, compromissos do agente e histórico de execuções.
- Lia SDR predefinida com playbook, conhecimento aprovado, roteamento para closers e ferramentas; versão publicada existente não se altera automaticamente.

## Alterações desta entrega
1. **Memória histórica contextual**: episódios reais antigos por contato e por contatos da mesma pessoa/lead, até 730 dias, ranqueados com limites. Mostra autoria e data; mensagem antiga não se confunde com fato atual.
2. **Fato por pessoa/empresa**: novas memórias de pessoa ficam ancoradas ao lead, de empresa à empresa, e mensagens antigas ancoradas a contatos anteriores podem ser recuperadas pelo vínculo canônico do CRM. Inferências não podem substituir fatos confirmados.
3. **Configuração SDR**: novos agentes de pré-vendas já vêm com `memory.remember`, `memory.read`, `followup.schedule` e conhecimento. Para versões antigas, editor oferece botão para acrescentar ferramentas no rascunho; só o administrador publica a versão revisada.
4. **Segurança em execução**: checagem de intervenção humana depois da inferência e antes do egress. Sem resposta segura à mensagem recebida abre caso para revisão humana; não inventa resposta.
5. **Conhecimento sem colar tudo**: fontes textuais, arquivos textuais locais e URL pública no próprio editor; URL passa por validação anti-SSRF, limites de tamanho e tempo, DNS fixado e redirecionamentos controlados; versões governadas, fonte nova começa como rascunho.
6. **Isolamento multi-tenant** no histórico sob consulta por ferramenta e memória com referências da organização.
7. **Segurança de prompt**: fontes, sites, chats e documentos são dados, nunca instruções que ampliem ferramentas ou permissões.

## Uso (sem afetar agente publicado)
1. Abrir Automação > Agentes > Lia SDR (ou outro agente de pré-vendas).
2. Revisar instruções, ferramenta, número, limites, autonomia e supervisor. Caso o editor ofereça **Habilitar memória e retomadas**, ativar e salvar uma **nova versão em rascunho**.
3. Na aba Conhecimento, importar texto, TXT/MD/CSV/JSON/HTML/XML/YAML ou uma página pública por URL. **Nova fonte nasce em Rascunho.** Revisar e aprovar antes de virar verdade comercial.
4. Testar com cenário realista sem egress: mesmo lead retornando após 60 dias, novo número, humano assumindo durante run, promessa de retorno, cliente já ativo e opt-out.
5. Publicar explicitamente depois de validar prontidão; acompanhar Execuções, casos e compromissos.
6. Usar canais reais apenas após autorização do responsável; não disparar abordagens de teste para clientes.

## Limites deliberados / não declarar como concluído sem prova
- Leitura de site é **uma página pública por URL**, não crawler recursivo.
- Arquivos suportados neste fluxo são **textuais**. PDF/DOCX binários ainda exigem parser, antivírus, limites de páginas e QA específico — nunca usar `File.text()` em PDF para fingir extração.
- Memória antiga não garante dedução semântica perfeita: a recuperação combina fatos estruturados e episódios recentes/relevantes, com janela e limites. Validação completa precisa de um banco com conversas reais autorizadas.
- `LIA` publicada anteriormente mantém a configuração da versão anterior até edição e publicação de uma nova. Código/preset não reconfigura agentes existentes silenciosamente.
- Casos dependentes de banco/WhatsApp/provider não ficam comprovados apenas por `tsc` ou testes unitários.
- Não confundir execução do agente com cadência comercial nem reutilizar arquivos privados do Vault como fonte automaticamente. A importação segue seleção e aprovação humana.

## Critérios de aceite em ambiente
- 60+ dias depois o SDR lembra o contexto e sabe quem falou com o cliente, cita apenas informações comprovadas, lê etapa e responsável atuais, não pergunta novamente.
- Se o contato pedir quinta que vem, compromisso próprio é gravado e executado com contexto atualizado, respeitando opt-out, limites, agenda e horário.
- Se um humano assumiu, nenhum agente duplica mensagem nem rouba responsabilidade; há log da intervenção.
- Um agente não consegue consultar dados de outra organização nem atuar além da interseção entre permissões de seu usuário e versão.
- Knowledge de rascunho não entra em resposta; após aprovação entra e é rastreável.
- Monitorar custos, execuções, falhas, handoff e autorização antes de escalar o SDR para clientes reais.

Referências de mercado consultadas: LangGraph Persistence/Stores, OpenAI Agents SDK Sessions/Handoffs. A arquitetura nativa do OnFace foi preservada.
