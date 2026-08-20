/**
 * English catalog: the single source of truth for keys. `Messages` is the
 * widened shape of this object, so es.ts and ar.ts fail typecheck if they
 * miss (or invent) a single key. Keep values plain strings; {curly} tokens
 * are interpolated by t().
 */
export const en = {
  common: {
    appName: "Curbfare",
    motto: "Find carts. Earn rewards.",
    forVendors: "For vendors",
    signIn: "Sign in",
    signUp: "Sign up",
    signOut: "Sign out",
    account: "Account",
    back: "Back",
    language: "Language",
  },
  landing: {
    eyebrow: "Food carts, trucks & stands",
    heroTitleLead: "The best food",
    heroTitleAccent: "parks at the curb.",
    beatFind: "Find carts on the live map.",
    beatEarn: "Earn points toward rewards every time you come back.",
    startEarning: "Start earning points",
    exploreMap: "Explore the map",
    myRewards: "My Rewards",
    myDashboard: "My Dashboard",
    hiName: "Hi, {name}",
    vendorsHeading: "Own a food truck or cart?",
    vendorsSub:
      "This half is for you, the owner. Give your regulars a way to find you.",
    createVendorProfile: "Create your vendor profile",
    cardLiveTitle: "Go live in one tap",
    cardLiveBody: "Share today's spot instantly.",
    cardWeekTitle: "Post your week",
    cardWeekBody: "Set it once, they show up.",
    cardPointsTitle: "Points, not punch cards",
    cardPointsBody: "Big-chain loyalty, cart-sized.",
    footerLine: "Curbfare. Street food, found.",
    footerAbout: "About",
    footerPrivacy: "Privacy",
    footerTerms: "Terms",
  },
  vendorsPage: {
    title: "You run the cart. Curbfare brings them back.",
    subtitle:
      "If Swayam emailed you or left a card at your window, this is that. Curbfare is a website, not an app to download: your page, a pin on a live map, and a points program for your regulars, run from one printed QR code.",
    howHeading: "How it works, in three steps",
    step1:
      "We set up your page together. It takes about ten minutes and you are live right away; every business is individually verified after signup.",
    step2:
      "Tape the QR code where customers order. Customers scan it and join free in their phone's browser.",
    step3:
      "When someone buys, you tap in what they spent. Five seconds. That is when they earn points.",
    dealHeading: "The deal",
    deal1:
      "Free for the first 30 founding carts for six months, possibly a full year. After that you see any price before you pay a dollar.",
    deal2: "You choose the rewards and what they cost you.",
    deal3: "No cut of your sales, no touching your cash or how you charge.",
    deal4:
      "No contract. Your business, menu, and customers stay yours, and you can stop anytime.",
    readyHeading: "Ready, or have questions?",
    readySub:
      "The orange button starts your vendor account. Or just reply to Swayam's email and he will set it up with you in person.",
    startCta: "Start your vendor profile",
    openDashboardCta: "Open your dashboard",
    emailCta: "Email swayam@curbfare.app",
    hungryLead: "Not a vendor, just hungry?",
    hungryLink: "Head to the home page",
    hungryTail: "to find carts near you.",
  },
  about: {
    title: "Why Curbfare exists",
    subtitle: "The best food in the city has never had a front door.",
    curbHeading: "The curb came first",
    curbBody:
      "Before the food halls and the delivery apps, there was a cart on a corner. Street vendors are the smallest businesses a city has and some of the sharpest: one person, one window, out in every kind of weather, remembering your order before you finish saying it. New York taught us how much a city can run on that. It is one special city of many that eat this way.",
    loyaltyHeading: "Loyalty went corporate",
    loyaltyBody:
      "The big chains figured out rewards decades ago. Buy ten coffees anywhere in the country and an app remembers every one. Meanwhile the cart that actually knows you has no way to reward you for coming back, and no way to tell you where it will be tomorrow. The most loyal relationships in food were the only ones going unrewarded.",
    builtHeading: "So we built the missing half",
    builtBody:
      "Curbfare is a live map and a points program sized for a cart. A vendor posts their spot in one tap and runs big-chain loyalty from a single printed QR code: no hardware, no tablet, no cut of the sale. Customers find the carts they love while the food is still hot, and earn points at the window like they would anywhere else. The relationship between a cart and its regulars runs in both directions, so the rewards should too.",
    holdHeading: "What we hold ourselves to",
    hold1:
      "A pin only says Live when the vendor says so. We never guess and call it fact.",
    hold2:
      "Vendors keep their brand, their menu, their prices, and their customers. We are the map and the points, nothing more.",
    hold3Lead:
      "We do not sell personal data, and cameras and locations stay on your device. The details are in our",
    hold3Link: "privacy policy",
    closing:
      "Built at the curb in New York by Swayam Singh. Headed to every city that eats outside.",
    questionsLead: "Questions? Email",
  },
  discover: {
    pageTitle: "Find vendors near you",
    yourLocation: "your current location",
    privacyLine:
      "Your location is only used when you ask, only for this search, and never stored.",
    useMyLocation: "Use my current location",
    findingYou: "Finding you…",
    geoUnsupported:
      "Your browser doesn't support location. Search an area below instead.",
    geoDenied:
      "Location permission was denied. No problem, search an area below instead.",
    geoFailed:
      "Couldn't get your location right now. Try again, or search an area below.",
    searchLabel: "Or search an area or a cart",
    searchPlaceholder: "e.g. Astoria, Roosevelt Ave, Birria-Landia",
    areaUnavailable:
      "Area search isn't available right now. Use your current location instead.",
    areaNotFound: "Couldn't find that area. Try a different search.",
    within: "Within",
    miles: "{count} mi",
    mileChipOne: "1 mi",
    ofPlace: "of {place}",
    refresh: "Refresh",
    statusFilterLabel: "Filter by location status",
    filterAll: "All",
    filterLive: "Live now",
    filterScheduled: "Scheduled",
    filterRecurring: "Usually here",
    filterHotspots: "Hotspots",
    nameFilterLabel: "Filter results by name or food",
    nameFilterPlaceholder: "Filter by name or food, e.g. birria",
    showingCount: "Showing {shown} of {total} nearby",
    legendConfirmed: "Confirmed Curbfare vendors, points and all",
    legendPicks: "Curbfare picks: corners we scouted for street food",
    viewLabel: "Results view",
    listView: "List",
    mapView: "Map",
    loadFailed: "Couldn't load nearby vendors. Please try again.",
    looking: "Looking for vendors near you…",
    noMatchTitle: "Nothing nearby matches “{query}”.",
    noMatchBody:
      "{count} spots nearby didn't match. Try another craving, or clear the filter.",
    noMatchBodyOne:
      "1 spot nearby didn't match. Try another craving, or clear the filter.",
    clearFilter: "Clear filter",
    emptyTitle: "No {noun} within {radius} right now.",
    nounVendors: "vendors",
    nounHotspots: "food-vendor hotspots",
    mileOne: "mile",
    mileMany: "miles",
    emptyBody: "Try a larger radius, a different area, or check back later.",
  },
} as const satisfies Record<string, Record<string, string>>;

/** Widened shape (every leaf is `string`) that es/ar must match exactly. */
export type Messages = {
  [N in keyof typeof en]: { [K in keyof (typeof en)[N]]: string };
};
