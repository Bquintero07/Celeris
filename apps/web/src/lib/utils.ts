import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
// Standard shadcn helper. Copy shadcn components into src/components/ui.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
