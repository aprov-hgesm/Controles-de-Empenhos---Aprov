export interface Item {
  id: string;
  name: string;
  unit: string;
  quantity: number; // total quantity committed (empenhada)
  unitPrice: number;
  received: number; // total quantity already received (liquidado/recebido)
  /** Código exibido como "Item compra" na Nota de Empenho (ex.: 00004), distinto da sequência do item. */
  itemCompraNumber?: string;
  /** Vínculo estável com o material canônico do ADM Depósito, quando já resolvido. */
  warehouseMaterialId?: string;
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

export interface SupplierDirectoryEntry {
  cnpj: string;
  email: string;
}

export interface SupplierContact {
  id: string;
  legalName: string;
  cnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface InvoiceItem {
  itemId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** Material canônico que recebeu a entrada logística deste item. */
  warehouseMaterialId?: string;
  /** Histórico dos movimentos do ledger produzidos por este item de NF. */
  warehouseMovementIds?: string[];
}

export interface WarehouseInvoiceIntegrationState {
  schemaVersion: 'warehouse_invoice_link_v1';
  status: 'integrated';
  workspaceId: string;
  cutoffAt: string;
  revision: number;
  lastMovementIds: string[];
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
  spedNup?: string; // NUP opcional do processo digital no SPED, ex.: 64594.015046/2026-11
  localizacaoAtual?: 'APROVISIONAMENTO' | 'COMISSAO' | 'TESOURARIA'; // Localização operacional atual da NF; datas históricas são preservadas
  notaFiscalPdf?: InvoicePdfDocument;
  notaFiscalPdfVersions?: InvoicePdfDocument[];
  /** Espelho da Nota Fiscal: anexo opcional usado no consolidado de liquidação. */
  espelhoNotaFiscalPdf?: InvoicePdfDocument;
  espelhoNotaFiscalPdfVersions?: InvoicePdfDocument[];
  /** Estado da fatia NF → estoque; ausente para NFs anteriores ao cutoff ou tenants sem o piloto. */
  warehouseIntegration?: WarehouseInvoiceIntegrationState;
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

export interface CronogramaItemOverride {
  itemCompraNumber?: string;
  name?: string;
}

export type CronogramaItemOverrides = Record<string, CronogramaItemOverride>;

export interface CronogramaEmailEnvio {
  enviadoEm: string;
  remetente: string;
  destinatario: string;
  assunto: string;
  messageId: string;
  fonteEmailFornecedor: 'local' | 'global';
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
  /** Ajustes exclusivamente documentais do cronograma, sem alterar o ID interno dos itens. */
  itemOverrides?: CronogramaItemOverrides;
  ultimoEnvioEmail?: CronogramaEmailEnvio;
}
