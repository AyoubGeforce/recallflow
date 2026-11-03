"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage("Connexion impossible. Vérifie tes identifiants.");
      setLoading(false);
      return;
    }

    router.push("/courses");
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-md py-16">
      <h1 className="text-4xl font-bold">Connexion</h1>

      <p className="mt-3 text-zinc-400">
        Retrouve tes cours et ta progression.
      </p>

      <form onSubmit={handleLogin} className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block">
            Adresse courriel
          </label>

          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block">
            Mot de passe
          </label>

          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white p-3 font-semibold text-black disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      {errorMessage && (
        <p role="alert" className="mt-5 text-red-400">
          {errorMessage}
        </p>
      )}

      <p className="mt-6 text-zinc-400">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="text-white underline">
          Créer un compte
        </Link>
      </p>
    </section>
  );
}