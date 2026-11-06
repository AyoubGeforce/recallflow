import { Suspense } from "react";
import type { ReactNode } from "react";

export default function CourseLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="text-slate-400">Chargement de l’espace de cours...</p>}>{children}</Suspense>;
}
