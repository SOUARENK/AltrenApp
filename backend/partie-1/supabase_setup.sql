-- =============================================================================
-- SETUP SUPABASE — À exécuter dans le SQL Editor de Supabase
-- =============================================================================
-- Ce script crée :
-- 1. L'extension pgvector (vecteurs + recherche par similarité)
-- 2. La table `documents` (chunks + embeddings + métadonnées)
-- 3. L'index IVFFlat (performances de recherche vectorielle)
-- 4. La fonction `match_documents` (recherche cosinus appelée par le backend)
-- =============================================================================

-- ÉTAPE 1 : Activer l'extension pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ÉTAPE 2 : Créer la table `documents`
-- Chaque ligne = un chunk de texte avec son embedding 1536D
CREATE TABLE IF NOT EXISTS documents (
    id          BIGSERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    embedding   VECTOR(1536) NOT NULL,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ÉTAPE 3 : Index vectoriel IVFFlat (meilleur compromis vitesse/précision)
-- À créer APRÈS avoir inséré des données (sinon l'index sera vide et inutile)
-- Commenter cette ligne pour la première exécution si la table est vide.
CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ÉTAPE 4 : Fonction de recherche par similarité cosinus
-- Appelée via : supabase.rpc("match_documents", {...})
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding    VECTOR(1536),
    match_count        INT     DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id         BIGINT,
    content    TEXT,
    metadata   JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.content,
        d.metadata,
        -- Similarité cosinus : 1 = identique, 0 = aucun rapport
        (1 - (d.embedding <=> query_embedding))::FLOAT AS similarity
    FROM documents d
    WHERE (1 - (d.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
