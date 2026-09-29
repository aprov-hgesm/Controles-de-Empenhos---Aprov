import { redirect } from 'next/navigation';

export default function LegacyWarehouseRoute() {
  redirect('/adm-deposito/controle-de-depositos?aba=estrutura');
}
