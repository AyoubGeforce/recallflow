# RecallFlow

RecallFlow est une application web d’apprentissage actif destinée aux étudiants en informatique. Elle centralise les cours, facilite la création de flashcards et organise des sessions de révision avec répétition espacée. Un pipeline optionnel permet aussi d’extraire des documents et de proposer des cartes générées par une IA locale.

Dépôt : https://github.com/AyoubGeforce/recallflow

## Objectifs

- Organiser cours, chapitres, notes et flashcards dans un espace personnel.
- Réviser avec des sessions courtes et des échéances calculées selon l’évaluation donnée.
- Expérimenter une architecture full-stack TypeScript avec authentification, RLS, Storage et fonctions RPC.
- Utiliser une IA locale sourcée par les passages réellement sélectionnés.

## Fonctionnalités implémentées

### Compte et cours

- Inscription et connexion par courriel et mot de passe avec Supabase Auth.
- Tableau de bord protégé avec cartes dues, compteurs et activité récente.
- Création, modification et suppression de cours.
- Création, modification, suppression et réorganisation de chapitres.
- Notes textuelles par chapitre.
- Création, modification et suppression manuelles de flashcards.
- Recherche dans les chapitres, questions et réponses.
- Import explicite d’anciens noms de cours conservés dans le localStorage.

### Révision et progression

- Sessions filtrables par cours ou chapitre.
- Quatre évaluations : « à revoir », « difficile », « bien » et « facile ».
- Calcul et sauvegarde des prochaines échéances, intervalles, répétitions, échecs et facteur de facilité.
- Clés d’idempotence pour éviter les doubles envois.
- Historique des réponses et statistiques de progression.

### Documents et IA locale

L’extraction documentaire et la génération sont deux étapes distinctes :

- L’extraction est réalisée côté serveur et ne nécessite pas Ollama.
- La génération de flashcards nécessite Ollama, un modèle local installé et une sélection de passages extraits.
- Import de PDF textuels, DOCX et PPTX jusqu’à 20 Mo.
- Stockage dans le bucket privé Supabase course-documents.
- Extraction des passages et de leur localisation.
- Téléchargement par URL signée temporaire.
- Propositions de flashcards via Ollama avec sortie JSON structurée.
- Validation Zod, vérification des identifiants de passages et de l’extrait cité.
- Détection des doublons et sauvegarde sélective avec provenance vers les passages sources.

Aucun modèle n’est téléchargé automatiquement. Ollama est donc requis pour la génération, mais pas pour importer et extraire un document.

## Technologies et versions

Les versions ci-dessous ont été vérifiées dans package.json et dans la section racine de package-lock.json. Le lockfile est en version 3.

- **Next.js 16.4.4** avec App Router et Route Handlers.
- **React 19.3.0** et **react-dom 19.3.0**.
- **TypeScript 5**.
- **Tailwind CSS 4**.
- **Supabase** avec @supabase/ssr 0.12.7 et @supabase/supabase-js 2.118.0.
- **Ollama** pour la génération locale.
- **Zod 4.6.7** pour les validations.
- **pdfjs-dist 6.5.438**, **mammoth 1.13.0**, **fast-xml-parser 5.12.0** et **jszip 3.10.2**.
- **ESLint 9** et **Node.js Test Runner**.

## Architecture

~~~text
app/
├── page.tsx                          # Tableau de bord
├── courses/                          # Cours et espaces de cours
├── study/                            # Sessions de révision
├── progress/                         # Historique et statistiques
├── login/ et signup/                 # Authentification
├── auth/                             # Callback et confirmation Supabase
└── api/
    ├── reviews/                      # Enregistrement des réponses
    ├── courses/[courseId]/documents  # Import, extraction, téléchargement
    └── ai/generations                # Génération et sauvegarde

components/                           # Interface réutilisable
lib/
├── ai/                               # Fournisseur Ollama et schémas
├── documents/                        # Types, validation et extraction
├── reviews/                          # Planification et tests
└── supabase/                         # Clients navigateur/serveur
supabase/migrations/
├── 202611050000_courses.sql          # Schéma initial des cours
├── 202611050001_learning_space.sql   # Chapitres, cartes et révisions
├── 202611050002_documents_ai.sql     # Documents, sources et générations
└── 202611060001_documents_ai_security.sql
                                      # Correction des permissions serveur
docs/                                 # Documentation technique
~~~

Les pages et routes suivent les conventions de l’App Router. Les finalisations sensibles d’extraction et de génération utilisent un client Supabase réservé au serveur. Les migrations définissent les politiques RLS et les contraintes de propriété.

## Installation locale depuis une base Supabase vide

### Prérequis

- Node.js 20.9 ou plus récent.
- npm.
- Un projet Supabase vide.
- Ollama et un modèle local uniquement si la génération IA doit être testée.

### Installation de l’application

~~~bash
git clone https://github.com/AyoubGeforce/recallflow.git
cd recallflow
npm install
~~~

### Migrations Supabase

Exécuter les migrations dans le SQL Editor Supabase, dans cet ordre strict :

1. supabase/migrations/202611050000_courses.sql
2. supabase/migrations/202611050001_learning_space.sql
3. supabase/migrations/202611050002_documents_ai.sql
4. supabase/migrations/202611060001_documents_ai_security.sql

