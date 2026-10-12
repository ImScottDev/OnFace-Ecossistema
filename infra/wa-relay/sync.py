#!/usr/bin/env python3
"""Sincroniza sessões de WhatsApp entre o sistema antigo e o ONFACE (provisório,
enquanto os dois convivem). Fonte da verdade: usuários do wuzapi de produção.

A cada rodada, para cada sessão do wuzapi:
  1. o webhook aponta para o relé (que entrega aos dois sistemas);
  2. as duas tabelas whatsapp_sessao têm a linha (copia da que existe, ou cria);
  3. o status (connected/disconnected) e o telefone ficam iguais nos dois.
Não apaga nada. Sem segredo em log.
"""
import json, os, re, subprocess, sys, time, urllib.request, fcntl

RELAY = "http://callface-wa-relay:8080/"
SKIP_WEBHOOK_CONTAINS = ("homolog",)  # sessões de outro ambiente ficam como estão
OLD = ("callface-crm-postgres", "callface_crm")
NEW = ("callface-crm2-dev-postgres", "callface_crm_mz")
WZ = ("callface-crm-postgres", "callface_wuzapi")
LOG = "/opt/callface/wa-relay/sync.log"


def log(msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + msg
    print(line)
    try:
        if os.path.exists(LOG) and os.path.getsize(LOG) > 300_000:
            os.rename(LOG, LOG + ".1")
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def psql(target, sql, variables=None):
    cmd = ["docker", "exec", "-i", target[0], "psql", "-U", "callface", "-d", target[1],
           "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1"]
    for k, v in (variables or {}).items():
        cmd += ["-v", f"{k}={'' if v is None else v}"]
    r = subprocess.run(cmd, input=sql, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        raise RuntimeError(f"psql {target[1]}: {r.stderr.strip()[:200]}")
    return [l.split("\t") for l in r.stdout.splitlines() if l != ""]


def wuzapi_ip():
    out = subprocess.run(["docker", "inspect", "-f",
                          "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}", "callface-crm-wuzapi"],
                         capture_output=True, text=True).stdout.split()
    return out[0]


def set_webhook(ip, token):
    req = urllib.request.Request(f"http://{ip}:8080/webhook", method="POST",
                                 data=json.dumps({"webhookURL": RELAY}).encode(),
                                 headers={"token": token, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status


def rows(target):
    cols = ("session_name,label,api_token,tipo,assign_strategy,phone_number,usuario_id::text,status,"
            "organizacao_id::text")
    data = psql(target, f"select {cols} from whatsapp_sessao")
    keys = ["session_name", "label", "api_token", "tipo", "assign_strategy", "phone_number", "usuario_id",
            "status", "organizacao_id"]
    return [dict(zip(keys, r + [""] * (len(keys) - len(r)))) for r in data]


def user_ids(target):
    return {r[0] for r in psql(target, "select id::text from usuarios")}


def main():
    lock = open("/tmp/wa_sync.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return
    ip = wuzapi_ip()
    wz = psql(WZ, "select name, token, connected::text, coalesce(jid,''), coalesce(webhook,'') from users")
    tables = {"antigo": (OLD, rows(OLD), user_ids(OLD)), "onface": (NEW, rows(NEW), user_ids(NEW))}
    org = psql(NEW, "select id::text from organizacoes limit 1")[0][0]
    alterou = 0
    for name, token, connected, jid, webhook in wz:
        if any(s in webhook for s in SKIP_WEBHOOK_CONTAINS):
            continue
        # 1) webhook no relé
        if webhook != RELAY:
            try:
                set_webhook(ip, token)
                log(f"webhook de '{name}' trocado para o relé")
                alterou += 1
            except Exception as e:  # noqa: BLE001
                log(f"ERRO webhook '{name}': {e}")
        # 2) linha nas duas tabelas
        fonte = None
        for lab, (tgt, rs, uids) in tables.items():
            for r in rs:
                if r["api_token"] == token:
                    fonte = fonte or r
        for lab, (tgt, rs, uids) in tables.items():
            if any(r["api_token"] == token for r in rs):
                continue
            base = fonte or {"label": name, "tipo": "pessoal", "assign_strategy": "manual",
                             "phone_number": "", "usuario_id": "", "organizacao_id": org}
            uid = base["usuario_id"] if base["usuario_id"] in uids else ""
            psql(tgt, """
              insert into whatsapp_sessao (organizacao_id, usuario_id, session_name, label, is_default, api_token,
                                           tipo, assign_strategy, status, phone_number, updated_at)
              values (:'org'::uuid, nullif(:'uid','')::uuid, :'sn', :'lb', false, :'tk', :'tp', nullif(:'as',''),
                      :'st', nullif(:'ph',''), now())
            """, {"org": base.get("organizacao_id") or org, "uid": uid, "sn": name,
                  "lb": base.get("label") or name, "tk": token, "tp": base.get("tipo") or "pessoal",
                  "as": base.get("assign_strategy") or "manual",
                  "st": "connected" if connected == "1" else "disconnected",
                  "ph": base.get("phone_number") or ""})
            log(f"sessão '{name}' criada no {lab}")
            alterou += 1
        # 3) status e telefone iguais nos dois
        st = "connected" if connected == "1" else "disconnected"
        phone = re.sub(r"[:@].*$", "", jid) if jid else ""
        for lab, (tgt, rs, uids) in tables.items():
            psql(tgt, """
              update whatsapp_sessao set status = :'st',
                     phone_number = coalesce(nullif(phone_number,''), nullif(:'ph','')),
                     last_connected_at = case when :'st' = 'connected' and status <> 'connected' then now() else last_connected_at end,
                     updated_at = case when status <> :'st' then now() else updated_at end
               where api_token = :'tk' and (status <> :'st' or (coalesce(phone_number,'') = '' and :'ph' <> ''))
            """, {"st": st, "ph": phone, "tk": token})
    if alterou:
        log(f"rodada com {alterou} alteração(ões)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        log(f"ERRO: {e}")
        sys.exit(1)
