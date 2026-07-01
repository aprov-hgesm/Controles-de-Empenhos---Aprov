import { Empenho, Alert, Invoice } from './types';

export const INITIAL_EMPENHOS: Empenho[] = [
  {
    id: '2025NE124',
    supplier: 'Juliano Lucio Franciscatto',
    description: 'Medicamentos Controlados',
    date: '12/01/2025',
    status: 'Ativo',
    lastNFDaysAgo: 2,
    pregao: '01/2025',
    classification: 'QR',
    items: [
      {
        id: 'MED-4420-X',
        name: 'Amoxicilina 500mg',
        unit: 'un',
        quantity: 1000,
        unitPrice: 24.50,
        received: 800,
      },
      {
        id: 'MED-1102-Y',
        name: 'Dipirona Monoidratada 500mg/ml',
        unit: 'un',
        quantity: 2000,
        unitPrice: 42.00,
        received: 600,
      },
      {
        id: 'MAT-8891-Z',
        name: 'Soro Fisiológico 0,9% 500ml',
        unit: 'un',
        quantity: 500,
        unitPrice: 68.90,
        received: 500,
      },
    ],
  },
  {
    id: '2024NE0015',
    supplier: 'Distribuidora Alimento S.A.',
    description: 'Frutas e Legumes Processados',
    date: '10/11/2024',
    status: 'Ativo',
    lastNFDaysAgo: 5,
    pregao: '12/2024',
    classification: 'PASA',
    items: [
      {
        id: '45012',
        name: 'Legume processado, tipo mandioca in natura, descascada e picada',
        unit: 'kg',
        quantity: 430,
        unitPrice: 12.40,
        received: 100,
      },
      {
        id: '45889',
        name: 'Frutas frescas, tipo Laranja pera, média, selecionada de primeira',
        unit: 'kg',
        quantity: 1200,
        unitPrice: 5.15,
        received: 0,
      },
    ],
  },
  {
    id: '2025NE089',
    supplier: 'Global Pharma Logistics',
    description: 'Insumos Hospitalares Gerais',
    date: '05/01/2025',
    status: 'Sem Movimentação',
    pregao: '01/2025',
    classification: 'CALI',
    items: [
      {
        id: 'INS-1011-A',
        name: 'Agulha Descartável 25x7',
        unit: 'un',
        quantity: 50000,
        unitPrice: 0.24,
        received: 0,
      },
    ],
  },
  {
    id: '2024NE982',
    supplier: 'Surgical Tech Ltda.',
    description: 'Instrumental Cirúrgico',
    date: '20/12/2024',
    status: 'Encerrado',
    pregao: '02/2024',
    classification: 'QR',
    items: [
      {
        id: 'CIR-5544-B',
        name: 'Bisturi Descartável nº 15',
        unit: 'un',
        quantity: 10000,
        unitPrice: 8.24,
        received: 10000,
      },
    ],
  },
  {
    id: '2025NE145',
    supplier: 'Oxygen Cleaners & Solvents',
    description: 'Saneantes e Álcool em Gel',
    date: '15/01/2025',
    status: 'Ativo',
    pregao: '03/2025',
    classification: 'CALI',
    items: [
      {
        id: 'SAN-9981-C',
        name: 'Álcool Etílico Hidratado 70%',
        unit: 'lt',
        quantity: 2000,
        unitPrice: 7.60,
        received: 640,
      },
    ],
  },
  {
    id: '2024NE902',
    supplier: 'Distribuidora Alimento S.A.',
    description: 'Cesta Básica para Funcionários',
    date: '15/10/2024',
    status: 'Encerrado',
    pregao: '08/2024',
    classification: 'PASA',
    items: [
      {
        id: 'ALM-2211-D',
        name: 'Cesta Básica Tipo A',
        unit: 'un',
        quantity: 100,
        unitPrice: 51.20,
        received: 100,
      },
    ],
  },
];

export const INITIAL_ALERTS: Alert[] = [
  {
    id: 'alt-1',
    type: 'CRÍTICO',
    title: 'NE 2025NE124 - Atraso na Entrega (15 dias)',
    subtitle: 'Fornecedor: MedTech Distribuidora Ltda',
    description: 'Atraso superior ao limite de 14 dias estabelecido em contrato.',
    date: '12:30',
  },
  {
    id: 'alt-2',
    type: 'ATENÇÃO',
    title: 'NE 2024NE982 - Saldo Crítico (8%)',
    subtitle: 'Fornecedor: Hospitalar Soluções S.A.',
    description: 'Material: Seringas Descartáveis 5ml. Necessário reposição urgente.',
    date: 'Ontem',
  },
  {
    id: 'alt-3',
    type: 'ESTOQUE ZERADO',
    title: 'Luva de Procedimento - Estoque Esgotado',
    subtitle: 'Almoxarifado Central - Bloco A',
    description: 'Sem empenhos ativos para este item no momento.',
    date: 'Ontem',
  },
  {
    id: 'alt-4',
    type: 'CRÍTICO',
    title: 'NE 2025NE088 - Recusa de Recebimento',
    subtitle: 'Fornecedor: BioLife Insumos',
    description: 'Divergência técnica entre o pedido e o material entregue.',
    date: '02 Apr',
  },
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: '1029',
    empenhoId: '2025NE124',
    supplier: 'Juliano Lucio Franciscatto',
    issueDate: '2026-06-27',
    items: [
      { itemId: 'MED-4420-X', quantity: 200, unitPrice: 24.50, subtotal: 4900 },
      { itemId: 'MED-1102-Y', quantity: 100, unitPrice: 42.00, subtotal: 4200 },
    ],
    totalValue: 9100,
    registeredAt: '2026-06-27T10:30:00-03:00',
    comissaoDate: '2026-06-27T14:15:00-03:00',
  },
];

export const INITIAL_COMISSOES = [
  {
    id: 'com-1',
    mesReferencia: '2026-06',
    boletimNumero: '124',
    boletimData: '2026-06-01',
    presidente: {
      postoGraduacao: 'Capitão',
      nomeCompleto: 'Carlos Eduardo Souza Silva',
    },
    auxiliares: [
      { postoGraduacao: 'Tenente', nomeCompleto: 'Ana Paula Rodrigues' },
      { postoGraduacao: 'Sargento', nomeCompleto: 'Marcos Vinícius de Oliveira' },
      { postoGraduacao: 'Cabo', nomeCompleto: 'Juliana Mendes Nogueira' },
    ],
  },
  {
    id: 'com-2',
    mesReferencia: '2026-07',
    boletimNumero: '145',
    boletimData: '2026-06-25',
    presidente: {
      postoGraduacao: 'Major',
      nomeCompleto: 'Roberto Albuquerque Pereira',
    },
    auxiliares: [
      { postoGraduacao: 'Capitão', nomeCompleto: 'Fabrício Costa Pinto' },
      { postoGraduacao: 'Tenente', nomeCompleto: 'Luciana Ferreira Borges' },
      { postoGraduacao: 'Sargento', nomeCompleto: 'Douglas Silva Santos' },
    ],
  },
];

