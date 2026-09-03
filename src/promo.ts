export const GUARDIANS_STEAM_URL = "https://store.steampowered.com/app/3025060/THE_GUARDIANS/"
export const CORPOREAL_STEAM_URL = "https://store.steampowered.com/app/3260970/CORPOREAL/"
export const NEUTRON_STEAM_URL = "https://store.steampowered.com/curator/45224131"
export const NEUTRON_SITE_URL = "https://neutrongamestudios.com/"

export type PromoPhase = "prerelease" | "launch" | "support"

export interface PromoState {
  phase: PromoPhase
  title: string
  lead: string
  copy: string
  cta: string
  url: string
  artClass: "guardians-art" | "studio-art"
}

const GUARDIANS_RELEASE = new Date("2026-10-15T00:00:00")
const SUPPORT_SWITCH = new Date("2026-12-01T00:00:00")

export function getPromoState(now = new Date()): PromoState {
  if (now < GUARDIANS_RELEASE) {
    return {
      phase: "prerelease",
      title: "The Guardians",
      lead: "Releases October 15.",
      copy: "Cinematic carrier-based aerial combat from Neutron Studios, the developer of this free recovery tool.",
      cta: "Wishlist on Steam →",
      url: GUARDIANS_STEAM_URL,
      artClass: "guardians-art",
    }
  }

  if (now < SUPPORT_SWITCH) {
    return {
      phase: "launch",
      title: "The Guardians",
      lead: "Available now on Steam.",
      copy: "If iMusicRecovery helped save your old library, checking out our newest game directly supports the developer.",
      cta: "View The Guardians →",
      url: GUARDIANS_STEAM_URL,
      artClass: "guardians-art",
    }
  }

  return {
    phase: "support",
    title: "Support Neutron Studios",
    lead: "iMusicRecovery is free.",
    copy: "If the tool helped you, the simplest way to support continued free tools and indie development is to check out Neutron Studios on Steam.",
    cta: "Support the developer on Steam →",
    url: NEUTRON_STEAM_URL,
    artClass: "studio-art",
  }
}

export function guardiansLaunchCopy(now = new Date()): { text: string; cta: string } {
  if (now < GUARDIANS_RELEASE) return { text: "Releases October 15.", cta: "Wishlist on Steam →" }
  return { text: "Available now on Steam.", cta: "View on Steam →" }
}
