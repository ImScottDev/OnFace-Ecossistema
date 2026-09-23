// Components.d.ts — the complete catalog of the 143 component(s) in
// Components.bundle.js. READ THIS FILE BEFORE USING THE BUNDLE: component
// names are derived from Figma layer names (sanitized to PascalCase,
// deduplicated) and may differ from what the design calls them — the
// "figma layer" comment above each interface maps them back.
// After the bundle <script> loads, every component is a window global
// (e.g. window.AccordionContent) and usable directly in JSX.
import * as React from 'react';

// figma layer: "AccordionContent" (node 2179:558)
export interface AccordionContentProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "rtl" | "ltr";
  /** Text content; defaults to "Yes. It adheres to the WAI-ARIA design pattern.". */
  text1?: string;
}

// figma layer: "AccordionItem" (node 2182:521)
export interface AccordionItemProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  divider?: boolean;
  dataState?: "open" | "closed";
}

// figma layer: "AccordionTrigger" (node 1827:3337)
export interface AccordionTriggerProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "focus" | "disabled" | "hover";
  dir?: "rtl" | "ltr";
  /** Text content; defaults to "Is it accessible?". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Alert" (node 1774:1994)
export interface AlertProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "destructive";
  button?: boolean;
  dir?: "ltr" | "rtl";
  icon?: boolean;
  alertDescription?: boolean;
  /** Text content; defaults to "Account updated successfully". */
  text1?: string;
  /** Text content; defaults to "Your profile information has been saved. Changes will be reflected immediately.". */
  text2?: string;
  /** Text content; defaults to "Enable". */
  text3?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "AlertDialogHeader" (node 2192:484)
export interface AlertDialogHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  media?: boolean;
  dir?: "none" | "ltr" | "rtl";
  alertDialogDescription?: boolean;
  /** Text content; defaults to "Share this project?". */
  text1?: string;
  /** Text content; defaults to "Anyone with the link will be able to view and edit this project.". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Alertdialogfooter" (node 2192:908)
export interface AlertdialogfooterProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "none" | "ltr" | "rtl";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Attachment" (node 2376:1343)
export interface AttachmentProps {
  className?: string;
  style?: React.CSSProperties;
  attachmentContent?: boolean;
  attachmentDescription?: boolean;
  dir?: "ltr" | "rtl";
  icon1?: boolean;
  dataOrientation?: "horizontal" | "vertical";
  button?: boolean;
  icon2?: boolean;
  /** Text content; defaults to "Attachment title". */
  text1?: string;
  /** Text content; defaults to "Attachment description". */
  text2?: string;
}

// figma layer: "Attachment Media" (node 2376:1161)
export interface AttachmentMediaProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  size?: "lg" | "md" | "sm";
  state?: "default" | "destructive";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Avatar" (node 1866:432)
export interface AvatarProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  size?: "sm" | "default" | "lg";
  badge?: boolean;
  type?: "avatar badge" | "avatar icon";
  dir?: "ltr" | "rtl" | "none";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Avatar" (node 2197:696)
export interface Avatar3Props {
  className?: string;
  style?: React.CSSProperties;
  size?: "default" | "lg" | "sm";
  type?: "count" | "icon";
  /** Text content; defaults to "+3". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "AvatarBadge" (node 2192:2532)
export interface AvatarBadgeProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "icon" | "status";
  size?: "xs" | "default" | "lg";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "AvatarGroup" (node 2118:11510)
export interface AvatarGroupProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  count?: boolean;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon4?: React.ReactNode;
}

// figma layer: "Badge" (node 1868:495)
export interface BadgeProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "secondary" | "destructive" | "outline" | "ghost";
  leftIcon?: boolean;
  rightIcon?: boolean;
  /** Text content; defaults to "Default". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "BreadcrumbItem" (node 1871:361)
export interface BreadcrumbItemProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  state?: "default" | "hover/active";
  breadcrumbLink?: boolean;
  dir?: "rtl" | "ltr";
  /** Text content; defaults to "Home". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Breadcrumb separator" (node 2198:2610)
export interface BreadcrumbSeparatorProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "chevron-right" | "dot";
}

// figma layer: "Bubble" (node 2377:825)
export interface BubbleProps {
  className?: string;
  style?: React.CSSProperties;
  collapsible?: boolean;
  button?: boolean;
  state?: "destructive" | "muted" | "outline" | "primary" | "secondary" | "tinted";
  /** Text content; defaults to "This is the default primary bubble.". */
  text1?: string;
  /** Text content; defaults to "The accessibility review found two focus \nstates that were visually too subtle in dark \nmode.\n\nI checked the dialog, menu, and drawer \npaths because each one renders focusable \ncontrols inside a layered surface.\n\nThe dialog and drawer are fine. The menu \nneeds the hover and focus tokens split so \nkeyboard focus stays visible when the \npointer is not involved.\n\nI also recommend keeping the change \nin the style file instead of the primitive so \nthe other themes can choose their own focus \ntreatment later.". */
  text2?: string;
}

// figma layer: "Button" (node 1872:3230)
export interface ButtonProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  leftIcon?: boolean;
  size?: "xs" | "sm" | "default" | "lg";
  kbd?: boolean;
  roudness?: "default" | "rounded";
  rightIcon?: boolean;
  state?: "default" | "hover" | "focus" | "disabled";
  /** Text content; defaults to "Button". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon3?: React.ReactNode;
}

// figma layer: "ButtonGroupButton" (node 1882:4083)
export interface ButtonGroupButtonProps {
  className?: string;
  style?: React.CSSProperties;
  leftIcon?: boolean;
  variant?: "outline" | "secondary" | "ghost";
  roundness?: "default" | "rounded";
  rightIcon?: boolean;
  size?: "sm" | "default" | "lg";
  position?: "single" | "left" | "right" | "middle";
  state?: "default" | "hover" | "focus" | "disabled";
  /** Text content; defaults to "Button". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "ButtonGroupIconButton" (node 2201:6503)
export interface ButtonGroupIconButtonProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: "outline" | "secondary" | "ghost";
  roundness?: "default" | "rounded";
  size?: "sm" | "default" | "lg";
  position?: "single" | "left" | "right" | "top" | "bottom";
  state?: "default" | "hover" | "focus" | "disabled";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Buttons" (node 73:3681)
export interface ButtonsProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "destructive" | "icon" | "link" | "loading" | "outline" | "primary" | "with icon" | "secondary" | "size-small" | "size-default" | "size-large" | "rounded" | "button group" | "ghost";
  state?: "default" | "hover" | "loading";
  /** Text content; defaults to "Button". */
  text1?: string;
  /** Text content; defaults to "Report". */
  text2?: string;
  /** Text content; defaults to "Snooze". */
  text3?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "CMDKGroupHeading" (node 1970:1400)
