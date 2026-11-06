# Documents, extraction et Ollama local

Le lot utilise Ollama uniquement depuis les route handlers Node.js de Next. Le navigateur ne reçoit ni clé ni accès direct au port Ollama.

Migration à appliquer après `202611050001_learning_space.sql` : `supabase/migrations/202611050002_documents_ai.sql`. Elle crée le bucket privé `course-documents`, les tables de documents/passages/générations/provenance et les fonctions RPC protégées. Si l’exposition automatique Data API est désactivée, exposer explicitement les tables nécessaires et les fonctions `start_ai_generation`, `claim_document_extraction`, `complete_document_extraction`, `fail_document_extraction`, `complete_ai_generation`, `fail_ai_generation` et `save_generation_cards`.

Variables serveur :

- `OLLAMA_BASE_URL` : adresse locale, par défaut `http://localhost:11434`.
- `OLLAMA_MODEL` : nom exact d’un modèle déjà installé avec `ollama list`.

Aucun modèle n’est téléchargé automatiquement. L’API vérifie `/api/tags` avant chaque génération et affiche une erreur claire si Ollama est arrêté ou si le modèle manque.

Le fournisseur appelle `/api/generate` avec `stream: false` et un JSON Schema dans `format`, conformément à la documentation Ollama sur les sorties structurées. La réponse est ensuite analysée par Zod, puis les identifiants et extraits sont vérifiés contre les passages réellement sélectionnés.

## Activation locale

1. Installer et démarrer Ollama localement.
2. Installer manuellement un modèle adapté, par exemple avec `ollama pull <modele>` si tu l’autorises.
3. Définir `OLLAMA_MODEL` dans `.env.local`; ne pas mettre cette variable sous `NEXT_PUBLIC_`.
4. Redémarrer Next.js.
5. Ouvrir un cours, l’onglet **Documents**, importer un PDF textuel, DOCX ou PPTX, extraire le contenu, sélectionner les passages et lancer la génération.

L’application limite les fichiers à 20 Mo, les PDF/PPTX à 200 pages ou diapositives, le texte extrait à 1 000 000 caractères, les passages à 1 200, le texte envoyé à 60 000 caractères, les générations simultanées à 2 par utilisateur et les générations quotidiennes à 20 par utilisateur. Ces limites de sécurité ne constituent pas un plafond monétaire.

Les PDF scannés sans couche texte sont refusés avec une indication qu’un OCR est nécessaire. Les macros, scripts et liens embarqués ne sont pas exécutés.
Les RPC de finalisation (`claim_document_extraction`, `complete_document_extraction`, `fail_document_extraction`, `complete_ai_generation`, `fail_ai_generation`) sont réservées au rôle serveur `service_role`. Seules `start_ai_generation` et `save_generation_cards` sont destinées aux appels authentifiés de l’application. `SUPABASE_SERVICE_ROLE_KEY` est obligatoire côté serveur pour les traitements, jamais dans le navigateur.
