import { Suspense } from "react";
import { connection } from "next/server";
import StudyRoom from "@/components/StudyRoom";
import { requireUser } from "@/lib/supabase/auth";
export const instant = false;
export default function StudyPage() { return <Suspense fallback={<p className="text-slate-400">Préparation de ta révision...</p>}><StudyContent /></Suspense>; }
async function StudyContent() { await connection(); await requireUser(); return <StudyRoom />; }
