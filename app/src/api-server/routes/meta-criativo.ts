import { Hono } from "hono";
import { getCtx } from "../compat.js";
import { previaDoAnuncio, credenciaisAds, metaGraphUrl, type PreviaAnuncio } from "@onface/integrations-meta";

/**
 * O criativo do anúncio, para quem atende o lead.
 *
 * A ficha mostrava o `ad_id` de 17 dígitos e um link para fora, e os dois
 * falhavam: o número não diz nada, e o Gerenciador exige acesso à conta de
 * anúncios. Quem não tem, não vê; quem tem cai na última conta que usou —
 * medido em 21/10, um anúncio da conta 1979606826185515 abriu na
 * 867028606744143 listando dois criativos que não eram o dele. Link que mostra
 * o anúncio errado é pior que link que não abre: o errado parece certo.
 *
 * A Graph devolve a prévia RENDERIZADA, num iframe com token próprio que não
 * pede login. O criativo passa a aparecer dentro do ONFACE.
 *
 * Cache em memória porque criativo não muda e a janela é curta: a `previaUrl`
 * e a `thumbnailUrl` que a Meta devolve EXPIRAM, então nada disso vai para o
 * banco — guardar URL vencida daria imagem quebrada daqui a um dia.
 */
const app = new Hono();

const CACHE = new Map<string, { em: number; previa: PreviaAnuncio }>();
const VALIDADE_MS = 10 * 60 * 1000;

app.get("/meta/criativo/:adId", async (c) => {
  // Exige sessão: a prévia é de conta de anúncios da empresa.
  await getCtx(c);
  const adId = c.req.param("adId");
  if (!/^\d{1,30}$/.test(adId)) return c.json({ erro: "id de anúncio inválido" }, 400);

  const guardado = CACHE.get(adId);
  if (guardado && Date.now() - guardado.em < VALIDADE_MS) {
    return c.json({ previa: guardado.previa, deCache: true });
  }

  const cred = credenciaisAds();
  const r = await previaDoAnuncio(adId, cred.accessToken, metaGraphUrl);
  if (!r.ok) {
    // 502, não 500: a falha é da Meta, e a ficha mostra o motivo em vez de
    // um espaço vazio que parece bug do CRM.
    return c.json({ erro: r.erro }, 502);
  }
  CACHE.set(adId, { em: Date.now(), previa: r.previa });
  return c.json({ previa: r.previa, deCache: false });
});

export const metaCriativoRoutes = app;