La première migration crée public.courses. Elle est nécessaire avant learning_space, qui référence cette table avec des clés étrangères. Ces migrations sont fournies pour une application manuelle et ne sont pas appliquées automatiquement à un projet distant par ce dépôt.

### Auth Supabase en local

Dans Supabase Dashboard > Authentication > URL Configuration :

- **Site URL** : http://localhost:3000
- **Redirect URLs** : http://localhost:3000/auth/callback

Le formulaire d’inscription construit cette URL de callback à partir de l’origine courante. La route auth/confirm existe dans le dépôt, mais elle redirige vers la page de connexion et n’est pas le callback utilisé par l’inscription actuelle. Pour un déploiement différent, remplacer localhost par l’URL publique exacte et l’ajouter explicitement aux Redirect URLs.

Dans Authentication > Providers > Email, activer le fournisseur Email. La confirmation d’adresse doit rester cohérente avec le callback ci-dessus.

### Exposition sélective de la Data API

Si l’exposition automatique de la Data API est désactivée, exposer explicitement, dans Project Settings > Data API, les tables et fonctions réellement utilisées :

- Tables : public.courses, public.chapters, public.flashcards, public.review_sessions, public.review_responses.
- Documents : public.documents, public.document_processing_jobs, public.document_passages.
- Génération et provenance : public.ai_generations, public.generation_proposals, public.generation_proposal_sources, public.generation_saves, public.flashcard_sources.
- Fonctions appelées par le client authentifié : public.record_review, public.start_ai_generation, public.save_generation_cards.
- Fonctions de traitement serveur : public.claim_document_extraction, public.complete_document_extraction, public.fail_document_extraction, public.complete_ai_generation et public.fail_ai_generation.

Ne pas exposer auth.users, les fonctions de trigger ou une clé service_role au navigateur. Les fonctions de finalisation sont accordées au rôle serveur par la migration de sécurité; leur exposition éventuelle à la Data API ne rend pas la clé service_role publique, mais doit rester limitée à l’usage serveur prévu.

## Variables d’environnement

Ne jamais publier .env.local, une clé de service ou un secret. Le fichier .env.example contient uniquement des valeurs indicatives.

~~~dotenv
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=votre-cle-publiable
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-cote-serveur
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=nom-du-modele-local
~~~

- NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont utilisés par les clients Supabase.
- SUPABASE_SERVICE_ROLE_KEY est uniquement serveur et nécessaire aux traitements d’extraction et de génération. Elle ne doit jamais être préfixée par NEXT_PUBLIC_.
- OLLAMA_BASE_URL vaut par défaut http://localhost:11434.
- OLLAMA_MODEL doit correspondre à un modèle déjà présent dans ollama list.

## Commandes

~~~bash
npm run dev        # Développement
npm run lint       # ESLint
npm run test:unit  # Tests unitaires et vérifications statiques
npm run build      # Build de production
npm run start      # Démarrage après build
~~~

L’application de développement est disponible sur http://localhost:3000.

## Tests et niveau de validation

La commande npm run test:unit exécute 12 tests Node.js :

- tests unitaires du calcul des échéances de révision ;
- tests de détection et d’extraction de documents ;
- tests de validation du schéma de sortie IA ;
- tests statiques sur le contenu des migrations SQL, notamment les politiques, permissions et motifs d’idempotence.

Ces tests statiques lisent les fichiers SQL; ils ne se connectent pas à PostgreSQL et ne prouvent donc pas que les permissions, RLS, fonctions RPC ou transactions fonctionnent réellement dans une base Supabase. Le dépôt ne contient pas de tests PostgreSQL d’intégration ni de test de parcours IA de bout en bout.

Verdict de validation actuel :

- validé : tests unitaires et statiques locaux, lint ESLint et cohérence package.json/package-lock.json ;
- non validé : exécution réelle des migrations sur une base Supabase, permissions en PostgreSQL et parcours IA complet avec Ollama.

## Limites connues et fonctionnalités incomplètes

- Aucun OCR : les PDF scannés sans couche de texte sont refusés.
- Les formats .doc et .ppt ne sont pas pris en charge; seuls PDF, DOCX et PPTX le sont.
- La génération IA dépend d’Ollama et d’un modèle local installé; aucun service cloud ni téléchargement automatique n’est prévu.
- La validation des sources ne garantit pas la pertinence pédagogique des cartes générées.
- Les statistiques décrivent les évaluations enregistrées; elles ne mesurent pas à elles seules la compréhension.
- Aucune suite end-to-end ni intégration automatisée avec Supabase/Ollama n’est présente.
- L’exécution SQL et la configuration Supabase sont manuelles.
- Limites actuelles : 20 Mo par fichier, 200 pages/diapositives pour PDF/PPTX, 1 200 passages, 60 000 caractères envoyés au modèle, deux générations simultanées et vingt générations par utilisateur et par jour.

## Documentation associée

- docs/documents-ai.md : documents, extraction et Ollama.
- docs/learning-space-migration.md : migration de l’espace d’apprentissage et vérifications Supabase.

## État et verdict portfolio

Le dépôt est prêt à être présenté comme projet de portfolio GitHub étudiant, avec une réserve importante : la validation PostgreSQL réelle et le parcours IA complet restent à exécuter séparément si l’on veut revendiquer une validation d’intégration. Les fonctionnalités principales de gestion des cours, flashcards et révisions sont présentes; l’extraction documentaire est indépendante d’Ollama, tandis que la génération IA nécessite Ollama.
