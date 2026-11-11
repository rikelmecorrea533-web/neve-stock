import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Heurística local de fallback caso a IA esteja offline ou sem chave
function detectColumnsHeuristic(headers: string[]): {
  nartColumn: string;
  lotColumn: string;
  qtyColumn: string;
  warehouseColumn?: string;
  descriptionColumn?: string;
} {
  let nartColumn = '';
  let lotColumn = '';
  let qtyColumn = '';
  let warehouseColumn = '';
  let descriptionColumn = '';

  for (const h of headers) {
    const norm = h.trim().toLowerCase();

    // Código / NART: Produto, Código, Codigo, NART, Nart, Cod.
    if (!nartColumn && (norm === 'produto' || norm === 'código' || norm === 'codigo' || norm === 'nart' || norm === 'cod' || norm.startsWith('cod.') || norm.includes('produto') || norm.includes('nart') || norm.includes('código') || norm.includes('codigo'))) {
      nartColumn = h;
    }
    // Lote
    else if (!lotColumn && (norm === 'lote' || norm.includes('lote') || norm === 'batch')) {
      lotColumn = h;
    }
    // Saldo: Saldo, Saldo Lote, Saldo do Lote, Quantidade, Qtd
    else if (!qtyColumn && (norm === 'saldo' || norm === 'saldo lote' || norm === 'saldo do lote' || norm === 'quantidade' || norm === 'qtd' || norm.includes('saldo') || norm.includes('quant'))) {
      qtyColumn = h;
    }
    // Armazém / Origem
    else if (!warehouseColumn && (norm.includes('armaz') || norm.includes('origem') || norm.includes('deposito') || norm.includes('depósito'))) {
      warehouseColumn = h;
    }
    // Descrição
    else if (!descriptionColumn && (norm.includes('descri') || norm.includes('material') || norm.includes('texto'))) {
      descriptionColumn = h;
    }
  }

  // Fallbacks posicionais caso não encontre
  if (!nartColumn && headers.length > 0) nartColumn = headers[0];
  if (!lotColumn && headers.length > 1) lotColumn = headers[1];
  if (!qtyColumn && headers.length > 2) qtyColumn = headers[2];

  return {
    nartColumn,
    lotColumn,
    qtyColumn,
    warehouseColumn: warehouseColumn || undefined,
    descriptionColumn: descriptionColumn || undefined,
  };
}

// Endpoint com IA Gemini 3.8 Flash para leitura inteligente de colunas
app.post('/api/gemini/parse-columns', async (req: Request, res: Response) => {
  try {
    const { headers, sampleRows } = req.body;

    if (!Array.isArray(headers) || headers.length === 0) {
      return res.status(400).json({ error: 'Nenhum cabeçalho fornecido' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback heurístico imediato se sem chave
      const fallback = detectColumnsHeuristic(headers);
      return res.json({
        ...fallback,
        method: 'heuristic',
        message: 'Detectado via heurística inteligente (Chave Gemini ausente)',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptText = `
Você é o assistente inteligente do aplicativo NEVE STOCK da Neve Medical (Bragança Paulista).
Analise os cabeçalhos das colunas de uma planilha de estoque e linhas de amostra:
Cabeçalhos: ${JSON.stringify(headers)}
Amostra das primeiras linhas: ${JSON.stringify(sampleRows || [])}

Regras:
1. Código / NART pode vir como: Produto, Código, Codigo, NART, Nart, Cod., etc.
2. Lote vem como: Lote, Batch, etc.
3. Saldo vem como: Saldo, Saldo Lote, Saldo do Lote, Quantidade, etc.
4. Armazém (12) é a coluna de origem.
5. Descrição (se houver) é o nome/descrição do material.
Retorne o nome exato da coluna encontrada para cada papel.
`;

    const aiPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        systemInstruction: 'Você identifica com precisão as colunas corretas de planilhas de estoque da indústria Neve Medical.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nartColumn: { type: Type.STRING, description: 'Nome exato do cabeçalho que contém o código/NART' },
            lotColumn: { type: Type.STRING, description: 'Nome exato do cabeçalho que contém o Lote' },
            qtyColumn: { type: Type.STRING, description: 'Nome exato do cabeçalho que contém a Quantidade/Saldo' },
            warehouseColumn: { type: Type.STRING, description: 'Nome exato do cabeçalho do Armazém se houver' },
            descriptionColumn: { type: Type.STRING, description: 'Nome exato do cabeçalho de Descrição se houver' },
          },
          required: ['nartColumn', 'lotColumn', 'qtyColumn'],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ao aguardar resposta da IA Gemini')), 4000)
    );

    const response = await Promise.race([aiPromise, timeoutPromise]);

    const parsedJson = JSON.parse(response.text || '{}');

    // Validação de segurança: verificar se as colunas retornadas realmente existem nos cabeçalhos
    const validNart = headers.includes(parsedJson.nartColumn) ? parsedJson.nartColumn : detectColumnsHeuristic(headers).nartColumn;
    const validLot = headers.includes(parsedJson.lotColumn) ? parsedJson.lotColumn : detectColumnsHeuristic(headers).lotColumn;
    const validQty = headers.includes(parsedJson.qtyColumn) ? parsedJson.qtyColumn : detectColumnsHeuristic(headers).qtyColumn;

    return res.json({
      nartColumn: validNart,
      lotColumn: validLot,
      qtyColumn: validQty,
      warehouseColumn: headers.includes(parsedJson.warehouseColumn) ? parsedJson.warehouseColumn : undefined,
      descriptionColumn: headers.includes(parsedJson.descriptionColumn) ? parsedJson.descriptionColumn : undefined,
      method: 'ai',
      message: 'Colunas identificadas com sucesso pela IA Gemini',
    });
  } catch (error) {
    console.warn('Erro ao chamar IA Gemini, usando fallback:', error);
    const fallback = detectColumnsHeuristic(req.body.headers || []);
    return res.json({
      ...fallback,
      method: 'heuristic',
      message: 'Detectado via heurística inteligente após falha na IA',
    });
  }
});

// Setup Vite Dev Server ou Produção
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 NEVE STOCK rodando na porta ${PORT} (${isDev ? 'Dev com Vite' : 'Produção'})`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
  process.exit(1);
});