export interface CMDKGroupHeadingProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Suggestions". */
  text1?: string;
}

// figma layer: "Calendar header" (node 2203:2505)
export interface CalendarHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  navigationLeft?: boolean;
  dir?: "ltr" | "rtl";
  navigationRight?: boolean;
  type?: "monthyear" | "year" | "month";
  selector?: boolean;
  /** Text content; defaults to "February". */
  text1?: string;
  /** Text content; defaults to "2026". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon3?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon4?: React.ReactNode;
}

// figma layer: "Card" (node 1936:552)
export interface CardProps {
  className?: string;
  style?: React.CSSProperties;
  layout?: "vertical" | "horizontal";
  /** Text content; defaults to "1". */
  text1?: string;
}

// figma layer: "Card content" (node 1932:3197)
export interface CardContentProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "form" | "paragraph";
  alignment?: "right" | "left";
  /** Text content; defaults to "The card component supports a size prop that can be set to \"sm\" for a more compact appearance.". */
  text1?: string;
}

// figma layer: "Card header" (node 1932:860)
export interface CardHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  button?: boolean;
  type?: "image" | "button" | "badge";
  badge?: boolean;
  dir?: "none" | "ltr" | "rtl" | "middle";
  /** Text content; defaults to "Login to your account". */
  text1?: string;
  /** Text content; defaults to "Enter your email below to login to your account". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "check" (node 35:1604)
export interface CheckProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "outline" | "solid";
}

// figma layer: "Checkbox" (node 1939:2183)
export interface CheckboxProps {
  className?: string;
  style?: React.CSSProperties;
  interaction?: "default" | "focus" | "disabled" | "invalid";
  dataState?: "checked" | "unchecked" | "invalid-checked" | "invalid-unchecked";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Checkbox" (node 1944:482)
export interface Checkbox2Props {
  className?: string;
  style?: React.CSSProperties;
  fieldDescription?: boolean;
  state?: "default" | "disabled" | "invalid";
  dir?: "ltr" | "rtl";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Checkboxes" (node 1186:3885)
export interface CheckboxesProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "button" | "open";
  /** Text content; defaults to "Appearance". */
  text1?: string;
  /** Text content; defaults to "Status Bar". */
  text2?: string;
  /** Text content; defaults to "Activity Bar". */
  text3?: string;
  /** Text content; defaults to "Panel". */
  text4?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Circle" (node 455:365)
export interface CircleProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "Collapsible" (node 2124:440)
export interface CollapsibleProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Header". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "CollapsibleContent" (node 2124:2672)
export interface CollapsibleContentProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  variant?: "key-value" | "title-description";
  /** Text content; defaults to "Label". */
  text1?: string;
  /** Text content; defaults to "Value". */
  text2?: string;
}

// figma layer: "ComboboxChip" (node 1952:1633)
export interface ComboboxChipProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  state?: "default" | "disabled";
  /** Text content; defaults to "Sveltekit". */
  text1?: string;
}

// figma layer: "ComboboxItem" (node 1953:2539)
export interface ComboboxItemProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  state?: "default" | "hover" | "disabled";
  itemDescription?: boolean;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Item title". */
  text1?: string;
  /** Text content; defaults to "Item description". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "ComboboxItem/Default/One/LTR" (node 1953:2538)
export interface ComboboxItemDefaultOneLTRProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  /** Text content; defaults to "Combobox item". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "ComboboxLabel" (node 1970:1343)
export interface ComboboxLabelProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Combobox label". */
  text1?: string;
}

// figma layer: "ComboboxList" (node 1961:1118)
export interface ComboboxListProps {
  className?: string;
  style?: React.CSSProperties;
  scrollButton?: boolean;
  type?: "default" | "seperator" | "search" | "label";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "CommandItem" (node 1970:1232)
export interface CommandItemProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  state?: "default" | "hover";
  commandShortcut?: boolean;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Profile". */
  text1?: string;
  /** Text content; defaults to "⌘P". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Content slot" (node 1952:1689)
export interface ContentSlotProps {
  className?: string;
  style?: React.CSSProperties;
  contentSlot?: "combobox chips" | "input group control";
  flipContent?: boolean;
  /** Text content; defaults to "Placeholder". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Context-menu-label" (node 2128:2308)
export interface ContextMenuLabelProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Back". */
  text1?: string;
}

// figma layer: "Controlled" (node 1196:1000)
export interface ControlledProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "frame 6" | "active";
  /** Text content; defaults to "Enter your one-time password.". */
  text1?: string;
  /** Text content; defaults to "Enter your one-time password.". */
  text2?: string;
}

// figma layer: "Default" (node 1188:5373)
export interface Default3Props {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "active";
  /** Text content; defaults to "Email". */
  text1?: string;
}

// figma layer: "DialogFooter" (node 2136:7033)
export interface DialogFooterProps {
  className?: string;
  style?: React.CSSProperties;
  oneButton?: boolean;
  dir?: "ltr" | "rtl";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Dialog header" (node 2136:6736)
export interface DialogHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  icon?: boolean;
  /** Text content; defaults to "Login to your account". */
  text1?: string;
  /** Text content; defaults to "Enter your email below to login to your account". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "DrawerHeader" (node 2138:1342)
export interface DrawerHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  dir?: "ltr" | "rtl" | "none";
  /** Text content; defaults to "Edit profile". */
  text1?: string;
  /** Text content; defaults to "Make changes to your profile here. Click save when you're done.". */
  text2?: string;
}

// figma layer: "Dropdown" (node 2140:3045)
export interface DropdownProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "default";
}

// figma layer: "Dropdown_menu" (node 1186:3819)
export interface DropdownMenuProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "button" | "open";
  /** Text content; defaults to "My account". */
  text1?: string;
  /** Text content; defaults to "Profile". */
  text2?: string;
  /** Text content; defaults to "⇧⌘P". */
  text3?: string;
  /** Text content; defaults to "Billing". */
  text4?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "DropdownMenuLabel" (node 2140:2971)
export interface DropdownMenuLabelProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Dropdown menu label". */
  text1?: string;
}

