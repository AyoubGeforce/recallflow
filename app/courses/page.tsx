export default function CoursesPage() {
    return (
      <section>
        <p className="mb-2 text-sm text-zinc-400">
          Mes cours
        </p>
  
        <h2 className="text-4xl font-bold">
          Mes cours
        </h2>
  
        <p className="mt-3 text-zinc-400">
          Ajoute tes cours et importe ta matière pour commencer à réviser.
        </p>
  
        <button className="mt-8 rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-zinc-200">
          + Ajouter un cours
        </button>
      </section>
    );
  }