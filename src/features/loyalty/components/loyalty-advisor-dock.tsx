"use client";

import * as React from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADVISOR_MODEL_LABEL } from "@/features/loyalty/advisor-model";
import {
  MAX_ADVISOR_PROMPTS,
  type AdvisorTurn,
  type PricedProposal,
} from "@/features/loyalty/advisor-agent";
import {
  applyAdvisorProposalAction,
  loyaltyAdvisorTurnAction,
} from "@/features/loyalty/actions";
import { formatCents, formatPoints } from "@/features/loyalty/engine";

/**
 * Floating advisor: a docked chat that opens with "what would you change?",
 * asks the minimum, answers against named chain benchmarks, and can hand
 * back a proposal card the OWNER applies with one click. Hard-capped at
 * MAX_ADVISOR_PROMPTS vendor messages per session — changing a program
 * shouldn't take more, and the manual editor is always one link away.
 */

const OPENERS = [
  "My first reward is too hard to reach",
  "This is costing me too much",
  "Customers aren't coming back",
  "Make mine like a big chain",
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  proposal?: PricedProposal | null;
};

function ProposalCard({
  proposal,
  onApplied,
}: {
  proposal: PricedProposal;
  onApplied: () => void;
}) {
  const [applying, setApplying] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const blocked = proposal.blockedReasons.length > 0;

  async function apply() {
    if (applying || done) return;
    setError(null);
    setApplying(true);
    try {
      const result = await applyAdvisorProposalAction(proposal.proposal);
      if (result.status === "success") {
        setDone(result.message ?? "Applied — your program is updated.");
        onApplied();
      } else {
        setError(result.message ?? "That didn't go through. Try again.");
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand/40 bg-brand/10 p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-brand">
        Proposed change
      </p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-xl font-bold tabular-nums text-brand">
          {proposal.proposal.pointsPerDollar}
        </span>
        <span className="text-xs text-muted-foreground">points per $1</span>
      </p>
      <ul className="mt-1.5 space-y-1">
        {proposal.proposal.rewards.map((reward, i) => (
          <li
            key={`${reward.rewardName}-${i}`}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span>
              {reward.rewardName}
              <span className="text-muted-foreground">
                {" "}
                ·{" "}
                {reward.rewardKind === "FREE_ITEM"
                  ? `free item, ${formatCents(reward.rewardValueCents)} value`
                  : `${formatCents(reward.rewardValueCents)} off`}
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-brand">
              {formatPoints(reward.pointsCost)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">{proposal.benchmark}</p>

      {blocked ? (
        <p className="mt-2 text-xs text-destructive">
          Can&apos;t be applied as-is: {proposal.blockedReasons.join(" ")}
        </p>
      ) : done ? (
        <p className="mt-2 text-xs font-medium text-success">{done}</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={apply} disabled={applying}>
            {applying ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            Apply this change
          </Button>
          <a
            href="#change-rewards"
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            or edit it yourself
          </a>
        </div>
      )}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function LoyaltyAdvisorDock() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const promptsUsed = messages.filter((m) => m.role === "user").length;
  const promptsLeft = Math.max(0, MAX_ADVISOR_PROMPTS - promptsUsed);
  const capped = promptsLeft === 0;

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || capped) return;
    setError(null);
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setDraft("");
    setPending(true);
    try {
      const turns: AdvisorTurn[] = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await loyaltyAdvisorTurnAction(turns);
      if (result.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.text,
            proposal: result.proposal,
          },
        ]);
      } else {
        setError(result.message);
      }
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setMessages([]);
    setError(null);
    setDraft("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 font-medium text-primary-foreground shadow-lg ring-1 ring-brand/30 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Sparkles className="size-5" aria-hidden="true" />
        Advisor
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Loyalty advisor"
      className="fixed bottom-4 right-4 z-50 flex max-h-[min(38rem,calc(100dvh-2rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-brand/30 bg-card shadow-2xl ring-1 ring-brand/20"
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/60 p-4">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-brand" aria-hidden="true" />
            Loyalty advisor
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ADVISOR_MODEL_LABEL} · suggests only — you approve every change
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          aria-label="Close advisor"
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm">What would you change about your program?</p>
            <div className="flex flex-wrap gap-2">
              {OPENERS.map((opener) => (
                <button
                  key={opener}
                  type="button"
                  disabled={pending}
                  onClick={() => void send(opener)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:border-brand"
                >
                  {opener}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, i) => (
            <div key={i} className="space-y-2">
              <div
                className={
                  message.role === "user"
                    ? "ml-8 rounded-xl rounded-br-sm bg-primary/15 p-3 text-sm whitespace-pre-wrap"
                    : "mr-4 rounded-xl rounded-bl-sm bg-muted/70 p-3 text-sm whitespace-pre-wrap"
                }
              >
                {message.content}
              </div>
              {message.proposal ? (
                <ProposalCard
                  proposal={message.proposal}
                  onApplied={() => setError(null)}
                />
              ) : null}
            </div>
          ))
        )}
        {pending ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Thinking…
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {capped && !pending ? (
          <div className="rounded-lg bg-muted/70 p-3 text-xs text-muted-foreground">
            That&apos;s the {MAX_ADVISOR_PROMPTS}-prompt limit for one session.
            <span className="mt-1.5 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="font-medium text-brand underline underline-offset-2"
              >
                Start over
              </button>
              <a
                href="#change-rewards"
                className="underline underline-offset-2"
                onClick={() => setOpen(false)}
              >
                Edit it yourself
              </a>
            </span>
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-border/60 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              capped ? "Session limit reached" : "e.g. Make my reward cheaper"
            }
            disabled={pending || capped}
            aria-label="Message the advisor"
          />
          <Button
            type="submit"
            size="sm"
            className="h-9"
            disabled={pending || capped || !draft.trim()}
            aria-label="Send"
          >
            <Send aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-1.5 text-right text-xs text-muted-foreground">
          {promptsLeft} of {MAX_ADVISOR_PROMPTS} prompts left
        </p>
      </form>
    </div>
  );
}
