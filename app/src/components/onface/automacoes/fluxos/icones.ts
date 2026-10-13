/* Nome lucide do catálogo (grafo.ts `MetaNo.icone`) → componente. Import um a
 * um, não `import * as`, para o bundle levar só estes ícones. */
import {
  AlarmClock, ArrowRightLeft, Bell, Bot, BriefcaseBusiness, CircleStop, CreditCard, Eye, GitBranch, Globe, Hand,
  Hourglass, ListMinus, ListPlus, ListTodo, Mail, MessageCircle, Pause, PenLine, PhoneOutgoing, Sparkles, Split, StickyNote,
  Tag, Tags, UserCheck, Variable, Zap, type LucideIcon,
} from "lucide-react";

const ICONES: Record<string, LucideIcon> = {
  AlarmClock, ArrowRightLeft, Bell, Bot, BriefcaseBusiness, CircleStop, CreditCard, Eye, GitBranch, Globe, Hand,
  Hourglass, ListMinus, ListPlus, ListTodo, Mail, MessageCircle, Pause, PenLine, PhoneOutgoing, Sparkles, Split, StickyNote,
  Tag, Tags, UserCheck, Variable, Zap,
};

export function iconeDe(nome: string): LucideIcon {
  return ICONES[nome] ?? Zap;
}