// figma layer: "ellipsis-horizontal" (node 42:387)
export interface EllipsisHorizontalProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "outline" | "solid";
}

// figma layer: "Field" (node 2078:3084)
export interface FieldProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "input" | "textarea" | "combobox" | "slider" | "checkbox" | "radio group" | "switch" | "choice card";
  /** Text content; defaults to "Field label". */
  text1?: string;
  /** Text content; defaults to "Field description". */
  text2?: string;
  /** Text content; defaults to "Field label". */
  text3?: string;
  /** Text content; defaults to "Field description". */
  text4?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "FieldDescription" (node 1930:445)
export interface FieldDescriptionProps {
  className?: string;
  style?: React.CSSProperties;
  alignment?: "left" | "right";
  /** Text content; defaults to "Field description". */
  text1?: string;
}

// figma layer: "FieldLabel" (node 1928:3999)
export interface FieldLabelProps {
  className?: string;
  style?: React.CSSProperties;
  asterisk?: boolean;
  state?: "default" | "destructive" | "disabled";
  badge?: boolean;
  dir?: "ltr" | "rtl";
  action?: boolean;
  /** Text content; defaults to "Field label". */
  text1?: string;
  /** Text content; defaults to "*". */
  text2?: string;
  /** Text content; defaults to "Action". */
  text3?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Form" (node 1188:5402)
export interface FormProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "active";
  /** Text content; defaults to "Username". */
  text1?: string;
  /** Text content; defaults to "This is your public display name.". */
  text2?: string;
}

// figma layer: "HoverCard" (node 2156:1226)
export interface HoverCardProps {
  className?: string;
  style?: React.CSSProperties;
  hoverCardTitle?: boolean;
  hoverCardDescription?: boolean;
  metadata?: boolean;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Hover card title". */
  text1?: string;
  /** Text content; defaults to "Hover card description". */
  text2?: string;
  /** Text content; defaults to "Metadata". */
  text3?: string;
}

// figma layer: "Icon Button" (node 1892:615)
export interface IconButtonProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  size?: "xs" | "sm" | "default" | "lg";
  roundness?: "default" | "rounded";
  state?: "default" | "hover" | "focused" | "disabled";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Input" (node 1928:3990)
export interface InputProps {
  className?: string;
  style?: React.CSSProperties;
  inputGroupAddon?: boolean;
  state?: "default" | "focus/active" | "destructive" | "disabled";
  leftIcon?: boolean;
  inputGroupControl?: boolean;
  text?: "placeholder" | "active";
  placeholder?: boolean;
  roudness?: "default" | "rounded";
  rightIcon?: boolean;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Input group addon". */
  text1?: string;
  /** Text content; defaults to "Input group control". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Input group" (node 1952:1691)
export interface InputGroupProps {
  className?: string;
  style?: React.CSSProperties;
  leftIcon?: boolean;
  state?: "placeholder" | "hover" | "active" | "focus" | "disabled" | "destructive";
  rightIcon?: boolean;
  textAlignment?: "left" | "right";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "InputGroupAddon" (node 2159:1928)
export interface InputGroupAddonProps {
  className?: string;
  style?: React.CSSProperties;
  text?: boolean;
  leftButton?: boolean;
  rightButton?: boolean;
  leftKbd?: boolean;
  leftIcon1?: boolean;
  dir?: "ltr" | "rtl";
  rightKbd?: boolean;
  leftIcon2?: boolean;
  rightIcon2?: boolean;
  comboboxChip?: boolean;
  rightIcon1?: boolean;
  /** Text content; defaults to "Input group addon". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon3?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon4?: React.ReactNode;
}

// figma layer: "InputGroupControl" (node 2261:2396)
export interface InputGroupControlProps {
  className?: string;
  style?: React.CSSProperties;
  text?: boolean;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Input group control". */
  text1?: string;
}

// figma layer: "Input_OPT" (node 1196:933)
export interface InputOPTProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "active";
  /** Text content; defaults to "1". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Item" (node 2118:8884)
export interface ItemProps {
  className?: string;
  style?: React.CSSProperties;
  itemDescription1?: boolean;
  avatar?: boolean;
  type?: "default" | "outline" | "muted";
  itemDescription2?: boolean;
  button?: boolean;
  image?: boolean;
  state?: "default" | "hover";
  rightIcon?: boolean;
  dir?: "ltr" | "rtl";
  leftIcon?: boolean;
  size?: "default" | "extra small";
  /** Text content; defaults to "Item title". */
  text1?: string;
  /** Text content; defaults to "Item description". */
  text2?: string;
  /** Text content; defaults to "Item description". */
  text3?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon3?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon4?: React.ReactNode;
}

// figma layer: "Kbd" (node 1986:1863)
export interface KbdProps {
  className?: string;
  style?: React.CSSProperties;
  /** Text content; defaults to "⇧". */
  text1?: string;
}

