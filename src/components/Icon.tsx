import {
  LayoutTemplate, Heading, Pilcrow, MousePointerClick, SeparatorHorizontal, Image, Columns2, Images, Play,
  BadgeCheck, LayoutGrid, BarChart3, BadgeEuro, CircleHelp, Megaphone, Send, Newspaper, Map, Code, Quote,
  Users, Sparkles, Star, Zap, Shield, Heart, Clock, Phone, Mail, MapPin, Check, Award, Leaf, Truck, Coffee,
  Camera, Briefcase, Smile, Globe, Rocket, Target, Gift, House, Settings, TrendingUp, Lock, Wrench, Palette,
  Calendar, type LucideProps,
} from "lucide-react";

const ICONS = {
  "layout-template": LayoutTemplate, heading: Heading, pilcrow: Pilcrow, "mouse-pointer-click": MousePointerClick,
  "separator-horizontal": SeparatorHorizontal, image: Image, "columns-2": Columns2, images: Images, play: Play,
  "badge-check": BadgeCheck, "layout-grid": LayoutGrid, "bar-chart-3": BarChart3, "badge-euro": BadgeEuro,
  "circle-help": CircleHelp, megaphone: Megaphone, send: Send, newspaper: Newspaper, map: Map, code: Code,
  quote: Quote, users: Users, sparkles: Sparkles, star: Star, zap: Zap, shield: Shield, heart: Heart, clock: Clock,
  phone: Phone, mail: Mail, "map-pin": MapPin, check: Check, award: Award, leaf: Leaf, truck: Truck, coffee: Coffee,
  camera: Camera, briefcase: Briefcase, smile: Smile, globe: Globe, rocket: Rocket, target: Target, gift: Gift,
  home: House, settings: Settings, "trending-up": TrendingUp, lock: Lock, wrench: Wrench, palette: Palette,
  calendar: Calendar,
} as const;

export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const C = ICONS[name as keyof typeof ICONS] ?? Sparkles;
  return <C {...props} />;
}

const SOCIAL_PATHS: Record<string, string> = {
  facebook: "M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.2C16.7 2.1 15.6 2 14.4 2 11.8 2 10 3.6 10 6.5v2H7.3v3.7H10V22h4v-9.8h2.8l.4-3.7H14z",
  instagram: "M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 4.8a5 5 0 100 10 5 5 0 000-10zm0 8.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zm5.2-9.6a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z",
  x: "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.9L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.5l11.2 14.5z",
  linkedin: "M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21h-4V9z",
  youtube: "M23 7.2a3 3 0 00-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 001 7.2 31 31 0 00.5 12a31 31 0 00.5 4.8 3 3 0 002.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 002.1-2.1 31 31 0 00.5-4.8 31 31 0 00-.5-4.8zM9.8 15V9l5.8 3-5.8 3z",
  tiktok: "M16.6 5.8A4.3 4.3 0 0115.5 3h-3.1v12.4a2.6 2.6 0 11-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 105 5.7V9.1a7.4 7.4 0 004.3 1.4V7.4a4.3 4.3 0 01-3.3-1.6z",
};

export function SocialIcon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={SOCIAL_PATHS[name]} />
    </svg>
  );
}
