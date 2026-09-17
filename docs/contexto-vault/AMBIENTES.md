---
tipo: ambientes
status: ativo
owner: Kauã / Scott
atualizado_em: 2026-09-11
---

# Ambientes, Callface CRM

| Ambiente | Função | Fonte operacional | Regra |
|---|---|---|---|
| Desenvolvimento local | construir e testar mudanças | repositório local do CRM | não usar como verdade de produção |
| Homologação | validar mudança integrada com segurança | documentação de homologação e infraestrutura do projeto | validar antes de produção |
| Produção | operação real do CRM | status CRM, VPS e runbooks | só com aprovação explícita do Kauã |

## Referências existentes

- [[02_PROJETOS/Callface/CRM/produto/crm-callface-status|Status CRM]]
- [[02_PROJETOS/Callface/CRM/infra-integracao/credenciais-integracao|Integrações e acessos]]
- [[01_CONTEXTOS/01_CONTEXTOS/infraestrutura/vps-callface-ec2|VPS Callface]]
- [[05_DECISOES/Callface/CRM/2026-08-20-crm2-higiene-de-branches-git|Higiene de branches]]