// figma layer: "LeadingVisual" (node 2022:205)
export interface LeadingVisualProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "icon" | "avatar";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Linkedn" (node 846:5078)
export interface LinkednProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "hover";
  /** Text content; defaults to "linkedin". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "lucide/arrow-left" (node 128:172)
export interface LucideArrowLeftProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/arrow-up" (node 128:206)
export interface LucideArrowUpProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/arrow-up-right" (node 128:198)
export interface LucideArrowUpRightProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/badge-check" (node 128:234)
export interface LucideBadgeCheckProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/badge-plus" (node 128:252)
export interface LucideBadgePlusProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/bluetooth" (node 128:368)
export interface LucideBluetoothProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/book-open" (node 128:408)
export interface LucideBookOpenProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/bot" (node 128:442)
export interface LucideBotProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/check" (node 128:576)
export interface LucideCheckProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/chevron-down" (node 128:582)
export interface LucideChevronDownProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/chevron-left" (node 128:588)
export interface LucideChevronLeftProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/chevron-right" (node 128:590)
export interface LucideChevronRightProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/chevron-up" (node 128:592)
export interface LucideChevronUpProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/chevrons-up-down" (node 128:606)
export interface LucideChevronsUpDownProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/circle-check" (node 128:638)
export interface LucideCircleCheckProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/circle-fading-plus" (node 128:662)
export interface LucideCircleFadingPlusProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/ellipsis" (node 128:998)
export interface LucideEllipsisProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/file-text" (node 128:1124)
export interface LucideFileTextProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/frame" (node 128:1272)
export interface LucideFrameProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/gallery-vertical-end" (node 128:1288)
export interface LucideGalleryVerticalEndProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/git-compare" (node 128:1318)
export interface LucideGitCompareProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/globe" (node 128:1348)
export interface LucideGlobeProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/info" (node 128:1488)
export interface LucideInfoProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/loader-circle" (node 128:1622)
export interface LucideLoaderCircleProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/map" (node 128:1680)
export interface LucideMapProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/minus" (node 128:1776)
export interface LucideMinusProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/pie-chart" (node 128:2026)
export interface LucidePieChartProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/plus" (node 128:2064)
export interface LucidePlusProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/settings-2" (node 128:2304)
export interface LucideSettings2Props {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/terminal" (node 128:2658)
export interface LucideTerminalProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/user-round" (node 128:2830)
export interface LucideUserRoundProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "lucide/x" (node 128:2934)
export interface LucideXProps {
  className?: string;
  style?: React.CSSProperties;
}

// figma layer: "MenuButton" (node 2023:271)
export interface MenuButtonProps {
  className?: string;
  style?: React.CSSProperties;
  menuIcon?: boolean;
  rightTriggerIcon?: boolean;
  menuButton?: boolean;
  leftTriggerIcon?: boolean;
  badge?: boolean;
  state?: "default" | "hover" | "focus" | "disabled";
  checkbox?: boolean;
  /** Text content; defaults to "Playground". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon3?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon4?: React.ReactNode;
}

// figma layer: "MenuItem" (node 2140:3026)
export interface MenuItemProps {
  className?: string;
  style?: React.CSSProperties;
  leftIcon?: boolean;
  state?: "default" | "hover" | "disabled";
  rightIcon?: boolean;
  dir?: "ltr" | "rtl";
  shortcut?: boolean;
  /** Text content; defaults to "Menuitem". */
  text1?: string;
  /** Text content; defaults to "⌘+T". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "MenubarGroup" (node 2162:829)
export interface MenubarGroupProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "default";
}

// figma layer: "MenubarItem" (node 2162:786)
export interface MenubarItemProps {
  className?: string;
  style?: React.CSSProperties;
  leftIcon?: boolean;
  state?: "default" | "hover" | "disabled";
  rightIcon?: boolean;
  dir?: "ltr" | "rtl";
  shortcut?: boolean;
  /** Text content; defaults to "Menubar Item". */
  text1?: string;
  /** Text content; defaults to "⌘+T". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Menuitem" (node 2127:1965)
export interface MenuitemProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: "default" | "hover";
  leftIcon?: boolean;
  state?: "default" | "disabled" | "destructive";
  kbd?: boolean;
  rightIcon?: boolean;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Label". */
  text1?: string;
  /** Text content; defaults to "⌘L". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Message footer" (node 2394:2053)
export interface MessageFooterProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  type?: "text" | "actions";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon3?: React.ReactNode;
}

// figma layer: "NativeSelect" (node 2172:937)
export interface NativeSelectProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "focus" | "disabled" | "destructive";
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Native Select". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "NativeSelectLabel" (node 2171:3408)
export interface NativeSelectLabelProps {
  className?: string;
  style?: React.CSSProperties;
  textAlignment?: "left" | "right";
  /** Text content; defaults to "Native Select label". */
  text1?: string;
}

// figma layer: "NativeSelectOption" (node 2172:728)
export interface NativeSelectOptionProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  textAlignment?: "right" | "left";
  /** Text content; defaults to "Native select option". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Navigation menu" (node 76:8793)
export interface NavigationMenuProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "hover";
  /** Text content; defaults to "Getting Started". */
  text1?: string;
  /** Text content; defaults to "Components". */
  text2?: string;
  /** Text content; defaults to "Documentation". */
  text3?: string;
  /** Text content; defaults to "Alert Dialog". */
  text4?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "NavigationMenuItem" (node 2111:6527)
export interface NavigationMenuItemProps {
  className?: string;
  style?: React.CSSProperties;
  itemContent?: boolean;
  state?: "default" | "hover";
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Menu item trigger". */
  text1?: string;
  /** Text content; defaults to "Menu item content". */
  text2?: string;
}

// figma layer: "Pattern" (node 1196:956)
export interface PatternProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "active";
  /** Text content; defaults to "1". */
  text1?: string;
}

// figma layer: "PopoverHeader" (node 2174:552)
export interface PopoverHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  popoverHeader?: boolean;
  dir?: "ltr" | "rtl";
  popoverDescription?: boolean;
  /** Text content; defaults to "Dimensions". */
  text1?: string;
  /** Text content; defaults to "Set the dimensions for the layer.". */
  text2?: string;
}

// figma layer: "Questionnaire choice" (node 2486:1542)
export interface QuestionnaireChoiceProps {
  className?: string;
  style?: React.CSSProperties;
  dataShortcut?: boolean;
  state?: "default" | "hover" | "data checked";
  choiceLabel?: boolean;
  choiceDescription?: boolean;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Questionnaire choice label". */
  text1?: string;
  /** Text content; defaults to "Questionnaire choice label". */
  text2?: string;
  /** Text content; defaults to "A". */
  text3?: string;
}

// figma layer: "Radio" (node 2064:573)
export interface RadioProps {
  className?: string;
  style?: React.CSSProperties;
  interaction?: "default" | "focus" | "disabled" | "error" | "error disabled";
  dataState?: "unchecked" | "invalid-checked" | "checked" | "invalid-unchecked";
}

// figma layer: "Radio_group" (node 1186:3909)
export interface RadioGroupProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "button" | "open";
  /** Text content; defaults to "Panel Position". */
  text1?: string;
  /** Text content; defaults to "Top". */
  text2?: string;
  /** Text content; defaults to "Bottom". */
  text3?: string;
  /** Text content; defaults to "Right". */
  text4?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "RadioGroup" (node 2066:286)
export interface RadioGroup2Props {
  className?: string;
  style?: React.CSSProperties;
  fieldDescription?: boolean;
  state?: "default" | "invalid" | "disabled";
  leftRadio?: boolean;
  dir?: "ltr" | "rtl";
  rightRadio?: boolean;
  /** Text content; defaults to "Field description". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Scrollbar" (node 2070:219)
export interface ScrollbarProps {
  className?: string;
  style?: React.CSSProperties;
  orientation?: "horizontal" | "vertical" | "orientation3";
}

// figma layer: "SelectValue" (node 2058:1106)
export interface SelectValueProps {
  className?: string;
  style?: React.CSSProperties;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Select value". */
  text1?: string;
}

