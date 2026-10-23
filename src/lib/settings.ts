export type SiteSettings = {
  contactEmail: string;
  phone: string;
  address: string;
  footerText: string;
  social: { facebook: string; instagram: string; x: string; linkedin: string; youtube: string; tiktok: string };
  seoTitleTemplate: string;
  seoDescription: string;
  ogImage: string;
  headCode: string;
  blogEnabled: boolean;
  blogTitle: string;
  blogSlug: string;
  postsPerPage: number;
  cookieNotice: boolean;
  cookieText: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  contactEmail: "",
  phone: "",
  address: "",
  footerText: "",
  social: { facebook: "", instagram: "", x: "", linkedin: "", youtube: "", tiktok: "" },
  seoTitleTemplate: "%s | {site}",
  seoDescription: "",
  ogImage: "",
  headCode: "",
  blogEnabled: true,
  blogTitle: "Blog",
  blogSlug: "blog",
  postsPerPage: 9,
  cookieNotice: false,
  cookieText: "Usamos cookies propias y de terceros para mejorar tu experiencia.",
};

export function parseSettings(v: unknown): SiteSettings {
  const o = (v && typeof v === "object" ? v : {}) as Partial<SiteSettings>;
  return { ...DEFAULT_SETTINGS, ...o, social: { ...DEFAULT_SETTINGS.social, ...(o.social ?? {}) } };
}

export const SOCIAL_LABELS: Record<keyof SiteSettings["social"], string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
};
