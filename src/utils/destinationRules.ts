export type MaterialType = 'CAMPO' | 'COMPRESSA' | 'REVISAR';

export type StockStatus = 'PENDENTE' | 'CONFERIDO' | 'NAO_ENCONTRADO' | 'SOBRA';

export type DestinationWarehouse = 'ARMAZÉM 01' | 'ARMAZÉM 04' | 'ARMAZÉM 06';

export interface DestinationAllocation {
  warehouse: DestinationWarehouse;
  quantity: number;
  reason: string;
}

export type SurplusDecision = 'PENDING_DECISION' | 'ALL_TO_01' | 'SYSTEM_TO_01_SURPLUS_FLAG';

export interface DestinationResult {
  status: StockStatus;
  physicalFound: boolean;
  physicalQty: number;
  difference: number; // físico - sistêmico (negativo = falta, positivo = sobra, 0 = bateu)
  allocations: DestinationAllocation[];
  hasSurplus: boolean;
  surplusQty: number;
  summaryText: string;
}

export interface OfficialFabricRule {
  nart: string;
  description: string;
  type: 'CAMPO' | 'COMPRESSA';
  alvejado: boolean;
  ifMatches: 'ARMAZÉM 01';
  ifDifferenceOrNotFound: 'ARMAZÉM 04' | 'ARMAZÉM 06';
}

/**
 * Tabela Oficial Neve Medical (13 tecidos oficiais)
 * NART completo com sufixos (-00, -01, -09, -11)
 * Alvejados identificados oficialmente: 7 tecidos alvejados e 6 normais (não alvejados)
 */
