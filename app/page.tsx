import StatCard from "@/components/StatCard";

export default function Home() {
  return (
    <section>
      <p className="mb-2 text-sm text-zinc-400">
        Dashboard
      </p>

      <h2 className="text-4xl font-bold">
        Bienvenue sur RecallFlow
      </h2>

      <p className="mt-3 text-zinc-400">
        Transforme ta matière en révisions intelligentes et adaptées à ta maîtrise.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <StatCard title="Cours actifs" value={0} />
        <StatCard title="Notions maîtrisées" value={0} />
        <StatCard title="À retravailler" value={0} />
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h3 className="text-xl font-semibold">
          Commence ta première révision
        </h3>

        <p className="mt-2 text-zinc-400">
          Ajoute un cours et importe ta matière pour commencer.
        </p>

        <button className="mt-6 rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-zinc-200">
          Ajouter un cours
        </button>
      </div>
    </section>
  );
}