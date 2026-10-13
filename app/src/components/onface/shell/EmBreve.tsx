import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

/** Estado honesto de uma área que ainda não está pronta para o time. */
export function EmBreve({ titulo }: { titulo: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <Badge variant="secondary">Em breve</Badge>
        <EmptyTitle>{titulo} ainda não está disponível</EmptyTitle>
        <EmptyDescription>Estamos preparando esta área. Quando ela ficar pronta, aparece aqui e no menu.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
