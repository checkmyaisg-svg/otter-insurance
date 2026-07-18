/**
 * Placeholder card for detail-page sections not built yet (Policies, Reminders,
 * Message history). Keeps the detail page's shape complete and demoable while
 * signaling clearly that the feature is upcoming. Reusable across sections.
 */
export function ClientSectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3 rounded-md border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
