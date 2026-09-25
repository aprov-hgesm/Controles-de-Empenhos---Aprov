import { redirect } from 'next/navigation';

export default function WarehouseReportsRoute() {
  redirect('/adm-deposito/controle-de-itens?aba=reports');
}