export const OFFICIAL_NEVE_FABRICS_TABLE: OfficialFabricRule[] = [
  {
    nart: '79092-50040-01',
    description: 'TECIDO CROCHE CAMPO 34CM INA',
    type: 'CAMPO',
    alvejado: false,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 04',
  },
  {
    nart: '79092-50118-00',
    description: 'TECIDO CROCHE 7,5CM VISCOSE RX INA',
    type: 'COMPRESSA',
    alvejado: false,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
  {
    nart: '79092-50119-00',
    description: 'TECIDO CROCHE 7,5CM VISCOSE',
    type: 'COMPRESSA',
    alvejado: false,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
  {
    nart: '79092-50119-01',
    description: 'TECIDO CROCHE 7,5CM 13 FIOS INA',
    type: 'COMPRESSA',
    alvejado: false,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
  {
    nart: '79092-50119-09',
    description: 'TECIDO CROCHE 7,5CM 09 FIOS INA',
    type: 'COMPRESSA',
    alvejado: false,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
  {
    nart: '79092-50119-11',
    description: 'TECIDO CROCHE 7,5CM 11 FIOS INA',
    type: 'COMPRESSA',
    alvejado: false,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
  {
    nart: '79092-50219-00',
    description: 'TECIDO CROCHE 7,5CM ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
  {
    nart: '79092-50220-00',
    description: 'TECIDO CROCHE 10CM ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
  {
    nart: '79092-50221-00',
    description: 'TECIDO CROCHE 10CM RX ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
  {
    nart: '79092-50222-00',
    description: 'TECIDO CROCHE 7,5CM RX ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
  {
    nart: '79092-50223-00',
    description: 'TECIDO CROCHE CAMPO 34CM C/RX ALVEJADO',
    type: 'CAMPO',
    alvejado: true,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 04',
  },
  {
    nart: '79092-50224-00',
    description: 'TECIDO CROCHE CAMPO 20CM ALVEJADO',
    type: 'CAMPO',
    alvejado: true,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 04',
  },
  {
    nart: '79092-50228-00',
    description: 'TECIDO CROCHE 7,5CM 11 FIOS ALVEJADO',
    type: 'COMPRESSA',
    alvejado: true,
    ifMatches: 'ARMAZÉM 01',
    ifDifferenceOrNotFound: 'ARMAZÉM 06',
  },
];

export const OFFICIAL_NEVE_MAP = new Map<string, OfficialFabricRule>(
  OFFICIAL_NEVE_FABRICS_TABLE.map((item) => [item.nart.trim().toUpperCase(), item])
);

/**
 * Retorna o armazém de destino para diferença ou não encontrado
 * CAMPO -> ARMAZÉM 04
 * COMPRESSA -> ARMAZÉM 06
 * (Alvejado não muda o destino: CAMPO vai para o 04 e COMPRESSA para o 06)
 */
export function getDifferenceDestination(type: MaterialType): 'ARMAZÉM 04' | 'ARMAZÉM 06' {
  return type === 'CAMPO' ? 'ARMAZÉM 04' : 'ARMAZÉM 06';
}

/**
 * Verifica se a descrição contém a palavra ALVEJADO
 */
export function isDescriptionAlvejado(description?: string): boolean {
  if (!description) return false;
  const clean = description.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return clean.includes('ALVEJAD');
}

/**
 * Identifica o tipo do material através da descrição segundo a regra:
 * - Se a descrição tiver a palavra CAMPO: tipo CAMPO (diferença vai para o 04)
 * - Se NÃO tiver a palavra CAMPO: tipo COMPRESSA (diferença vai para o 06)
 * - Se a descrição estiver vazia: retorna REVISAR
 */
export function detectMaterialType(description: string): MaterialType {
  if (!description || !description.trim()) return 'REVISAR';
  const clean = description.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (clean.includes('CAMPO')) {
    return 'CAMPO';
  }
  return 'COMPRESSA';
}

export interface ResolvedItemTypeResult {
  type: MaterialType;
  description: string;
  alvejado: boolean;
  fromCatalog: boolean;
  isNewCode: boolean;
  needsDescription: boolean;
  needsConfirmation: boolean;
  destIfMatches: 'ARMAZÉM 01';
  destIfDifferenceOrNotFound: 'ARMAZÉM 04' | 'ARMAZÉM 06';
}

/**
 * REGRA OFICIAL NEVE MEDICAL DE IDENTIFICAÇÃO:
 * 1. Procura primeiro o NART completo na tabela oficial (incluindo -00, -01, -09, -11).
 *    Achou o código: usa o tipo, se é alvejado e o destino da tabela. Nunca troca.
 * 2. Se for código novo (que não está na tabela):
 *    - Se a descrição tiver a palavra CAMPO: tipo CAMPO, diferença vai para o 04.
 *    - Se NÃO tiver a palavra CAMPO: tipo COMPRESSA, diferença vai para o 06.
 *    - Alvejado se a descrição tiver ALVEJADO.
 *    - Salva o código novo no catálogo com o tipo e alvejado, para reconhecer direto da próxima vez.
 *    - Sem descrição: COMPRESSA, não alvejado, etiqueta "Código novo – confira" e editável em Mais > Catálogo.
 */
export function resolveItemType(
  nart: string,
  rawDescription?: string,
  catalogMap?: Map<string, { type: 'CAMPO' | 'COMPRESSA'; description?: string; alvejado?: boolean } | 'CAMPO' | 'COMPRESSA'>
): ResolvedItemTypeResult {
  const cleanNart = (nart || '').trim().toUpperCase();

  // 1. Busca na Tabela Oficial dos 13 tecidos Neve
  if (OFFICIAL_NEVE_MAP.has(cleanNart)) {
    const official = OFFICIAL_NEVE_MAP.get(cleanNart)!;
    return {
      type: official.type,
      description: official.description,
      alvejado: official.alvejado,
      fromCatalog: true,
      isNewCode: false,
      needsDescription: false,
      needsConfirmation: false,
      destIfMatches: 'ARMAZÉM 01',
      destIfDifferenceOrNotFound: official.ifDifferenceOrNotFound,
    };
  }

  // 2. Busca no catálogo adicional persistido
  if (catalogMap && catalogMap.has(cleanNart)) {
    const val = catalogMap.get(cleanNart)!;
    const catType: 'CAMPO' | 'COMPRESSA' = typeof val === 'string' ? val : val.type;
    const catDesc: string = typeof val === 'string' ? rawDescription || '' : (val.description || rawDescription || '');
    const catAlvejado: boolean = typeof val === 'object' && val.alvejado !== undefined
      ? val.alvejado
      : isDescriptionAlvejado(catDesc);
    const destIfDiff = getDifferenceDestination(catType);

    return {
      type: catType,
      description: catDesc,
      alvejado: catAlvejado,
      fromCatalog: true,
      isNewCode: false,
      needsDescription: false,
      needsConfirmation: false,
      destIfMatches: 'ARMAZÉM 01',
      destIfDifferenceOrNotFound: destIfDiff,
    };
  }

  // 3. Código Novo
  const desc = (rawDescription || '').trim();
  if (!desc) {
    // Sem descrição: COMPRESSA, não alvejado, etiqueta "Código novo – confira"
    return {
      type: 'COMPRESSA',
      description: `Produto ${cleanNart} (Código novo – confira)`,
      alvejado: false,
      fromCatalog: false,
      isNewCode: true,
      needsDescription: true,
      needsConfirmation: true,
      destIfMatches: 'ARMAZÉM 01',
      destIfDifferenceOrNotFound: 'ARMAZÉM 06',
    };
  }

  // Com descrição: aplica a regra direta da palavra CAMPO e ALVEJADO
  const inferredType = detectMaterialType(desc);
  const inferredAlvejado = isDescriptionAlvejado(desc);
  const destIfDiff = getDifferenceDestination(inferredType);

  return {
    type: inferredType,
    description: desc,
    alvejado: inferredAlvejado,
    fromCatalog: false,
    isNewCode: true,
    needsDescription: false,
    needsConfirmation: false,
    destIfMatches: 'ARMAZÉM 01',
    destIfDifferenceOrNotFound: destIfDiff,
  };
}

/**
 * Ordena itens:
 * 1º NÃO alvejados (normais) em cima
 * 2º ALVEJADOS sempre embaixo
 * Dentro de cada seção, ordena por NART ascendente
 */
export function sortItemsBySectionAndNart<T extends { alvejado?: boolean; nart: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aAlv = a.alvejado ? 1 : 0;
    const bAlv = b.alvejado ? 1 : 0;
    if (aAlv !== bAlv) {
      return aAlv - bAlv; // 0 (Normais) first, 1 (ALVEJADOS) second
    }
    return a.nart.localeCompare(b.nart);
  });
}

function formatKgDisplay(val: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * CÁLCULO DO DESTINO – NEVE MEDICAL (Tudo em kg, comparação com 2 decimais):
 * - Físico igual ao sistema: tudo vai para o ARMAZÉM 01.
 * - Físico menor que o sistema: o físico vai para o 01 e a diferença vai para o 04 (CAMPO) ou 06 (COMPRESSA).
 * - Não encontrado: tudo vai para o 04 (CAMPO) ou 06 (COMPRESSA).
 * - Físico maior que o sistema: marcar SOBRA e pedir decisão.
 * - Nunca mandar para o 04 ou 06 um item que bateu.
 */
export function computeDestination(
  systemQty: number,
  physicalFound: boolean,
  physicalQty: number = 0,
  type: MaterialType = 'REVISAR',
  surplusDecision: SurplusDecision = 'PENDING_DECISION'
): DestinationResult {
  const normSystemQty = Math.round((Math.max(0, Number(systemQty) || 0)) * 100) / 100;
  const destWarehouse: DestinationWarehouse = getDifferenceDestination(type);

  // 1. Não encontrado: tudo vai para o 04 (CAMPO) ou 06 (COMPRESSA)
  if (!physicalFound) {
    return {
      status: 'NAO_ENCONTRADO',
      physicalFound: false,
      physicalQty: 0,
      difference: -normSystemQty,
      allocations: [
        {
          warehouse: destWarehouse,
          quantity: normSystemQty,
          reason: `Material não localizado. Saldo de ${formatKgDisplay(normSystemQty)} kg vai para o ${destWarehouse}.`,
        },
      ],
      hasSurplus: false,
      surplusQty: 0,
      summaryText: `${formatKgDisplay(normSystemQty)} kg vai para o ${destWarehouse}.`,
    };
  }

  const normPhysicalQty = Math.round((Math.max(0, Number(physicalQty) || 0)) * 100) / 100;
  const diff = Math.round((normPhysicalQty - normSystemQty) * 100) / 100;

  // 2. Físico igual ao sistema: tudo vai para o ARMAZÉM 01 (Nunca mandar para 04 ou 06)
  if (diff === 0) {
    return {
      status: 'CONFERIDO',
      physicalFound: true,
      physicalQty: normPhysicalQty,
      difference: 0,
      allocations: [
        {
          warehouse: 'ARMAZÉM 01',
          quantity: normPhysicalQty,
          reason: 'Físico igual ao sistema. 100% destinado ao ARMAZÉM 01.',
        },
      ],
      hasSurplus: false,
      surplusQty: 0,
      summaryText: `${formatKgDisplay(normPhysicalQty)} kg vai para o ARMAZÉM 01.`,
    };
  }

  // 3. Físico menor que o sistema: físico vai para o 01 e a diferença vai para o 04 (CAMPO) ou 06 (COMPRESSA)
  if (diff < 0) {
    const missingQty = Math.round(Math.abs(diff) * 100) / 100;
    const allocations: DestinationAllocation[] = [];

    if (normPhysicalQty > 0) {
      allocations.push({
        warehouse: 'ARMAZÉM 01',
        quantity: normPhysicalQty,
        reason: `${formatKgDisplay(normPhysicalQty)} kg conferidos fisicamente vão para o ARMAZÉM 01.`,
      });
    }

    allocations.push({
      warehouse: destWarehouse,
      quantity: missingQty,
      reason: `Diferença de falta (${formatKgDisplay(missingQty)} kg) vai para o ${destWarehouse} (${type}).`,
    });

    return {
      status: 'CONFERIDO',
      physicalFound: true,
      physicalQty: normPhysicalQty,
      difference: diff,
      allocations,
      hasSurplus: false,
      surplusQty: 0,
      summaryText: `${formatKgDisplay(normPhysicalQty)} kg vai para o ARMAZÉM 01 e ${formatKgDisplay(missingQty)} kg vai para o ${destWarehouse}.`,
    };
  }

  // 4. Físico maior que o sistema: marcar SOBRA e pedir decisão
  const surplusQty = diff;

  if (surplusDecision === 'ALL_TO_01') {
    return {
      status: 'CONFERIDO',
      physicalFound: true,
      physicalQty: normPhysicalQty,
      difference: diff,
      allocations: [
        {
          warehouse: 'ARMAZÉM 01',
          quantity: normPhysicalQty,
          reason: `Total físico de ${formatKgDisplay(normPhysicalQty)} kg alocado no ARMAZÉM 01 (inclui sobra de +${formatKgDisplay(surplusQty)} kg).`,
        },
      ],
      hasSurplus: true,
      surplusQty,
      summaryText: `Sobra aprovada: todos os ${formatKgDisplay(normPhysicalQty)} kg vão para o ARMAZÉM 01.`,
    };
  }

  if (surplusDecision === 'SYSTEM_TO_01_SURPLUS_FLAG') {
    return {
      status: 'CONFERIDO',
      physicalFound: true,
      physicalQty: normPhysicalQty,
      difference: diff,
      allocations: [
        {
          warehouse: 'ARMAZÉM 01',
          quantity: normSystemQty,
          reason: `Saldo do sistema (${formatKgDisplay(normSystemQty)} kg) destinado ao ARMAZÉM 01.`,
        },
      ],
      hasSurplus: true,
      surplusQty,
      summaryText: `${formatKgDisplay(normSystemQty)} kg vai para o ARMAZÉM 01 e sobra de +${formatKgDisplay(surplusQty)} kg isolada.`,
    };
  }

  // Decisão de Sobra Pendente
  return {
    status: 'SOBRA',
    physicalFound: true,
    physicalQty: normPhysicalQty,
    difference: diff,
    allocations: [
      {
        warehouse: 'ARMAZÉM 01',
        quantity: normSystemQty,
        reason: `Base do sistema (${formatKgDisplay(normSystemQty)} kg) no ARMAZÉM 01 com sobra pendente de +${formatKgDisplay(surplusQty)} kg.`,
      },
    ],
    hasSurplus: true,
    surplusQty,
    summaryText: `Sobra detectada: físico (${formatKgDisplay(normPhysicalQty)} kg) > sistema (${formatKgDisplay(normSystemQty)} kg). Escolha a destinação da sobra.`,
  };
}

export const calculateDestinations = computeDestination;
