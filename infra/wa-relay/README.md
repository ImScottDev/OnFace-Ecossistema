# Relé e sincronizador de WhatsApp (convivência ONFACE x sistema antigo)

Só existe no servidor (`ubuntu@34.204.200.52`). Estas cópias servem para recriar. **Remover tudo isto na virada do domínio** (ver o checklist da virada no vault).

- `nginx.conf.template`: relé `callface-wa-relay` (nginx:alpine, redes `crm2dev-network` e `proxy-network`). Recebe o webhook do wuzapi, entrega ao sistema antigo (principal) e espelha ao ONFACE. Substituir `__UAZAPI_WEBHOOK_SECRET__` pelo `UAZAPI_WEBHOOK_SECRET` do `.env` do ONFACE e salvar em `/opt/callface/wa-relay/nginx.conf` (modo 600). `docker run -d --name callface-wa-relay --restart unless-stopped --network crm2dev-network -v /opt/callface/wa-relay/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine` e `docker network connect proxy-network callface-wa-relay`.
- `traefik-wa-relay.yml`: vai em `/opt/callface/infra/traefik/dynamic/wa-relay.yml` (manda `crm.callface.io/api/whatsapp/webhook` para o relé).
- `sync.py`: espelha as sessões de `whatsapp_sessao` entre os dois sistemas a cada minuto. Cron do usuário `ubuntu`: `* * * * * /usr/bin/python3 /opt/callface/wa-relay/sync.py >/dev/null 2>&1`.
- Também: `docker network connect crm2dev-network callface-crm-wuzapi` (refazer se o wuzapi for recriado).
