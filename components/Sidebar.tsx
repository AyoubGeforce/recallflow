import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-zinc-800 p-6">
      <h1 className="mb-10 text-2xl font-bold">
        RecallFlow
      </h1>

      <nav className="flex flex-col gap-3">
        <Link
          href="/"
          className="rounded-lg bg-zinc-800 px-4 py-3"
        >
          Dashboard
        </Link>

        <Link
          href="/courses"
          className="rounded-lg px-4 py-3 hover:bg-zinc-900"
        >
          Mes cours
        </Link>

        <Link
          href="/study"
          className="rounded-lg px-4 py-3 hover:bg-zinc-900"
        >
          Réviser
        </Link>

        <Link
          href="/progress"
          className="rounded-lg px-4 py-3 hover:bg-zinc-900"
        >
          Progression
        </Link>
      </nav>
    </aside>
  );
}