// figma layer: "Separator" (node 1196:973)
export interface SeparatorProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "active";
  /** Text content; defaults to "1". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Seperator" (node 2056:1084)
export interface SeperatorProps {
  className?: string;
  style?: React.CSSProperties;
  direction?: "horizontal" | "vertical";
}

// figma layer: "SheetHeader" (node 2055:1040)
export interface SheetHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  dir?: "ltr" | "rtl";
  /** Text content; defaults to "Edit profile". */
  text1?: string;
  /** Text content; defaults to "Make changes to your profile here. Click save when you're done.". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Sidebar" (node 616:3399)
export interface SidebarProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "closed" | "open";
  /** Text content; defaults to "Acme Inc". */
  text1?: string;
  /** Text content; defaults to "Enterprise". */
  text2?: string;
  /** Text content; defaults to "Platform". */
  text3?: string;
  /** Text content; defaults to "Playground". */
  text4?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon3?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon4?: React.ReactNode;
}

// figma layer: "SidebarGroupLabel" (node 2026:283)
export interface SidebarGroupLabelProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  state?: "default" | "focus";
  /** Text content; defaults to "Platform". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "SidebarHeader" (node 2018:365)
export interface SidebarHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  collapsed?: boolean;
  subtext?: boolean;
  state?: "default" | "hover";
  /** Text content; defaults to "Acme Inc". */
  text1?: string;
  /** Text content; defaults to "Enterprise". */
  text2?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "SidebarMenuSubButton" (node 2026:300)
export interface SidebarMenuSubButtonProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "hover" | "focus" | "disabled";
  /** Text content; defaults to "History". */
  text1?: string;
}

// figma layer: "Skeleton" (node 2015:1045)
export interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  skeleton?: "avatar" | "text" | "card";
}

// figma layer: "SliderRange" (node 2015:434)
export interface SliderRangeProps {
  className?: string;
  style?: React.CSSProperties;
  orientation?: "vertical" | "horizontal";
}

// figma layer: "SliderThumb" (node 2013:282)
export interface SliderThumbProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "hover/focus";
}

// figma layer: "SliderTrack" (node 2015:429)
export interface SliderTrackProps {
  className?: string;
  style?: React.CSSProperties;
  orientation?: "horizontal" | "vertical";
}

// figma layer: "Social Icons" (node 846:4912)
export interface SocialIconsProps {
  className?: string;
  style?: React.CSSProperties;
  platform?: "apple" | "clubhouse" | "discord" | "dribbble" | "facebook" | "figma" | "github" | "google" | "instagram" | "linkedin" | "medium" | "pinterest" | "reddit" | "signal" | "snapchat" | "spotify" | "telegram" | "tiktok" | "tumblr" | "twitch" | "vk" | "youtube" | "x (twitter)" | "threads" | "whatsapp" | "messenger";
  color?: "negative" | "original";
}

// figma layer: "Spinner" (node 2009:425)
export interface SpinnerProps {
  className?: string;
  style?: React.CSSProperties;
  size?: "size-3" | "size-4" | "size-5" | "size-6";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Switch" (node 76:10618)
export interface SwitchProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "off" | "on";
  /** Text content; defaults to "Airplane mode". */
  text1?: string;
}

// figma layer: "Switch" (node 2004:1928)
export interface Switch2Props {
  className?: string;
  style?: React.CSSProperties;
  size?: "default" | "sm";
  state?: "default" | "focus" | "disabled" | "destructive";
  dataState?: "unchecked" | "checked";
}

// figma layer: "Tab" (node 2003:2319)
export interface TabProps {
  className?: string;
  style?: React.CSSProperties;
  icon?: boolean;
  variant?: "default" | "underline";
  badge?: boolean;
  selected?: "on" | "off";
  dir?: "ltr" | "rtl";
  state?: "default" | "hover" | "focus" | "disabled";
  /** Text content; defaults to "Tab". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Table cell" (node 1945:4087)
export interface TableCellProps {
  className?: string;
  style?: React.CSSProperties;
  checkbox?: boolean;
  button?: boolean;
  dir?: "ltr" | "rtl";
  input?: boolean;
  state?: "default" | "hover";
  badge?: boolean;
  text?: boolean;
  /** Text content; defaults to "Table cell". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon3?: React.ReactNode;
}

// figma layer: "Table head" (node 1945:4070)
export interface TableHeadProps {
  className?: string;
  style?: React.CSSProperties;
  text?: boolean;
  button?: boolean;
  checkbox?: boolean;
  dir?: "ltr" | "rtl";
  state?: "default" | "hover";
  /** Text content; defaults to "Table head". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Textarea" (node 1980:1247)
export interface TextareaProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "active" | "placeholder";
  textAlignment?: "left" | "right";
  /** Text content; defaults to "Textarea". */
  text1?: string;
}

// figma layer: "Textarea" (node 1984:1854)
export interface Textarea2Props {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "focus" | "destructive" | "disabled";
  dir?: "ltr" | "rtl";
}

// figma layer: "Toggle" (node 1988:5238)
export interface ToggleProps {
  className?: string;
  style?: React.CSSProperties;
  leftIcon?: boolean;
  variant?: "outline" | "ghost";
  rightIcon?: boolean;
  size?: "sm" | "default" | "lg";
  position?: "single" | "left" | "right" | "middle";
  state?: "off" | "on/hover" | "focus" | "disabled";
  /** Text content; defaults to "Toggle". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "ToggleIcon" (node 2276:19742)
export interface ToggleIconProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  position?: "single" | "left" | "right" | "top" | "bottom";
  state?: "off" | "on/hover" | "focus" | "disabled";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "Tooltip" (node 1987:1467)
export interface TooltipProps {
  className?: string;
  style?: React.CSSProperties;
  leftKbd?: boolean;
  placement?: "top" | "bottom" | "left" | "right";
  rightKbd?: boolean;
  /** Text content; defaults to "Tooltip". */
  text1?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
  /** Swappable nested instance; defaults to the design's. */
  icon2?: React.ReactNode;
}

// figma layer: "Type" (node 2081:1804)
export interface TypeProps {
  className?: string;
  style?: React.CSSProperties;
  type?: "checkbox" | "radio group" | "switch";
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "With Button" (node 1188:5395)
export interface WithButtonProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "active";
}

