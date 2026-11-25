import Database from 'better-sqlite3';
import path from 'path';
import type { ChatMessage, LegalDocument, UrgencyLevel } from '../src/types.ts';

const DB_PATH = path.resolve(process.cwd(), 'juristriage.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    tipo_documento TEXT NOT NULL,
    numero_processo TEXT,
    partes_envolvidas TEXT NOT NULL,
    prazo_ou_vigencia TEXT NOT NULL,
    valor_envolvido TEXT NOT NULL,
    urgencia TEXT NOT NULL CHECK (urgencia IN ('ALTA', 'MEDIA', 'BAIXA')),
    resumo_executivo TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    cited_pages TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chat_messages_doc_id ON chat_messages(document_id);
`);

interface DocumentRow {
  id: number;
  filename: string;
  tipo_documento: string;
  numero_processo: string | null;
  partes_envolvidas: string;
  prazo_ou_vigencia: string;
  valor_envolvido: string;
  urgencia: UrgencyLevel;
  resumo_executivo: string;
  raw_text: string;
  page_count: number;
  created_at: string;
}

interface ChatRow {
  id: number;
  document_id: number;
  role: 'user' | 'assistant';
  content: string;
  cited_pages: string;
  created_at: string;
}

function mapDocumentRow(row: DocumentRow): LegalDocument {
  let partes: string[] = [];
  try {
    const parsed = JSON.parse(row.partes_envolvidas);
    if (Array.isArray(parsed)) {
      partes = parsed.map((item) => String(item));
    }
  } catch {
    partes = [];
  }

  return {
    ...row,
    partes_envolvidas: partes,
  };
}

function mapChatRow(row: ChatRow): ChatMessage {
  let citedPages: number[] = [];
  try {
    const parsed = JSON.parse(row.cited_pages);
    if (Array.isArray(parsed)) {
      citedPages = parsed
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0);
    }
  } catch {
    citedPages = [];
  }

  return {
    ...row,
    cited_pages: citedPages,
  };
}

export interface CreateDocumentInput {
  filename: string;
  tipo_documento: string;
  numero_processo: string | null;
  partes_envolvidas: string[];
  prazo_ou_vigencia: string;
  valor_envolvido: string;
  urgencia: UrgencyLevel;
  resumo_executivo: string;
  raw_text: string;
  page_count: number;
}

const insertDocStmt = db.prepare(`
  INSERT INTO documents (
    filename,
    tipo_documento,
    numero_processo,
    partes_envolvidas,
    prazo_ou_vigencia,
    valor_envolvido,
    urgencia,
    resumo_executivo,
    raw_text,
    page_count
  ) VALUES (
    @filename,
    @tipo_documento,
    @numero_processo,
    @partes_envolvidas,
    @prazo_ou_vigencia,
    @valor_envolvido,
    @urgencia,
    @resumo_executivo,
    @raw_text,
    @page_count
  )
`);

const listDocsStmt = db.prepare(`
  SELECT *
  FROM documents
  ORDER BY
    CASE urgencia
      WHEN 'ALTA' THEN 1
      WHEN 'MEDIA' THEN 2
      ELSE 3
    END ASC,
    id DESC
`);

const getDocByIdStmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
const deleteDocByIdStmt = db.prepare(`DELETE FROM documents WHERE id = ?`);
const listChatByDocStmt = db.prepare(
  `SELECT * FROM chat_messages WHERE document_id = ? ORDER BY id ASC`
);
const insertChatStmt = db.prepare(`
  INSERT INTO chat_messages (document_id, role, content, cited_pages)
  VALUES (?, ?, ?, ?)
`);
const getChatByIdStmt = db.prepare(`SELECT * FROM chat_messages WHERE id = ?`);

export function createDocument(input: CreateDocumentInput): LegalDocument {
  const result = insertDocStmt.run({
    ...input,
    partes_envolvidas: JSON.stringify(input.partes_envolvidas),
  });
  const inserted = getDocByIdStmt.get(Number(result.lastInsertRowid)) as DocumentRow;
  return mapDocumentRow(inserted);
}

export function listDocuments(): LegalDocument[] {
  const rows = listDocsStmt.all() as DocumentRow[];
  return rows.map(mapDocumentRow);
}

export function getDocumentById(id: number): LegalDocument | null {
  const row = getDocByIdStmt.get(id) as DocumentRow | undefined;
  return row ? mapDocumentRow(row) : null;
}

export function deleteDocumentById(id: number): boolean {
  const result = deleteDocByIdStmt.run(id);
  return result.changes > 0;
}

export function listChatMessages(documentId: number): ChatMessage[] {
  const rows = listChatByDocStmt.all(documentId) as ChatRow[];
  return rows.map(mapChatRow);
}

export function createChatMessage(
  documentId: number,
  role: 'user' | 'assistant',
  content: string,
  citedPages: number[] = []
): ChatMessage {
  const result = insertChatStmt.run(
    documentId,
    role,
    content,
    JSON.stringify(citedPages)
  );
  const row = getChatByIdStmt.get(Number(result.lastInsertRowid)) as ChatRow;
  return mapChatRow(row);
}
