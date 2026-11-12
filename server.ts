import express from 'express';
import type { Request, Response } from 'express';
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

  const clean = headers.map((h) => ({
    original: h,
    norm: h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  }));

  // 1. Identificar SALDO: Uma coluna com "Saldo" no nome é SEMPRE saldo, nunca lote.
  for (const item of clean) {
    if (item.norm === 'saldo lote' || item.norm === 'saldo do lote' || item.norm === 'saldo') {
      qtyColumn = item.original;
      break;
    }
  }
  if (!qtyColumn) {
    for (const item of clean) {
      if (item.norm.includes('saldo') || item.norm === 'quantidade' || item.norm === 'qtd' || item.norm.includes('quant')) {
        qtyColumn = item.original;
        break;
      }
    }
  }

  // 2. Identificar LOTE: A coluna chamada exatamente "Lote" (ou "Nº Lote", "Num Lote") e que NÃO contém "Saldo".
  for (const item of clean) {
    if (item.original === qtyColumn) continue;
    if (item.norm.includes('saldo')) continue;
    if (item.norm === 'lote' || item.norm === 'no lote' || item.norm === 'num lote' || item.norm === 'numero lote') {
      lotColumn = item.original;
      break;
    }
  }
  if (!lotColumn) {
    for (const item of clean) {
      if (item.original === qtyColumn) continue;
      if (item.norm.includes('saldo')) continue;
      if (item.norm.includes('lote') || item.norm === 'batch' || item.norm === 'lote/serie') {
        lotColumn = item.original;
        break;
      }
    }
  }

  // 3. Identificar CÓDIGO / NART: Produto, Código, Codigo, NART, Cadastro, Cod.
  for (const item of clean) {
    if (item.original === qtyColumn || item.original === lotColumn) continue;
    if (item.norm === 'produto' || item.norm === 'codigo' || item.norm === 'nart' || item.norm === 'cadastro' || item.norm === 'cod') {
      nartColumn = item.original;
      break;
    }
  }
  if (!nartColumn) {
    for (const item of clean) {
      if (item.original === qtyColumn || item.original === lotColumn) continue;
      if (item.norm.includes('produto') || item.norm.includes('codigo') || item.norm.includes('nart') || item.norm.includes('cadastro') || item.norm.startsWith('cod')) {
        nartColumn = item.original;
        break;
      }
    }
  }

  // 4. Armazém (12)
  for (const item of clean) {
    if (item.original === qtyColumn || item.original === lotColumn || item.original === nartColumn) continue;
    if (item.norm === 'armazem' || item.norm.includes('armaz') || item.norm.includes('origem') || item.norm.includes('deposito')) {
      warehouseColumn = item.original;
      break;
    }
  }

  // 5. Descrição
  for (const item of clean) {
    if (item.original === qtyColumn || item.original === lotColumn || item.original === nartColumn || item.original === warehouseColumn) continue;
    if (item.norm.includes('descri') || item.norm.includes('material') || item.norm.includes('texto')) {
      descriptionColumn = item.original;
      break;
    }
  }

  // Fallbacks posicionais caso não encontre colunas distintas
  const remaining = headers.filter((h) => h !== nartColumn && h !== lotColumn && h !== qtyColumn);
  if (!nartColumn && remaining.length > 0) nartColumn = remaining.shift()!;
  if (!lotColumn && remaining.length > 0) lotColumn = remaining.shift()!;
  if (!qtyColumn && remaining.length > 0) qtyColumn = remaining.shift()!;

  return {
    nartColumn: nartColumn || (headers[0] || ''),
    lotColumn: lotColumn || (headers[1] || ''),
    qtyColumn: qtyColumn || (headers[2] || ''),
    warehouseColumn: warehouseColumn || undefined,
    descriptionColumn: descriptionColumn || undefined,
  };
}

// Endpoint com IA Gemini para leitura inteligente de colunas
// O Gemini SÓ identifica as colunas e NUNCA lê, arredonda ou reescreve os valores das células.
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
Você é o assistente inteligente de identificação de colunas do aplicativo NEVE STOCK da Neve Medical (Bragança Paulista).
Sua ÚNICA função é identificar quais colunas da planilha correspondem a: Código, Lote e Saldo.
Você NUNCA deve devolver, reescrever, arredonda ou converter os valores das linhas. Quem lê os valores é o código do app direto da planilha.

Cabeçalhos da planilha: ${JSON.stringify(headers)}
Primeiras 3 linhas de amostra: ${JSON.stringify(sampleRows || [])}

