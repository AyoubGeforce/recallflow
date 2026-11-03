"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage(
        "Inscription reçue ! Vérifie tes courriels pour confirmer ton compte."
      );
    }

    setLoading(false);
  }

  return (
    <section className="mx-auto max-w-md py-16">
      <h1 className="text-4xl font-bold">Créer un compte</h1>

      <p className="mt-3 text-zinc-400">
        Commence ton parcours avec RecallFlow.
      </p>

      <form onSubmit={handleSignup} className="mt-8 space-y-5">
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
            minLength={8}
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
          {loading ? "Inscription..." : "Créer mon compte"}
        </button>
      </form>

      {message && (
        <p role="status" className="mt-5 text-sm">{message}</p>
      )}

      <p className="mt-6 text-zinc-400">
        Déjà inscrit ?{" "}
        <Link href="/login" className="text-white underline">
          Se connecter
        </Link>
      </p>
    </section>
  );
}