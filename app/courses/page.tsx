"use client";

import { useState, useSyncExternalStore } from "react";

// Charger les cours depuis le navigateur
function loadCourses(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem("recallflow-courses");

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    if (
      Array.isArray(parsed) &&
      parsed.every((course) => typeof course === "string")
    ) {
      return parsed;
    }
  } catch {
    // Si les données sont invalides, retourner une liste vide.
  }

  return [];
}

// Permet de distinguer le rendu serveur du rendu navigateur
function subscribe() {
  return () => {};
}

function getSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export default function CoursesPage() {
  const isClient = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const [courses, setCourses] = useState<string[]>(loadCourses);
  const [courseName, setCourseName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  // Enregistrer les cours
  function saveCourses(updatedCourses: string[]) {
    setCourses(updatedCourses);

    try {
      localStorage.setItem(
        "recallflow-courses",
        JSON.stringify(updatedCourses)
      );

      setError("");
    } catch {
      setError("Impossible de sauvegarder les cours.");
    }
  }

  // Ajouter un cours
  function addCourse() {
    const name = courseName.trim();

    if (!name) {
      setError("Entre un nom de cours.");
      return;
    }

    // Vérifier si le cours existe déjà
    const exists = courses.some(
      (course) => course.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      setError("Ce cours existe déjà.");
      return;
    }

    saveCourses([...courses, name]);

    setCourseName("");
    setShowForm(false);
  }

  // Supprimer un cours
  function deleteCourse(courseToDelete: string) {
    const confirmed = window.confirm(
      `Veux-tu vraiment supprimer "${courseToDelete}" ?`
    );

    if (!confirmed) return;

    const updatedCourses = courses.filter(
      (course) => course !== courseToDelete
    );

    saveCourses(updatedCourses);
  }

  return (
    <section>
      {/* En-tête */}
      <p className="mb-2 text-sm text-zinc-400">
        Mes cours
      </p>

      <h2 className="text-4xl font-bold">
        Mes cours
      </h2>

      <p className="mt-3 text-zinc-400">
        Organise tes cours et prépare tes révisions.
      </p>

      {/* Bouton d'ajout */}
      <button
        onClick={() => {
          setShowForm(!showForm);
          setError("");
        }}
        className="mt-8 rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-zinc-200"
      >
        + Ajouter un cours
      </button>

      {/* Formulaire */}
      {showForm && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addCourse();
          }}
          className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <h3 className="mb-4 text-xl font-semibold">
            Nouveau cours
          </h3>

          <input
            type="text"
            placeholder="Exemple : Cisco"
            value={courseName}
            onChange={(event) => setCourseName(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-white"
          />

          <button
            type="submit"
            className="mt-4 rounded-lg bg-white px-5 py-3 font-semibold text-black hover:bg-zinc-200"
          >
            Enregistrer
          </button>
        </form>
      )}

      {/* Message d'erreur */}
      {error && (
        <p role="alert" className="mt-4 text-red-400">
          {error}
        </p>
      )}

      {/* Liste des cours */}
      <div className="mt-10">
        <h3 className="mb-5 text-xl font-semibold">
          Mes cours ({isClient ? courses.length : 0})
        </h3>

        {!isClient ? (
          <p className="text-zinc-400">
            Chargement des cours...
          </p>
        ) : courses.length === 0 ? (
          <p className="text-zinc-400">
            Aucun cours ajouté pour le moment.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {courses.map((course) => (
              <div
                key={course}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <h4 className="text-xl font-semibold">
                  {course}
                </h4>

                <p className="mt-3 text-sm text-zinc-400">
                  Prêt pour les révisions
                </p>

                <button
                  onClick={() => deleteCourse(course)}
                  className="mt-5 rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}