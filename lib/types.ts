export interface Item {
  id: string;
  name: string;
  unit: string;
  quantity: number; // total quantity committed (empenhada)
  unitPrice: number;
  received: number; // total quantity already received (liquidado/recebido)
}

export interface Empenho {
  id: string;
  supplier: string;
  description: string;
  date: string;
  status: 'Ativo' | 'Encerrado' | 'Sem Movimentação' | 'Urgente';
  items: Item[];
  lastNFDaysAgo?: number;
  pregao?: string; // Pregão vinculado ao empenho
  classification?: 'QR' | 'CALI' | 'PASA';
}

export interface InvoiceItem {
  itemId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Invoice {
  id: string;
  empenhoId: string;
  issueDate: string;
  items: InvoiceItem[];
  totalValue: number;
  supplier: string;
  registeredAt?: string; // Data de cadastramento da nota fiscal
  comissaoDate?: string; // Data de envio para a comissão de recebimento
  tesourariaDate?: string; // Data de envio para a tesouraria
  termoNumero?: number; // Número do termo de recebimento QR
}

export interface MembroComissao {
  postoGraduacao: string;
  nomeCompleto: string;
}

export interface Comissao {
  id: string;
  mesReferencia: string; // 'YYYY-MM'
  boletimNumero: string;
  boletimData: string;
  presidente: MembroComissao;
  auxiliares: MembroComissao[]; // Array de 3 auxiliares
}

export interface Alert {
  id: string;
  type: 'CRÍTICO' | 'ATENÇÃO' | 'ESTOQUE ZERADO';
  title: string;
  subtitle: string;
  description: string;
  date: string;
}
