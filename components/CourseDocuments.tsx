"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Panel } from "@/components/ui";

type Chapter = { id: string; title: string };
type DocumentRow = { id: string; original_name: string; status: string; extraction_error: string | null; warning: string | null; page_count: number | null; extracted_chars: number | null };
type Passage = { id: string; locator_label: string; content: string };
type Proposal = { id: string; question: string; answer: string; evidence: string; is_duplicate: boolean; duplicate_reason: string | null; generation_proposal_sources?: Array<{ passage_id: string; document_passages?: { locator_label: string } | null }> };

export default function CourseDocuments({ courseId, chapters }: { courseId: string; chapters: Chapter[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [selectedPassages, setSelectedPassages] = useState<string[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposals, setSelectedProposals] = useState<string[]>([]);
  const [generationId, setGenerationId] = useState("");
  const [chapterId, setChapterId] = useState(chapters[0]?.id ?? "");
  const [limit, setLimit] = useState<5 | 10 | 20>(5);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/courses/${courseId}/documents`, { cache: "no-store" });
    const body = await response.json().catch(() => null) as { documents?: DocumentRow[]; error?: string } | null;
    if (response.ok) setDocuments(body?.documents ?? []);
    else setError(body?.error ?? "Impossible de charger les documents.");
  }, [courseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function openDocument(document: DocumentRow) {
    setSelected(document);
    setProposals([]);
    setSelectedProposals([]);
    setSelectedPassages([]);
    setError("");
    const response = await fetch(`/api/courses/${courseId}/documents/${document.id}`, { cache: "no-store" });
    const body = await response.json().catch(() => null) as { document?: DocumentRow; passages?: Passage[]; error?: string } | null;
    if (!response.ok) setError(body?.error ?? "Impossible de charger le document.");
    else { setSelected(body?.document ?? document); setPassages(body?.passages ?? []); }
  }

  async function upload(file: File) {
    setBusy(true); setError(""); setSuccess("");
    const form = new FormData(); form.set("file", file);
    const response = await fetch(`/api/courses/${courseId}/documents`, { method: "POST", body: form });
    const body = await response.json().catch(() => null) as { document?: DocumentRow; error?: string } | null;
    if (!response.ok || !body?.document) setError(body?.error ?? "Import impossible.");
    else { await load(); setSuccess("Document importé. Lance son extraction."); await openDocument(body.document); }
    setBusy(false);
  }

  async function extract() {
    if (!selected) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/courses/${courseId}/documents/${selected.id}/extract`, { method: "POST" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) setError(body?.error ?? "Extraction impossible.");
    else { setSuccess("Contenu extrait. Sélectionne les passages utiles."); await load(); await openDocument(selected); }
    setBusy(false);
  }

  async function remove() {
    if (!selected || !window.confirm(`Supprimer « ${selected.original_name} » ? Les cartes enregistrées resteront utilisables, avec une source indiquée comme indisponible.`)) return;
    setBusy(true);
    const response = await fetch(`/api/courses/${courseId}/documents/${selected.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) setError(body?.error ?? "Suppression impossible.");
    else { setSelected(null); setPassages([]); await load(); setSuccess("Document supprimé."); }
    setBusy(false);
  }

  async function generate() {
    if (!selected || !chapterId || !selectedPassages.length) return;
    setBusy(true); setError(""); setSuccess("Ollama prépare les propositions…");
    const response = await fetch("/api/ai/generations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId, documentId: selected.id, chapterId, passageIds: selectedPassages, requestedCount: limit, requestId: crypto.randomUUID() }) });
    const body = await response.json().catch(() => null) as { generationId?: string; error?: string } | null;
    if (!response.ok && response.status !== 202) setError(body?.error ?? "Génération indisponible.");
    else if (body?.generationId) {
      setGenerationId(body.generationId);
      const detail = await fetch(`/api/ai/generations/${body.generationId}`, { cache: "no-store" });
      const detailBody = await detail.json().catch(() => null) as { proposals?: Proposal[]; error?: string } | null;
      if (!detail.ok) setError(detailBody?.error ?? "Impossible de charger les propositions.");
      else {
        const next = detailBody?.proposals ?? [];
        setProposals(next);
        setSelectedProposals(next.filter(proposal => !proposal.is_duplicate).map(proposal => proposal.id));
        setSuccess("Propositions prêtes. Vérifie chaque carte avant enregistrement.");
      }
    }
    setBusy(false);
  }

  async function saveProposals() {
    if (!generationId) { setError("Relance la génération pour obtenir une session enregistrable."); return; }
    const chosen = proposals.filter(proposal => selectedProposals.includes(proposal.id) && !proposal.is_duplicate && proposal.question.trim() && proposal.answer.trim());
    if (!chosen.length) { setError("Sélectionne au moins une proposition valide."); return; }
    setBusy(true);
    const response = await fetch(`/api/ai/generations/${generationId}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposalIds: chosen.map(proposal => proposal.id), requestId: crypto.randomUUID() }) });
    const body = await response.json().catch(() => null) as { error?: string; insertedCount?: number; skippedCount?: number } | null;
    if (!response.ok) setError(body?.error ?? "Enregistrement impossible.");
    else setSuccess(`${body?.insertedCount ?? 0} carte(s) enregistrée(s), ${body?.skippedCount ?? 0} doublon(s) ignoré(s).`);
    setBusy(false);
  }

  function receiveFiles(files: FileList | File[]) {
    const file = Array.from(files)[0];
    if (file) void upload(file);
  }

  const allPassagesSelected = passages.length > 0 && selectedPassages.length === passages.length;
  const editable = proposals.filter(proposal => !proposal.is_duplicate);

  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Badge tone="cyan">Documents</Badge><h2 className="mt-2 text-2xl font-bold">Importer une source de cours</h2><p className="mt-1 text-sm text-slate-400">PDF textuel, DOCX ou PPTX, 20 Mo maximum. Les fichiers sont privés à ton compte.</p></div>
      <Button onClick={() => inputRef.current?.click()} disabled={busy}>Choisir un fichier</Button>
      <input ref={inputRef} type="file" hidden accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={event => { if (event.target.files) receiveFiles(event.target.files); event.currentTarget.value = ""; }} />
    </div>
    <div className={`rounded-2xl border border-dashed p-8 text-center transition ${dragging ? "border-cyan-300 bg-cyan-300/10" : "border-white/20 bg-white/[0.02]"}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); receiveFiles(event.dataTransfer.files); }}><p className="font-semibold">Glisse ton document ici</p><p className="mt-2 text-sm text-slate-400">Les formats .doc et .ppt sont refusés. Un PDF scanné nécessite un OCR.</p></div>
    {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-200">{error}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200">{success}</p>}
    <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Panel className="p-4"><h3 className="font-semibold">Mes documents</h3><div className="mt-4 space-y-2">{documents.length ? documents.map(document => <button key={document.id} onClick={() => void openDocument(document)} className={`w-full rounded-xl p-3 text-left text-sm hover:bg-white/10 ${selected?.id === document.id ? "bg-cyan-300/10 text-cyan-100" : "text-slate-300"}`}><span className="block truncate font-semibold">{document.original_name}</span><span className="mt-1 block text-xs text-slate-500">{document.status === "ready" ? "Prêt" : document.status === "failed" ? "Échec" : document.status === "extracting" ? "Extraction" : "Importé"}</span></button>) : <p className="text-sm text-slate-500">Aucun document importé.</p>}</div></Panel>
      <div className="space-y-5">{selected ? <>
        <Panel className="p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{selected.original_name}</h3><p className="mt-1 text-sm text-slate-400">{selected.page_count ? `${selected.page_count} page(s)` : "Structure sans pagination"} · {selected.extracted_chars ?? 0} caractères extraits</p></div><div className="flex flex-wrap gap-2">{selected.status !== "ready" && <Button onClick={() => void extract()} disabled={busy}>{selected.status === "failed" ? "Réessayer l’extraction" : "Extraire le contenu"}</Button>}<Button variant="ghost" onClick={() => void fetch(`/api/courses/${courseId}/documents/${selected.id}/download`).then(response => response.json()).then(body => { if (body.url) window.open(body.url, "_blank", "noopener,noreferrer"); })}>Télécharger</Button><Button variant="danger" onClick={() => void remove()} disabled={busy}>Supprimer</Button></div></div>{selected.warning && <p className="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">{selected.warning}</p>}{selected.extraction_error && <p className="mt-4 rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{selected.extraction_error}</p>}</Panel>
        {passages.length > 0 && <Panel className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">Passages extraits</h3><p className="mt-1 text-sm text-slate-400">Sélectionne les passages transmis à Ollama ({selectedPassages.length}/{passages.length}).</p></div><Button variant="ghost" onClick={() => setSelectedPassages(allPassagesSelected ? [] : passages.map(passage => passage.id))}>{allPassagesSelected ? "Tout désélectionner" : "Tout sélectionner"}</Button></div><div className="mt-5 max-h-[32rem] space-y-3 overflow-auto">{passages.map(passage => <label key={passage.id} className="flex gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4"><input type="checkbox" checked={selectedPassages.includes(passage.id)} onChange={() => setSelectedPassages(current => current.includes(passage.id) ? current.filter(id => id !== passage.id) : [...current, passage.id])} className="mt-1 accent-cyan-300" /><span><span className="block text-xs font-semibold uppercase tracking-wider text-cyan-300">{passage.locator_label}</span><span className="mt-1 block text-sm text-slate-300">{passage.content}</span></span></label>)}</div><div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-[1fr_10rem_auto]"><select value={chapterId} onChange={event => setChapterId(event.target.value)} aria-label="Chapitre de destination" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm"><option value="">Choisir un chapitre</option>{chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select><select value={limit} onChange={event => setLimit(Number(event.target.value) as 5 | 10 | 20)} aria-label="Nombre maximal de cartes" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm"><option value={5}>5 cartes max.</option><option value={10}>10 cartes max.</option><option value={20}>20 cartes max.</option></select><Button onClick={() => void generate()} disabled={busy || !chapterId || !selectedPassages.length}>Générer avec Ollama</Button></div><p className="mt-3 text-xs text-slate-500">Les passages sélectionnés seront transmis à Ollama localement. Vérifie les propositions avant tout enregistrement.</p></Panel>}
        {proposals.length > 0 && <Panel className="p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-bold">Prévisualisation</h3><p className="mt-1 text-sm text-slate-400">{selectedProposals.length} sélectionnée(s), {editable.length} proposition(s) non doublon(s).</p></div><Button onClick={() => void saveProposals()} disabled={busy || !selectedProposals.length}>Enregistrer les cartes sélectionnées</Button></div><div className="mt-5 space-y-4">{proposals.map((proposal, index) => <ProposalEditor key={proposal.id} proposal={proposal} index={index} selected={selectedProposals.includes(proposal.id)} onToggle={() => setSelectedProposals(current => current.includes(proposal.id) ? current.filter(id => id !== proposal.id) : [...current, proposal.id])} onChange={next => setProposals(current => current.map(item => item.id === proposal.id ? { ...item, ...next } : item))} />)}</div></Panel>}
      </> : <Panel className="p-10 text-center"><h3 className="text-xl font-bold">Choisis un document</h3><p className="mt-2 text-slate-400">Importe une source puis sélectionne ses passages pour préparer des flashcards vérifiables.</p></Panel>}</div>
    </div>
  </section>;
}

function ProposalEditor({ proposal, index, selected, onToggle, onChange }: { proposal: Proposal; index: number; selected: boolean; onToggle: () => void; onChange: (next: Partial<Proposal>) => void }) {
  return <article className={`rounded-xl border p-5 ${proposal.is_duplicate ? "border-amber-300/30 bg-amber-400/5" : "border-white/10 bg-slate-950/40"}`}><div className="flex items-center justify-between gap-3"><label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-violet-300"><input type="checkbox" checked={selected} disabled={proposal.is_duplicate} onChange={onToggle} className="accent-cyan-300" aria-label={`Sélectionner la proposition ${index + 1}`} />Proposition {index + 1}</label>{proposal.is_duplicate && <Badge tone="rose">Doublon possible</Badge>}</div><label className="mt-4 block text-sm font-semibold">Question<textarea value={proposal.question} onChange={event => onChange({ question: event.target.value })} className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white" /></label><label className="mt-4 block text-sm font-semibold">Réponse<textarea value={proposal.answer} onChange={event => onChange({ answer: event.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm text-white" /></label><p className="mt-4 border-l-2 border-cyan-300/50 pl-3 text-sm text-slate-400">« {proposal.evidence} »</p><div className="mt-3 flex flex-wrap gap-2">{(proposal.generation_proposal_sources ?? []).map(source => <Badge key={source.passage_id} tone="cyan">{source.document_passages?.locator_label ?? "Passage source"}</Badge>)}</div>{proposal.duplicate_reason && <p className="mt-3 text-sm text-amber-200">{proposal.duplicate_reason}</p>}</article>;
}

