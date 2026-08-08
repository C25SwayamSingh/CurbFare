"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { applyAdvisorProposalAction } from "@/features/loyalty/actions";
import { formatPoints } from "@/features/loyalty/engine";
import {
  buildChainPresets,
  entryReturnBps,
  recommendFor,
  type ChainModelPreset,
  type Concern,
  type CurrentProgram,
} from "@/features/loyalty/quick-models";

/**
 * The fast path for changing a live program — no AI, no questionnaire.
 * One optional question (what's bugging you), three one-tap chain models
 * with the vendor's OWN rewards repriced by the deterministic engine, and
 * the full editor collapsed underneath for owners who want every dial.
 */

const CONCERNS: { key: Concern; label: string }[] = [
  { key: "too_far", label: "Rewards feel too far away" },
  { key: "too_costly", label: "It's costing me too much" },
];

function pct(bps: number): string {
  return `${(bps / 100).toFixed(1).replace(/\.0$/, "")}%`;
}

/**
 * Each chain's own identity colours for its card band, so an owner recognises
 * the model before reading a word. Tokens rather than hexes — defined in
 * globals.css and scoped to these cards, never reused for Curbfare surfaces.
 */
function chainStyle(company: string): string {
  if (company.startsWith("Starbucks")) {
    return "bg-chain-starbucks text-chain-starbucks-ink";
  }
  if (company.startsWith("Subway")) {
    return "bg-chain-subway text-chain-subway-ink";
  }
  if (company.startsWith("McDonald")) {
    return "bg-chain-mcdonalds text-chain-mcdonalds-ink";
  }
  return "bg-secondary text-secondary-foreground";
}

function PresetCard({
  preset,
  recommended,
}: {
  preset: ChainModelPreset;
  recommended: boolean;
}) {
  const [applying, setApplying] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const blocked = preset.priced.blockedReasons.length > 0;
  const isCurrent = preset.comparison === "current";

  async function apply() {
    if (applying || done) return;
    setError(null);
    setApplying(true);
    try {
      const result = await applyAdvisorProposalAction(preset.priced.proposal);
      if (result.status === "success") {
        setDone(result.message ?? "Applied. Your program is updated.");
      } else {
        setError(result.message ?? "That didn't go through. Try again.");
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-background p-4 transition-all",
        recommended ? "border-primary ring-1 ring-primary/40" : "border-border",
      )}
    >
      {/* The chain's own colours, so an owner recognises the model before
          reading a word. Curbfare's palette resumes below the band. */}
      <div
        className={cn(
          "-mx-4 -mt-4 mb-3 flex items-center justify-between gap-2 rounded-t-2xl px-4 py-2.5",
          chainStyle(preset.chain.company),
        )}
      >
        <p className="text-xs font-bold uppercase tracking-wider">
          {preset.chain.company} model
        </p>
        {recommended ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            Best fix
          </span>
        ) : null}
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums text-brand">
          {pct(preset.chain.returnBps)}
        </span>
        <span className="text-xs text-muted-foreground">back to customers</span>
      </p>
      <p className="text-xs text-muted-foreground">{preset.comparisonLabel}</p>

      <ul className="mt-3 flex-1 space-y-1.5 border-t border-border/60 pt-3">
        {preset.priced.proposal.rewards.map((reward, i) => (
          <li
            key={`${reward.rewardName}-${i}`}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="truncate">{reward.rewardName}</span>
            <span className="shrink-0 font-semibold tabular-nums text-brand">
              {formatPoints(reward.pointsCost)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        {blocked ? (
          <p className="text-xs text-muted-foreground">
            Doesn&apos;t fit your rewards:{" "}
            {preset.priced.blockedReasons.join(" ")}
          </p>
        ) : done ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-success">
            <Check className="size-3.5" aria-hidden="true" />
            {done}
          </p>
        ) : isCurrent ? (
          <p className="text-xs font-medium text-muted-foreground">
            This is you today
          </p>
        ) : (
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={apply}
            disabled={applying}
          >
            {applying ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            Switch to this
          </Button>
        )}
        {error ? (
          <p className="mt-1.5 text-xs text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

export function LoyaltyQuickChange({
  pointsPerDollar,
  catalog,
  children,
}: {
  pointsPerDollar: number;
  catalog: (CurrentProgram["rewards"][number] & { pointsCost: number })[];
  /** The full manual editor, collapsed until the owner asks for it. */
  children: React.ReactNode;
}) {
  const [concern, setConcern] = React.useState<Concern | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const presets = React.useMemo(
    () =>
      buildChainPresets({
        pointsPerDollar,
        rewards: catalog.map((item) => ({
          rewardKind: item.rewardKind,
          rewardName: item.rewardName,
          rewardValueCents: item.rewardValueCents,
          rewardEstCostCents: item.rewardEstCostCents,
        })),
        currentRewards: catalog,
      }),
    [pointsPerDollar, catalog],
  );
  const recommended = concern ? recommendFor(concern, presets) : null;
  const todayBps = React.useMemo(
    () => entryReturnBps(pointsPerDollar, catalog),
    [pointsPerDollar, catalog],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">What&apos;s bugging you?</p>
        {CONCERNS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() =>
              setConcern((current) =>
                current === option.key ? null : option.key,
              )
            }
            aria-pressed={concern === option.key}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
              concern === option.key
                ? "border-secondary bg-secondary font-medium text-secondary-foreground"
                : "border-border text-muted-foreground hover:border-brand",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {todayBps !== null ? (
        <p className="text-sm text-muted-foreground">
          Today your first reward gives customers about{" "}
          <strong className="font-semibold text-foreground">
            {pct(todayBps)} back
          </strong>
          . Each model below moves that number.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {presets.map((preset) => (
          <PresetCard
            key={preset.chain.company}
            preset={preset}
            recommended={recommended === preset.chain.company}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Every model keeps your rewards; only the points prices move. Customers
        keep every point they&apos;ve earned.
      </p>

      <div className="border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={() => setEditorOpen((open) => !open)}
          aria-expanded={editorOpen}
          className="flex items-center gap-1.5 text-sm font-medium text-brand"
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              editorOpen ? "rotate-180" : "",
            )}
            aria-hidden="true"
          />
          {editorOpen ? "Hide the detailed editor" : "Open the detailed editor"}
        </button>
        {editorOpen ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}
