import { Lista } from "./Lista";
import { CONTATOS_AMOSTRA } from "./dados";

/**
 * Contatos & Empresas.
 *
 * Arquétipo de LISTA, que cobre ~15 das 79 rotas do produto. Escrita seguindo a
 * skill oficial do shadcn: cor só por token semântico, `className` só para
 * layout, nenhum CSS próprio, e cada peça vinda da biblioteca (Table, Badge,
 * Avatar, Checkbox, InputGroup, ToggleGroup, DropdownMenu, Empty, Sheet).
 *
 * A página é Server Component e só entrega os dados; a interação vive na
 * `Lista`, que é client. Integrar = trocar a constante por consulta.
 */
export default function ContatosEstudio() {
  return <Lista contatos={CONTATOS_AMOSTRA} />;
}