// figma layer: "With_label" (node 623:3605)
export interface WithLabelProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "active";
  /** Text content; defaults to "Your message". */
  text1?: string;
  /** Text content; defaults to "Type your message here.". */
  text2?: string;
}

// figma layer: "Wrapper" (node 308:76)
export interface WrapperProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "hover" | "default" | "open";
  /** Text content; defaults to "Product Information". */
  text1?: string;
  /** Text content; defaults to "Our flagship product combines cutting-edge technology with sleek design. Built with premium materials, it offers unparalleled performance and reliability.". */
  text2?: string;
  /** Text content; defaults to "Key features include advanced processing capabilities, and an intuitive user interface designed for both beginners and experts.". */
  text3?: string;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}

// figma layer: "X" (node 846:4882)
export interface XProps {
  className?: string;
  style?: React.CSSProperties;
  state?: "default" | "hover";
  /** Text content; defaults to "twitter". */
  text1?: string;
}

declare const AccordionContent: React.FC<AccordionContentProps>;
declare const AccordionItem: React.FC<AccordionItemProps>;
declare const AccordionTrigger: React.FC<AccordionTriggerProps>;
declare const Alert: React.FC<AlertProps>;
declare const AlertDialogHeader: React.FC<AlertDialogHeaderProps>;
declare const Alertdialogfooter: React.FC<AlertdialogfooterProps>;
declare const Attachment: React.FC<AttachmentProps>;
declare const AttachmentMedia: React.FC<AttachmentMediaProps>;
declare const Avatar: React.FC<AvatarProps>;
declare const Avatar3: React.FC<Avatar3Props>;
declare const AvatarBadge: React.FC<AvatarBadgeProps>;
declare const AvatarGroup: React.FC<AvatarGroupProps>;
declare const Badge: React.FC<BadgeProps>;
declare const BreadcrumbItem: React.FC<BreadcrumbItemProps>;
declare const BreadcrumbSeparator: React.FC<BreadcrumbSeparatorProps>;
declare const Bubble: React.FC<BubbleProps>;
declare const Button: React.FC<ButtonProps>;
declare const ButtonGroupButton: React.FC<ButtonGroupButtonProps>;
declare const ButtonGroupIconButton: React.FC<ButtonGroupIconButtonProps>;
declare const Buttons: React.FC<ButtonsProps>;
declare const CMDKGroupHeading: React.FC<CMDKGroupHeadingProps>;
declare const CalendarHeader: React.FC<CalendarHeaderProps>;
declare const Card: React.FC<CardProps>;
declare const CardContent: React.FC<CardContentProps>;
declare const CardHeader: React.FC<CardHeaderProps>;
declare const Check: React.FC<CheckProps>;
declare const Checkbox: React.FC<CheckboxProps>;
declare const Checkbox2: React.FC<Checkbox2Props>;
declare const Checkboxes: React.FC<CheckboxesProps>;
declare const Circle: React.FC<CircleProps>;
declare const Collapsible: React.FC<CollapsibleProps>;
declare const CollapsibleContent: React.FC<CollapsibleContentProps>;
declare const ComboboxChip: React.FC<ComboboxChipProps>;
declare const ComboboxItem: React.FC<ComboboxItemProps>;
declare const ComboboxItemDefaultOneLTR: React.FC<ComboboxItemDefaultOneLTRProps>;
declare const ComboboxLabel: React.FC<ComboboxLabelProps>;
declare const ComboboxList: React.FC<ComboboxListProps>;
declare const CommandItem: React.FC<CommandItemProps>;
declare const ContentSlot: React.FC<ContentSlotProps>;
declare const ContextMenuLabel: React.FC<ContextMenuLabelProps>;
declare const Controlled: React.FC<ControlledProps>;
declare const Default3: React.FC<Default3Props>;
declare const DialogFooter: React.FC<DialogFooterProps>;
declare const DialogHeader: React.FC<DialogHeaderProps>;
declare const DrawerHeader: React.FC<DrawerHeaderProps>;
declare const Dropdown: React.FC<DropdownProps>;
declare const DropdownMenu: React.FC<DropdownMenuProps>;
declare const DropdownMenuLabel: React.FC<DropdownMenuLabelProps>;
declare const EllipsisHorizontal: React.FC<EllipsisHorizontalProps>;
declare const Field: React.FC<FieldProps>;
declare const FieldDescription: React.FC<FieldDescriptionProps>;
declare const FieldLabel: React.FC<FieldLabelProps>;
declare const Form: React.FC<FormProps>;
declare const HoverCard: React.FC<HoverCardProps>;
declare const IconButton: React.FC<IconButtonProps>;
declare const Input: React.FC<InputProps>;
declare const InputGroup: React.FC<InputGroupProps>;
declare const InputGroupAddon: React.FC<InputGroupAddonProps>;
declare const InputGroupControl: React.FC<InputGroupControlProps>;
declare const InputOPT: React.FC<InputOPTProps>;
declare const Item: React.FC<ItemProps>;
declare const Kbd: React.FC<KbdProps>;
declare const LeadingVisual: React.FC<LeadingVisualProps>;
declare const Linkedn: React.FC<LinkednProps>;
declare const LucideArrowLeft: React.FC<LucideArrowLeftProps>;
declare const LucideArrowUp: React.FC<LucideArrowUpProps>;
declare const LucideArrowUpRight: React.FC<LucideArrowUpRightProps>;
declare const LucideBadgeCheck: React.FC<LucideBadgeCheckProps>;
declare const LucideBadgePlus: React.FC<LucideBadgePlusProps>;
declare const LucideBluetooth: React.FC<LucideBluetoothProps>;
declare const LucideBookOpen: React.FC<LucideBookOpenProps>;
declare const LucideBot: React.FC<LucideBotProps>;
declare const LucideCheck: React.FC<LucideCheckProps>;
declare const LucideChevronDown: React.FC<LucideChevronDownProps>;
declare const LucideChevronLeft: React.FC<LucideChevronLeftProps>;
declare const LucideChevronRight: React.FC<LucideChevronRightProps>;
declare const LucideChevronUp: React.FC<LucideChevronUpProps>;
declare const LucideChevronsUpDown: React.FC<LucideChevronsUpDownProps>;
declare const LucideCircleCheck: React.FC<LucideCircleCheckProps>;
declare const LucideCircleFadingPlus: React.FC<LucideCircleFadingPlusProps>;
declare const LucideEllipsis: React.FC<LucideEllipsisProps>;
declare const LucideFileText: React.FC<LucideFileTextProps>;
declare const LucideFrame: React.FC<LucideFrameProps>;
declare const LucideGalleryVerticalEnd: React.FC<LucideGalleryVerticalEndProps>;
declare const LucideGitCompare: React.FC<LucideGitCompareProps>;
declare const LucideGlobe: React.FC<LucideGlobeProps>;
declare const LucideInfo: React.FC<LucideInfoProps>;
declare const LucideLoaderCircle: React.FC<LucideLoaderCircleProps>;
declare const LucideMap: React.FC<LucideMapProps>;
declare const LucideMinus: React.FC<LucideMinusProps>;
declare const LucidePieChart: React.FC<LucidePieChartProps>;
declare const LucidePlus: React.FC<LucidePlusProps>;
declare const LucideSettings2: React.FC<LucideSettings2Props>;
declare const LucideTerminal: React.FC<LucideTerminalProps>;
declare const LucideUserRound: React.FC<LucideUserRoundProps>;
declare const LucideX: React.FC<LucideXProps>;
declare const MenuButton: React.FC<MenuButtonProps>;
declare const MenuItem: React.FC<MenuItemProps>;
declare const MenubarGroup: React.FC<MenubarGroupProps>;
declare const MenubarItem: React.FC<MenubarItemProps>;
declare const Menuitem: React.FC<MenuitemProps>;
declare const MessageFooter: React.FC<MessageFooterProps>;
declare const NativeSelect: React.FC<NativeSelectProps>;
declare const NativeSelectLabel: React.FC<NativeSelectLabelProps>;
declare const NativeSelectOption: React.FC<NativeSelectOptionProps>;
declare const NavigationMenu: React.FC<NavigationMenuProps>;
declare const NavigationMenuItem: React.FC<NavigationMenuItemProps>;
declare const Pattern: React.FC<PatternProps>;
declare const PopoverHeader: React.FC<PopoverHeaderProps>;
declare const QuestionnaireChoice: React.FC<QuestionnaireChoiceProps>;
declare const Radio: React.FC<RadioProps>;
declare const RadioGroup: React.FC<RadioGroupProps>;
declare const RadioGroup2: React.FC<RadioGroup2Props>;
declare const Scrollbar: React.FC<ScrollbarProps>;
declare const SelectValue: React.FC<SelectValueProps>;
declare const Separator: React.FC<SeparatorProps>;
declare const Seperator: React.FC<SeperatorProps>;
declare const SheetHeader: React.FC<SheetHeaderProps>;
declare const Sidebar: React.FC<SidebarProps>;
declare const SidebarGroupLabel: React.FC<SidebarGroupLabelProps>;
declare const SidebarHeader: React.FC<SidebarHeaderProps>;
declare const SidebarMenuSubButton: React.FC<SidebarMenuSubButtonProps>;
declare const Skeleton: React.FC<SkeletonProps>;
declare const SliderRange: React.FC<SliderRangeProps>;
declare const SliderThumb: React.FC<SliderThumbProps>;
declare const SliderTrack: React.FC<SliderTrackProps>;
declare const SocialIcons: React.FC<SocialIconsProps>;
declare const Spinner: React.FC<SpinnerProps>;
declare const Switch: React.FC<SwitchProps>;
declare const Switch2: React.FC<Switch2Props>;
declare const Tab: React.FC<TabProps>;
declare const TableCell: React.FC<TableCellProps>;
declare const TableHead: React.FC<TableHeadProps>;
declare const Textarea: React.FC<TextareaProps>;
declare const Textarea2: React.FC<Textarea2Props>;
declare const Toggle: React.FC<ToggleProps>;
declare const ToggleIcon: React.FC<ToggleIconProps>;
declare const Tooltip: React.FC<TooltipProps>;
declare const Type: React.FC<TypeProps>;
declare const WithButton: React.FC<WithButtonProps>;
declare const WithLabel: React.FC<WithLabelProps>;
declare const Wrapper: React.FC<WrapperProps>;
declare const X: React.FC<XProps>;
declare global {
  interface Window {
    AccordionContent: React.FC<AccordionContentProps>;
    AccordionItem: React.FC<AccordionItemProps>;
    AccordionTrigger: React.FC<AccordionTriggerProps>;
    Alert: React.FC<AlertProps>;
    AlertDialogHeader: React.FC<AlertDialogHeaderProps>;
    Alertdialogfooter: React.FC<AlertdialogfooterProps>;
    Attachment: React.FC<AttachmentProps>;
    AttachmentMedia: React.FC<AttachmentMediaProps>;
    Avatar: React.FC<AvatarProps>;
    Avatar3: React.FC<Avatar3Props>;
    AvatarBadge: React.FC<AvatarBadgeProps>;
    AvatarGroup: React.FC<AvatarGroupProps>;
    Badge: React.FC<BadgeProps>;
    BreadcrumbItem: React.FC<BreadcrumbItemProps>;
    BreadcrumbSeparator: React.FC<BreadcrumbSeparatorProps>;
    Bubble: React.FC<BubbleProps>;
    Button: React.FC<ButtonProps>;
    ButtonGroupButton: React.FC<ButtonGroupButtonProps>;
    ButtonGroupIconButton: React.FC<ButtonGroupIconButtonProps>;
    Buttons: React.FC<ButtonsProps>;
    CMDKGroupHeading: React.FC<CMDKGroupHeadingProps>;
    CalendarHeader: React.FC<CalendarHeaderProps>;
    Card: React.FC<CardProps>;
    CardContent: React.FC<CardContentProps>;
    CardHeader: React.FC<CardHeaderProps>;
    Check: React.FC<CheckProps>;
    Checkbox: React.FC<CheckboxProps>;
    Checkbox2: React.FC<Checkbox2Props>;
    Checkboxes: React.FC<CheckboxesProps>;
    Circle: React.FC<CircleProps>;
    Collapsible: React.FC<CollapsibleProps>;
    CollapsibleContent: React.FC<CollapsibleContentProps>;
    ComboboxChip: React.FC<ComboboxChipProps>;
    ComboboxItem: React.FC<ComboboxItemProps>;
    ComboboxItemDefaultOneLTR: React.FC<ComboboxItemDefaultOneLTRProps>;
    ComboboxLabel: React.FC<ComboboxLabelProps>;
    ComboboxList: React.FC<ComboboxListProps>;
    CommandItem: React.FC<CommandItemProps>;
    ContentSlot: React.FC<ContentSlotProps>;
    ContextMenuLabel: React.FC<ContextMenuLabelProps>;
    Controlled: React.FC<ControlledProps>;
    Default3: React.FC<Default3Props>;
    DialogFooter: React.FC<DialogFooterProps>;
    DialogHeader: React.FC<DialogHeaderProps>;
    DrawerHeader: React.FC<DrawerHeaderProps>;
    Dropdown: React.FC<DropdownProps>;
    DropdownMenu: React.FC<DropdownMenuProps>;
    DropdownMenuLabel: React.FC<DropdownMenuLabelProps>;
    EllipsisHorizontal: React.FC<EllipsisHorizontalProps>;
    Field: React.FC<FieldProps>;
    FieldDescription: React.FC<FieldDescriptionProps>;
    FieldLabel: React.FC<FieldLabelProps>;
    Form: React.FC<FormProps>;
    HoverCard: React.FC<HoverCardProps>;
    IconButton: React.FC<IconButtonProps>;
    Input: React.FC<InputProps>;
    InputGroup: React.FC<InputGroupProps>;
    InputGroupAddon: React.FC<InputGroupAddonProps>;
    InputGroupControl: React.FC<InputGroupControlProps>;
    InputOPT: React.FC<InputOPTProps>;
    Item: React.FC<ItemProps>;
    Kbd: React.FC<KbdProps>;
    LeadingVisual: React.FC<LeadingVisualProps>;
    Linkedn: React.FC<LinkednProps>;
    LucideArrowLeft: React.FC<LucideArrowLeftProps>;
    LucideArrowUp: React.FC<LucideArrowUpProps>;
    LucideArrowUpRight: React.FC<LucideArrowUpRightProps>;
    LucideBadgeCheck: React.FC<LucideBadgeCheckProps>;
    LucideBadgePlus: React.FC<LucideBadgePlusProps>;
    LucideBluetooth: React.FC<LucideBluetoothProps>;
    LucideBookOpen: React.FC<LucideBookOpenProps>;
    LucideBot: React.FC<LucideBotProps>;
    LucideCheck: React.FC<LucideCheckProps>;
    LucideChevronDown: React.FC<LucideChevronDownProps>;
    LucideChevronLeft: React.FC<LucideChevronLeftProps>;
    LucideChevronRight: React.FC<LucideChevronRightProps>;
    LucideChevronUp: React.FC<LucideChevronUpProps>;
    LucideChevronsUpDown: React.FC<LucideChevronsUpDownProps>;
    LucideCircleCheck: React.FC<LucideCircleCheckProps>;
    LucideCircleFadingPlus: React.FC<LucideCircleFadingPlusProps>;
    LucideEllipsis: React.FC<LucideEllipsisProps>;
    LucideFileText: React.FC<LucideFileTextProps>;
    LucideFrame: React.FC<LucideFrameProps>;
    LucideGalleryVerticalEnd: React.FC<LucideGalleryVerticalEndProps>;
    LucideGitCompare: React.FC<LucideGitCompareProps>;
    LucideGlobe: React.FC<LucideGlobeProps>;
    LucideInfo: React.FC<LucideInfoProps>;
    LucideLoaderCircle: React.FC<LucideLoaderCircleProps>;
    LucideMap: React.FC<LucideMapProps>;
    LucideMinus: React.FC<LucideMinusProps>;
    LucidePieChart: React.FC<LucidePieChartProps>;
    LucidePlus: React.FC<LucidePlusProps>;
    LucideSettings2: React.FC<LucideSettings2Props>;
    LucideTerminal: React.FC<LucideTerminalProps>;
    LucideUserRound: React.FC<LucideUserRoundProps>;
    LucideX: React.FC<LucideXProps>;
    MenuButton: React.FC<MenuButtonProps>;
    MenuItem: React.FC<MenuItemProps>;
    MenubarGroup: React.FC<MenubarGroupProps>;
    MenubarItem: React.FC<MenubarItemProps>;
    Menuitem: React.FC<MenuitemProps>;
    MessageFooter: React.FC<MessageFooterProps>;
    NativeSelect: React.FC<NativeSelectProps>;
    NativeSelectLabel: React.FC<NativeSelectLabelProps>;
    NativeSelectOption: React.FC<NativeSelectOptionProps>;
    NavigationMenu: React.FC<NavigationMenuProps>;
    NavigationMenuItem: React.FC<NavigationMenuItemProps>;
    Pattern: React.FC<PatternProps>;
    PopoverHeader: React.FC<PopoverHeaderProps>;
    QuestionnaireChoice: React.FC<QuestionnaireChoiceProps>;
    Radio: React.FC<RadioProps>;
    RadioGroup: React.FC<RadioGroupProps>;
    RadioGroup2: React.FC<RadioGroup2Props>;
    Scrollbar: React.FC<ScrollbarProps>;
    SelectValue: React.FC<SelectValueProps>;
    Separator: React.FC<SeparatorProps>;
    Seperator: React.FC<SeperatorProps>;
    SheetHeader: React.FC<SheetHeaderProps>;
    Sidebar: React.FC<SidebarProps>;
    SidebarGroupLabel: React.FC<SidebarGroupLabelProps>;
    SidebarHeader: React.FC<SidebarHeaderProps>;
    SidebarMenuSubButton: React.FC<SidebarMenuSubButtonProps>;
    Skeleton: React.FC<SkeletonProps>;
    SliderRange: React.FC<SliderRangeProps>;
    SliderThumb: React.FC<SliderThumbProps>;
    SliderTrack: React.FC<SliderTrackProps>;
    SocialIcons: React.FC<SocialIconsProps>;
    Spinner: React.FC<SpinnerProps>;
    Switch: React.FC<SwitchProps>;
    Switch2: React.FC<Switch2Props>;
    Tab: React.FC<TabProps>;
    TableCell: React.FC<TableCellProps>;
    TableHead: React.FC<TableHeadProps>;
    Textarea: React.FC<TextareaProps>;
    Textarea2: React.FC<Textarea2Props>;
    Toggle: React.FC<ToggleProps>;
    ToggleIcon: React.FC<ToggleIconProps>;
    Tooltip: React.FC<TooltipProps>;
    Type: React.FC<TypeProps>;
    WithButton: React.FC<WithButtonProps>;
    WithLabel: React.FC<WithLabelProps>;
    Wrapper: React.FC<WrapperProps>;
    X: React.FC<XProps>;
  }
}
