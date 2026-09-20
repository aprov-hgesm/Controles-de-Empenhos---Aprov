export interface Item {
  id: string;
  name: string;
  unit: string;
  quantity: number; // total quantity committed (empenhada)
  unitPrice: number;
  received: number; // total quantity already received (liquidado/recebido)
}

export type DocumentStorageProvider = 'google-drive';
export type DocumentStorageStatus = 'active' | 'scheduled-for-deletion' | 'deleted';

export interface DocumentStorageRef {
  provider: DocumentStorageProvider;
  status: DocumentStorageStatus;
  /** fileId físico do Google Drive. */
  objectKey: string;
  /** folderId do Google Drive. */
  folderKey?: string;
  /** Workspace proprietário do documento. */
  workspaceId?: string;
  /** Hash SHA-256 de integridade do PDF. */
  sha256?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface EmpenhoPdfDocument {
  id: string;
  /** Identificador lógico preservado para rastreabilidade; o storage é a fonte física. */
  pathname: string;
  originalName: string;
  contentType: 'application/pdf';
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  storage?: DocumentStorageRef;
}

export interface InvoicePdfDocument {
  id: string;
  /** Identificador lógico preservado para rastreabilidade; o storage é a fonte física. */
  pathname: string;
  originalName: string;
  contentType: 'application/pdf';
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  empenhoId: string;
  invoiceId: string;
  storage?: DocumentStorageRef;
}

export interface Empenho {
  id: string;
  supplier: string;
  supplierCnpj?: string; // CNPJ normalizado do fornecedor (14 dígitos)
  description: string;
  date: string;
  status: 'Ativo' | 'Encerrado' | 'Sem Movimentação' | 'Urgente';
  items: Item[];
  lastNFDaysAgo?: number;
  pregao?: string; // Pregão vinculado ao empenho
  classification?: string;
  revision?: number; // Revisão otimista do documento; legado sem campo equivale à revisão 0
  updatedAt?: string;
  updatedBy?: string;
  notaEmpenhoPdf?: EmpenhoPdfDocument;
  notaEmpenhoPdfVersions?: EmpenhoPdfDocument[];
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
  supplierCnpj?: string; // CNPJ normalizado herdado do empenho
  recordKey?: string; // Chave interna do documento Firestore; id continua sendo o número exibido da NF
  registeredAt?: string; // Data de cadastramento da nota fiscal
  termoEmissaoDate?: string; // Data de emissão do termo de recebimento
  comissaoDate?: string; // Data de envio para a comissão de recebimento
  tesourariaDate?: string; // Data de envio para a tesouraria
  termoNumero?: number; // Número do termo de recebimento QR
  numeroNS?: string; // Número identificador do comprovante de liquidação (Nota de Sistema)
  nsUg?: string; // UG emitente da NS, normalizada em 6 dígitos; compõe a identidade canônica da NS
  localizacaoAtual?: 'APROVISIONAMENTO' | 'COMISSAO' | 'TESOURARIA'; // Localização operacional atual da NF; datas históricas são preservadas
  notaFiscalPdf?: InvoicePdfDocument;
  notaFiscalPdfVersions?: InvoicePdfDocument[];
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

export type AlertType = 'INFORMATIVO' | 'CRÍTICO' | 'ATENÇÃO' | 'ESTOQUE ZERADO';
export type AlertStatus = 'NOVO' | 'LIDO' | 'RESOLVIDO' | 'ARQUIVADO';
export type AlertSource = 'EMPENHO' | 'NOTA_FISCAL' | 'SISTEMA';

export interface Alert {
  id: string;
  empenhoId?: string;
  type: AlertType;
  status?: AlertStatus;
  source?: AlertSource;
  title: string;
  subtitle: string;
  description: string;
  date: string;
  createdAt?: string;
  readAt?: string;
  resolvedAt?: string;
  archivedAt?: string;
}

export interface CronogramaEntregaColuna {
  id: string; // e.g. 'remessa_1', 'remessa_2'
  titulo: string; // e.g. '1ª Remessa', '2ª Remessa'
  dataPrevista: string; // 'YYYY-MM-DD'
  observacao?: string;
}

export interface CronogramaEmpenho {
  id: string; // Usually matches the empenhoId
  empenhoId: string;
  dataCriacao: string;
  localEntrega?: string;
  horarioEntrega?: string;
  observacoes?: string;
  responsavelNome?: string;
  responsavelCargo?: string;
  colunasEntregas: CronogramaEntregaColuna[];
  distribuicao: {
    [itemId: string]: {
      [colunaId: string]: number;
    };
  };
}
