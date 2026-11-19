import {
  Award,
  Ban,
  Banknote,
  Bath,
  BedDouble,
  BriefcaseBusiness,
  Building,
  Building2,
  Calendar,
  CalendarCheck,
  Car,
  Check,
  CircleHelp,
  Clock,
  Coins,
  CreditCard,
  FileCheck,
  FileText,
  Flame,
  Gift,
  GraduationCap,
  Handshake,
  Heart,
  Hourglass,
  House,
  Info,
  KeyRound,
  Landmark,
  Layers,
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Percent,
  Phone,
  PiggyBank,
  Receipt,
  Ruler,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Tag,
  Target,
  Thermometer,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trees,
  TriangleAlert,
  UserCheck,
  UserRound,
  UserX,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";

/**
 * Kunci ikon label lead, dikelompokkan agar mudah dipilih.
 * Kunci harus sama dengan LEAD_LABEL_ICONS di backend.
 */
export const LEAD_LABEL_ICON_GROUPS: { title: string; icons: Record<string, LucideIcon> }[] = [
  {
    title: "Temperature & prioritas",
    icons: {
      flame: Flame,
      snowflake: Snowflake,
      thermometer: Thermometer,
      sun: Sun,
      zap: Zap,
      star: Star,
      sparkles: Sparkles,
      award: Award,
      target: Target,
      "trending-up": TrendingUp,
      "trending-down": TrendingDown,
    },
  },
  {
    title: "Properti",
    icons: {
      home: House,
      building: Building,
      "building-2": Building2,
      key: KeyRound,
      "map-pin": MapPin,
      ruler: Ruler,
      bed: BedDouble,
      bath: Bath,
      car: Car,
      trees: Trees,
      school: GraduationCap,
      layers: Layers,
    },
  },
  {
    title: "Keuangan & KPR",
    icons: {
      coins: Coins,
      wallet: Wallet,
      banknote: Banknote,
      "credit-card": CreditCard,
      "piggy-bank": PiggyBank,
      percent: Percent,
      receipt: Receipt,
      landmark: Landmark,
      "file-check": FileCheck,
      "file-text": FileText,
    },
  },
  {
    title: "Customer & komunikasi",
    icons: {
      user: UserRound,
      users: Users,
      "user-check": UserCheck,
      "user-x": UserX,
      heart: Heart,
      handshake: Handshake,
      phone: Phone,
      message: MessageCircle,
      mail: Mail,
      briefcase: BriefcaseBusiness,
      gift: Gift,
    },
  },
  {
    title: "Status & waktu",
    icons: {
      clock: Clock,
      hourglass: Hourglass,
      calendar: Calendar,
      "calendar-check": CalendarCheck,
      check: Check,
      "thumbs-up": ThumbsUp,
      "thumbs-down": ThumbsDown,
      "shield-check": ShieldCheck,
      alert: TriangleAlert,
      ban: Ban,
      x: X,
      help: CircleHelp,
      info: Info,
      tag: Tag,
    },
  },
];

export const LEAD_LABEL_ICONS: Record<string, LucideIcon> = Object.assign(
  {},
  ...LEAD_LABEL_ICON_GROUPS.map((group) => group.icons),
);

/** Latar transparan dari warna label, mis. #EF4444 -> #EF44441A. */
export const tint = (color: string, alpha = "1A") => `${color}${alpha}`;

export function LabelIcon({ icon, color, className }: { icon: string; color: string; className?: string }) {
  const Icon = LEAD_LABEL_ICONS[icon] ?? Tag;
  return (
    <span
      className={className ?? "flex size-9 items-center justify-center rounded-lg"}
      style={{ backgroundColor: tint(color), color }}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function LabelBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded-md px-2.5 py-1 text-sm font-medium"
      style={{ backgroundColor: tint(color), color }}
    >
      {name}
    </span>
  );
}
