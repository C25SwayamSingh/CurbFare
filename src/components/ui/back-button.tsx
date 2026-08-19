"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/**
 * A back control that behaves like the browser's Back button: it returns to
 * the page the user actually came from, not a hardcoded parent. Reaching the
 * public unit page from the dashboard and tapping Back must land on the
 * dashboard; reaching it from discovery must land on discovery.
 *
 * `fallback` covers direct arrivals (deep link, bookmark, new tab) where
 * there is no history entry to pop — going "back" would exit the site or do
 * nothing, so we navigate to the page's natural parent instead.
 */
export function BackButton({
  fallback,
  variant = "ghost",
  size = "sm",
  className,
  children,
}: {
  fallback: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  children?: React.ReactNode;
}) {
  const t = useT("common");
  const router = useRouter();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
    >
      <ArrowLeft aria-hidden="true" />
      {children ?? t("back")}
    </Button>
  );
}
