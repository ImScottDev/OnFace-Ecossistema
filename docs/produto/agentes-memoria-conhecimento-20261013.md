# Agentes OnFace — continuidade e conhecimento (13/10/2026)

## Arquitetura preservada
Agente = executor contextual com atribuição persistente, ferramentas autorizadas e memória. Automação = gatilho. Cadência = mensagens previamente definidas. NEXO = inteligência transversal, não SDR.
O agente publicado ganha identidade de usuário técnico no CRM; o atendente humano pode assumir e pausar a conversa. Nenhuma mudança nesta frente altera a política de canal, opt-out, limites ou aprovação.

## Memória de longo prazo
Antes de cada execução o Context Builder lê o estado atual do lead/negócio/cliente, propostas, serviços, 6–40 mensagens recentes, notas da equipe, compromissos e memória persistida de pessoa/empresa.
Além disso, agora recupera até 18 mensagens distribuídas por mês e por contato de até 18 meses, inclusive contatos anteriores vinculados ao mesmo lead; adiciona até sete notas humanas antigas. O texto antigo é histórico, não instrução.
Fatos específicos são persistidos pela ferramenta memory.remember com fonte e confirmação; inferência não substitui fato confirmado. O CRM é a fonte autoritativa para dados estruturados.
QA somente leitura no banco local: amostra de contato com mais de 22 mensagens e registro anterior a 60 dias; 20 mensagens recentes e seis mensagens antigas recuperadas, sem expor conteúdo pessoal.

## Fontes no Studio
Agora aceita texto, uma página HTTPS, PDF, DOCX, TXT, MD, CSV, JSON e HTML (máximo 6 MB por arquivo), com extração/indexação dos textos. A página HTML importada não é executada.
Novas fontes e reindexações ficam em rascunho. Só fontes aprovadas e prontas aparecem na busca; erro fica sinalizado como failed, não indexing eterno.
Importação HTTPS restringe URL e DNS, fixa IP público validado na conexão TLS, revalida redirecionamentos, impõe timeout/tamanho/mime e bloqueia localhost/IP privado/metadata cloud.
Uma URL importa apenas aquela página. PDF digitalizado sem texto exige OCR fora desta entrega. O conteúdo pode ser revisado antes da aprovação.

## Evidências de testes
- Importar: 4 testes de validação e segurança passaram.
- Importação HTTPS real de example.com: passou.
- PDF e DOCX fictícios: extração de texto passou.
- Testes de arquitetura: 99/99.
- Suite operacional sem DATABASE_URL: 35 testes ignorados, não E2E completo.
- Typecheck e GitHub CI devem passar antes do deploy.

## Homologação com SDR
Requer provedor IA e canal WhatsApp autorizados no ambiente de teste. Testar retorno após 60 dias, transferência para humano, agenda real, opt-out, replay, limite de mensagens e fontes aprovadas.
Não disparar WhatsApp, criar reuniões ou alterar contatos reais nos testes desta frente.

## Vault consultado
- ONFACE/decisoes/2026-10-12-agente-automacao-cadencia-sao-tres-produtos.md
- ONFACE/execucao/2026-10-12-agentes-ia-2-0.md
- ONFACE/execucao/2026-10-08-correcao-ponta-a-ponta-agentes-como-usuarios.md