REGRAS OBRIGATÓRIAS DE IDENTIFICAÇÃO:
1. Saldo: qualquer coluna com a palavra "Saldo" (Saldo, Saldo Lote, Saldo do Lote) ou Quantidade, Qtd. Uma coluna com a palavra Saldo NUNCA é Lote.
2. Lote: a coluna chamada exatamente "Lote" (ou "Nº Lote", "Num Lote") e que NÃO contém a palavra Saldo.
3. Código: Produto, Código, Codigo, NART, Cadastro, Cod.
4. Armazém: coluna informativa (ex: Armazem, Armazem 12).
5. Procure primeiro o nome exato, depois o parecido. Cada coluna só pode ser usada uma vez.

Responda em formato JSON com os nomes exatos das colunas encontradas nos cabeçalhos:
{
  "codigo": "nome_exato_da_coluna_de_codigo",
  "lote": "nome_exato_da_coluna_de_lote",
  "saldo": "nome_exato_da_coluna_de_saldo",
  "armazem": "nome_exato_da_coluna_de_armazem_se_houver",
  "descricao": "nome_exato_da_coluna_de_descricao_se_houver"
}
`;

    const aiPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        systemInstruction: 'Uma coluna com a palavra Saldo nunca é Lote. Lote é a coluna chamada Lote sem a palavra Saldo. Cada coluna só pode ser usada uma vez.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            codigo: { type: Type.STRING, description: 'Nome exato do cabeçalho que contém o código/NART/Produto' },
            lote: { type: Type.STRING, description: 'Nome exato do cabeçalho chamado Lote (sem a palavra Saldo)' },
            saldo: { type: Type.STRING, description: 'Nome exato do cabeçalho que contém o Saldo/Saldo Lote/Quantidade' },
            armazem: { type: Type.STRING, description: 'Nome exato do cabeçalho do Armazém se houver' },
            descricao: { type: Type.STRING, description: 'Nome exato do cabeçalho de Descrição se houver' },
          },
          required: ['codigo', 'lote', 'saldo'],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ao aguardar resposta da IA Gemini')), 3500)
    );

    const response = await Promise.race([aiPromise, timeoutPromise]);
    const parsedJson = JSON.parse(response.text || '{}');

    // Mapeamento aceitando chaves em português ou inglês
    let rawNart = parsedJson.codigo || parsedJson.nartColumn || '';
    let rawLot = parsedJson.lote || parsedJson.lotColumn || '';
    let rawQty = parsedJson.saldo || parsedJson.qtyColumn || '';
    let rawWh = parsedJson.armazem || parsedJson.warehouseColumn || undefined;
    let rawDesc = parsedJson.descricao || parsedJson.descriptionColumn || undefined;

    // Regra mandatória: se a coluna Lote tiver a palavra Saldo, rejeitar e corrigir
    if (rawLot && rawLot.toLowerCase().includes('saldo')) {
      console.warn('IA atribuiu coluna com Saldo para Lote! Corrigindo...');
      rawLot = '';
    }

    // Regra mandatória: cada coluna só pode ser usada uma vez
    if (rawLot === rawQty) {
      rawLot = '';
    }

    const fallback = detectColumnsHeuristic(headers);

    const validNart = headers.includes(rawNart) ? rawNart : fallback.nartColumn;
    const validLot = (headers.includes(rawLot) && !rawLot.toLowerCase().includes('saldo')) ? rawLot : fallback.lotColumn;
    const validQty = headers.includes(rawQty) ? rawQty : fallback.qtyColumn;
    const validWh = headers.includes(rawWh) ? rawWh : fallback.warehouseColumn;
    const validDesc = headers.includes(rawDesc) ? rawDesc : fallback.descriptionColumn;

    return res.json({
      nartColumn: validNart,
      lotColumn: validLot,
      qtyColumn: validQty,
      warehouseColumn: validWh,
      descriptionColumn: validDesc,
      method: 'ai',
      message: 'Colunas identificadas com sucesso pela IA Gemini (leitura de células pelo app)',
    });
  } catch (error) {
    console.warn('Erro ao chamar IA Gemini ou timeout, usando fallback heurístico:', error);
    const fallback = detectColumnsHeuristic(req.body.headers || []);
    return res.json({
      ...fallback,
      method: 'heuristic',
      message: 'Detectado via heurística inteligente (Fallback rápido)',
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
