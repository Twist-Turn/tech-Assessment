/**
 * Map a role name to a Tailwind class set, so Admin/Manager/Viewer are visually
 * distinct everywhere they appear (badges, lists, hover states).
 */
export function roleClasses(name: string): string {
  const k = name.toLowerCase();
  if (k.includes("admin"))
    return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30";
  if (k.includes("manager"))
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30";
  if (k.includes("viewer"))
    return "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/30";
  return "bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/30";
}
