-- CreateIndex: HNSW 向量索引，加速余弦相似度搜索
-- 预期 10-100 倍搜索性能提升
CREATE INDEX IF NOT EXISTS "NoteChunk_embedding_hnsw_idx"
ON "NoteChunk"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
