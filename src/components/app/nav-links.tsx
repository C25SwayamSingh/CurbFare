"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Header nav that knows where you are.
 *
 * The item for the page you are ON is not a link at all — it renders as a
 * highlighted "you are here" marker. A self-link looks clickable, does
 * nothing when clicked, and gets reported as broken; a marker can't. From
 * every other page the item is a normal, working link.
 */
export function NavLinks({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        if (pathname === item.href) {
          return (
            <span
              key={item.href}
              aria-current="page"
              className="font-semibold text-primary"
            >
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className="transition-colors hover:text-primary"
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
