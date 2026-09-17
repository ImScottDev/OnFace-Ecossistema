export const metadata = { title: "ONFACE — Preview da navegação" };

export default function OnfacePreviewPage() {
  return (
    <main className="onface-preview-canvas">
      <h1 className="onface-preview-title">A navegação passa a trabalhar como o seu time.</h1>
      <p className="onface-preview-copy">Este é um ambiente isolado do novo AppShell ONFACE. Os links do menu apontam para as rotas reais do CRM já existentes; nenhuma tela, API ou regra de negócio foi duplicada para este preview.</p>
      <p className="onface-preview-note">Valide aqui os nomes, agrupamentos e a navegação em desktop e celular. Após a aprovação, o mesmo componente assume o layout oficial das rotas CRM2.</p>
    </main>
  );
}
