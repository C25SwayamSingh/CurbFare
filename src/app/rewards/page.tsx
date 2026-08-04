import { redirect } from "next/navigation";

/**
 * The wallet moved home: the customer dashboard at /customer now shows
 * every card, balance, and checkout code. This route survives for old
 * bookmarks and deep links only.
 */
export default function RewardsPage() {
  redirect("/customer");
}
