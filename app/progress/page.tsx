import StatCard from "@/components/StatCard";

export default function ProgressPage() {
  return (
    <section>
      <p className="mb-2 text-sm text-zinc-400">
        Progression
      </p>

      <h2 className="text-4xl font-bold">
        Ta progression
      </h2>

      <p className="mt-3 text-zinc-400">
        Suis l'évolution de ta maîtrise des différentes notions.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <StatCard title="Notions maîtrisées" value={0} />
        <StatCard title="À retravailler" value={0} />
      </div>
    </section>
  );
}