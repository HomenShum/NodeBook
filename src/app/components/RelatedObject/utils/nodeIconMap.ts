import * as LucideIcons from "lucide-react";

import { QuickCaptureIcon } from "@/app/components/Icons/QuickCaptureIcon";

// Map string names to Lucide icon components
export const nodeIconMap: Record<string, React.ComponentType<any>> = {
  stream: QuickCaptureIcon,
  hash: LucideIcons.Hash,
  favorites: LucideIcons.Star,
  templates: LucideIcons.Copy,
};
