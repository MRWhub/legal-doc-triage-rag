import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createChatMessage,
  createDocument,
  deleteDocumentById,
  getDocumentById,
  listChatMessages,
  listDocuments,
} from './server/db.ts';
import { answerDocumentQuestion, extractLegalMetadata } from './server/llmService.ts';
import { extractPdfWithPages } from './server/pdfExtractor.ts';
import { generateSamplePdfBuffer, listSampleDocuments } from './server/sampleGenerator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
    const isPdfMime =
      file.mimetype === 'application/pdf' || file.mimetype === 'application/octet-stream';
    if (!isPdfExt || !isPdfMime) {
      cb(new Error('Envie apenas arquivos no formato PDF (.pdf).'));
      return;
    }
    cb(null, true);
  },
});

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/g, '_');
  return base.slice(0, 140) || 'documento.pdf';
}

function parseDocId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function getReadableErrorMessage(error: unknown): { status: number; message: string } {
  const msg = error instanceof Error ? error.message : 'Erro interno inesperado no servidor.';
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
    return {
      status: 502,
      message:
        'A chave GEMINI_API_KEY foi recusada pela API do Google. Verifique a configuração em Settings > Secrets.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message:
        'Limite temporário de requisições da API Gemini atingido. Aguarde alguns segundos e tente novamente.',
    };
  }
  if (
    msg.includes('PDF') ||
    msg.includes('Arquivo inválido') ||
    msg.includes('extrair texto') ||
    msg.includes('File too large')
  ) {
    return { status: 400, message: msg };
  }
  return { status: 500, message: msg };
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'JurisTriage API' });
  });

  app.get('/api/documents', (_req, res) => {
    try {
      const documents = listDocuments();
      res.json({ documents });
    } catch (error) {
      const { status, message } = getReadableErrorMessage(error);
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/documents/:id', (req, res) => {
    const id = parseDocId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Identificador de documento inválido.' });
      return;
    }

    const document = getDocumentById(id);
    if (!document) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }

    const messages = listChatMessages(id);
    res.json({ document, messages });
  });

  app.delete('/api/documents/:id', (req, res) => {
    const id = parseDocId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Identificador de documento inválido.' });
      return;
    }

    const deleted = deleteDocumentById(id);
    if (!deleted) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }

    res.json({ deleted: true, id });
  });

  app.post('/api/documents/upload', (req, res) => {
    upload.single('file')(req, res, async (uploadErr) => {
      if (uploadErr) {
        const message =
          uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE'
            ? 'Arquivo muito grande. O tamanho máximo permitido é 10 MB.'
            : uploadErr.message || 'Falha no upload do arquivo PDF.';
        res.status(400).json({ error: message });
        return;
      }

      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'Nenhum arquivo PDF foi enviado.' });
        return;
      }

      try {
        const safeFilename = sanitizeFilename(req.file.originalname);
        const extracted = await extractPdfWithPages(req.file.buffer);
        const structured = await extractLegalMetadata(extracted.text, safeFilename);

        const created = createDocument({
          filename: safeFilename,
          ...structured,
          raw_text: extracted.text,
          page_count: extracted.pageCount,
        });

        res.status(201).json({ document: created });
      } catch (error) {
        const { status, message } = getReadableErrorMessage(error);
        res.status(status).json({ error: message });
      }
    });
  });

  app.post('/api/documents/:id/chat', async (req, res) => {
    const id = parseDocId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Identificador de documento inválido.' });
      return;
    }

    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question || question.length < 2) {
      res.status(400).json({ error: 'Digite uma pergunta válida sobre o documento.' });
      return;
    }
    if (question.length > 1500) {
      res.status(400).json({ error: 'A pergunta excede o limite de 1500 caracteres.' });
      return;
    }

    const document = getDocumentById(id);
    if (!document) {
      res.status(404).json({ error: 'Documento não encontrado.' });
      return;
    }

    try {
      const history = listChatMessages(id).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const ragResult = await answerDocumentQuestion(
        document.raw_text,
        document.filename,
        question,
        history
      );

      const userMessage = createChatMessage(id, 'user', question, []);
      const assistantMessage = createChatMessage(
        id,
        'assistant',
        ragResult.resposta,
        ragResult.paginas_citadas
      );

      res.json({
        userMessage,
        assistantMessage,
        foundInDocument: ragResult.encontrado_no_documento,
      });
    } catch (error) {
      const { status, message } = getReadableErrorMessage(error);
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/samples', (_req, res) => {
    res.json({ samples: listSampleDocuments() });
  });

  app.get('/api/samples/:slug/pdf', async (req, res) => {
    const slug = String(req.params.slug || '').trim();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      res.status(400).json({ error: 'Identificador de amostra inválido.' });
      return;
    }

    try {
      const generated = await generateSamplePdfBuffer(slug);
      if (!generated) {
        res.status(404).json({ error: 'Documento de demonstração não encontrado.' });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${generated.filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(generated.buffer);
    } catch (error) {
      const { status, message } = getReadableErrorMessage(error);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/samples/load', async (req, res) => {
    try {
      const requestedSlug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : null;
      const allSamples = listSampleDocuments();
      const targetSamples = requestedSlug
        ? allSamples.filter((s) => s.slug === requestedSlug)
        : allSamples;

      if (targetSamples.length === 0) {
        res.status(404).json({ error: 'Documento de demonstração não encontrado.' });
        return;
      }

      const createdDocs = [];
      for (const sample of targetSamples) {
        const generated = await generateSamplePdfBuffer(sample.slug);
        if (!generated) continue;
        const extracted = await extractPdfWithPages(generated.buffer);
        const structured = await extractLegalMetadata(extracted.text, generated.filename);
        const doc = createDocument({
          filename: generated.filename,
          ...structured,
          raw_text: extracted.text,
          page_count: extracted.pageCount,
        });
        createdDocs.push(doc);
      }

      res.status(201).json({ documents: createdDocs });
    } catch (error) {
      const { status, message } = getReadableErrorMessage(error);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JurisTriage server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start JurisTriage server:', error);
  process.exit(1);
});
