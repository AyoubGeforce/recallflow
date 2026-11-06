# Migration de l’espace d’apprentissage

Migration finale : `supabase/migrations/202611050001_learning_space.sql`.

## Exécution

1. Ouvrir le projet Supabase `hrsuabjlspizszfsutnz`.
2. Aller dans **SQL Editor → New query**.
3. Coller le contenu complet de `supabase/migrations/202611050001_learning_space.sql`.
4. Exécuter la requête en une seule fois, après la migration qui crée déjà `public.courses`.
5. Dans **Project Settings → Data API**, laisser l’exposition automatique désactivée et ajouter explicitement les tables suivantes à l’exposition :
   - `public.chapters`
   - `public.flashcards`
   - `public.review_sessions`
   - `public.review_responses`
   - la fonction RPC `public.record_review`
6. Ne pas exposer `auth.users`, les fonctions de trigger ou une clé `service_role` au navigateur.
7. Exécuter la requête de vérification ci-dessous.

La suppression d’un cours supprime ses chapitres, flashcards et sessions associées par cascade ; l’interface l’annonce avant confirmation.

## Atomicité et idempotence

`public.record_review(...)` est la seule fonction d’écriture des réponses. Elle est `SECURITY DEFINER` uniquement pour encapsuler dans une transaction l’insertion de `review_responses` et la mise à jour de `flashcards`. Elle vérifie toujours `auth.uid()`, la propriété de la session et de la carte, ainsi que le périmètre cours/chapitre.

Les autres fonctions sont `SECURITY INVOKER`. Les écritures directes de `review_responses` sont retirées au rôle `authenticated`; seule l’exécution de `record_review` est accordée.

Une nouvelle tentative légitime utilise une nouvelle `p_idempotency_key` et peut donc créer une nouvelle ligne pour la même carte et la même session. Un renvoi exact de la même requête réutilise sa clé et retourne sans modifier à nouveau la planification. La contrainte est `(session_id, idempotency_key)`, pas `(session_id, flashcard_id)`.

## Requête de vérification

```sql
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('courses', 'chapters', 'flashcards', 'review_sessions', 'review_responses')
order by c.relname;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('chapters', 'flashcards', 'review_sessions', 'review_responses')
order by tablename, policyname;

select table_schema, table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('chapters', 'flashcards', 'review_sessions', 'review_responses')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

select routine_schema, routine_name, routine_type, security_type,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('record_review', 'prevent_owner_change', 'touch_updated_at', 'prevent_relation_change',
                    'check_chapter_course_owner', 'check_flashcard_relations',
                    'check_review_response_relations', 'check_review_session_scope')
order by routine_name;

select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and tablename in ('chapters', 'flashcards', 'review_sessions', 'review_responses')
order by tablename, indexname;
```
