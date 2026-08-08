/**
 * One numbered question in a long-form intake flow.
 *
 * Questions rendered at the same size, weight, and colour as their hints and
 * field labels never announce themselves as the thing being asked. A numbered
 * display heading gives each one a clear start; the spacing between blocks is
 * what stops a form reading as a wall. Shared by the loyalty advisor and the
 * vendor application so intake feels like one product.
 */
export function FormQuestion({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex gap-3">
        <span
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-sm font-bold tabular-nums text-brand"
          aria-hidden="true"
        >
          {n}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h3>
          {hint ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      <div className="sm:pl-10">{children}</div>
    </section>
  );
}
