export default function StudyPage() {
    return (
      <section>
        <p className="mb-2 text-sm text-zinc-400">
          Réviser
        </p>
  
        <h2 className="text-4xl font-bold">
          Choisis un mode de révision
        </h2>
  
        <p className="mt-3 text-zinc-400">
          Sélectionne la méthode qui correspond à tes besoins.
        </p>
  
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="text-xl font-semibold">
              Flashcards
            </h3>
  
            <p className="mt-3 text-zinc-400">
              Mémorise les notions importantes de tes cours.
            </p>
          </div>
  
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="text-xl font-semibold">
              Feuille blanche
            </h3>
  
            <p className="mt-3 text-zinc-400">
              Explique une notion avec tes propres mots.
            </p>
          </div>
  
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="text-xl font-semibold">
              Pratique
            </h3>
  
            <p className="mt-3 text-zinc-400">
              Applique tes connaissances avec des exercices.
            </p>
          </div>
        </div>
      </section>
    );
  }