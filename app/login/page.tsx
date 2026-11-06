import LoginForm from "@/components/LoginForm";
import { Suspense } from "react";
export const instant = false;
export default function LoginPage() { return <Suspense fallback={<p className="mx-auto max-w-md py-16 text-zinc-400">Chargement...</p>}><LoginForm /></Suspense>; }
