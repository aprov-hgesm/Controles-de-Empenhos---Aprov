import { redirect } from 'next/navigation';

export default function WarehouseReportsRoute() {
  redirect('/central-depositos/controle-de-itens?aba=reports');
}
