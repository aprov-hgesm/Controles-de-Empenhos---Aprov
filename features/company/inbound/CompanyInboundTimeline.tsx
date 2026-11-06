'use client';
import type {PurchaseEvent} from '../../../lib/company/purchases/domain';
const labels:Record<PurchaseEvent['kind'],string>={
  'purchase.sent':'Envio confirmado pelo operador',
  'purchase.reply':'Resposta do fornecedor',
  'purchase.received':'Recebimento informado — pendente de lançamento W7',
  'purchase.rescheduled':'Cronograma atualizado',
  'purchase.cancelled':'Compra cancelada ou recusada',
};
export function CompanyInboundTimeline({events}:{events:PurchaseEvent[]}){
  if(!events.length)return <p role="status">Ainda não existem eventos registrados para esta compra.</p>;
  return <ol className="space-y-3" aria-label="Histórico de abastecimento">
    {events.map(e=><li key={e.id} className="rounded-lg border p-3">
      <strong>{labels[e.kind]}</strong>
      <p className="text-sm opacity-75">{new Date(e.occurredAt).toLocaleString('pt-BR')} · revisão {e.purchaseRevision}</p>
      {e.receiptReference&&<p>Comprovante: {e.receiptReference}</p>}
      {e.receivedDeltas.map(delta=><p key={delta.lineId} className="text-sm">
        Item {delta.lineId}: {delta.quantity.value} {delta.quantity.unit} · entrada física ainda não contabilizada
      </p>)}
    </li>)}
  </ol>;
}
