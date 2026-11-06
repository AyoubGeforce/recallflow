import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Panel } from "@/components/ui";
export const instant = false;

export default function Home() {
  return <Suspense fallback={<DashboardFallback />}><DashboardContent /></Suspense>;
}

async function DashboardContent() {
  await connection();
  await requireUser(); const supabase = await createClient(); const now = new Date().toISOString();
  const [courses, chapters, cards, due, activity] = await Promise.all([
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase.from("chapters").select("id", { count: "exact", head: true }),
    supabase.from("flashcards").select("id", { count: "exact", head: true }),
    supabase.from("flashcards").select("id", { count: "exact", head: true }).lte("due_at", now),
    supabase.from("review_responses").select("rating,responded_at").order("responded_at", { ascending: false }).limit(5),
  ]);
  const dueCount = due.count ?? 0;
  return <section className="space-y-8"><header className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><Badge tone="cyan">Ton espace d’apprentissage</Badge><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Réviser avec intention.</h1><p className="mt-3 max-w-xl text-slate-400">Retrouve tes cartes dues, consolide tes cours et avance une session à la fois.</p></div><Link href="/study" className="rounded-xl bg-cyan-300 px-5 py-3 text-center font-bold text-slate-950 transition hover:bg-cyan-200">Réviser aujourd’hui</Link></header><Panel className="overflow-hidden border-cyan-300/20 bg-gradient-to-br from-violet-500/20 via-slate-900 to-cyan-400/10 p-7 sm:p-10"><div className="flex flex-col justify-between gap-8 md:flex-row md:items-center"><div><p className="text-sm font-semibold uppercase tracking-widest text-cyan-200">À faire maintenant</p><p className="mt-3 text-6xl font-bold">{dueCount}</p><p className="mt-2 text-slate-300">carte{dueCount === 1 ? "" : "s"} due{dueCount === 1 ? "" : "s"} aujourd’hui</p></div><Link href="/study" className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-center font-semibold hover:bg-white/15">Ouvrir la session</Link></div></Panel><div className="grid gap-4 sm:grid-cols-3"><Metric label="Cours" value={courses.count ?? 0} href="/courses" /><Metric label="Chapitres" value={chapters.count ?? 0} href="/courses" /><Metric label="Flashcards" value={cards.count ?? 0} href="/courses" /></div><div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]"><Panel className="p-6"><h2 className="text-xl font-bold">Dernière activité</h2>{activity.data?.length ? <ul className="mt-5 divide-y divide-white/10">{activity.data.map((item, index) => <li key={`${item.responded_at}-${index}`} className="flex items-center justify-between py-3 text-sm"><span className="text-slate-300">Carte évaluée : <strong className="text-white">{labelRating(item.rating)}</strong></span><time className="text-slate-500">{new Date(item.responded_at).toLocaleDateString("fr-CA")}</time></li>)}</ul> : <p className="mt-4 text-slate-400">Aucune révision enregistrée. Ta première session apparaîtra ici.</p>}</Panel><Panel className="p-6"><h2 className="text-xl font-bold">Prochaine étape</h2><p className="mt-3 text-slate-400">Organise tes chapitres et transforme tes notes en questions utiles.</p><Link href="/courses" className="mt-5 inline-block text-cyan-300 underline">Gérer mes cours</Link></Panel></div></section>;
}
function DashboardFallback() { return <section className="space-y-8" aria-label="Chargement du tableau de bord"><div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]"/><div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]"/><div className="grid gap-4 sm:grid-cols-3"><div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]"/><div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]"/><div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]"/></div></section>; }
function Metric({ label, value, href }: { label: string; value: number; href: string }) { return <Link href={href} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-violet-300/40"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></Link>; }
function labelRating(rating: string) { return ({ again: "à revoir", hard: "difficile", good: "bien", easy: "facile" } as Record<string, string>)[rating] ?? rating; }
