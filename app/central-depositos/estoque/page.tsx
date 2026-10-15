import { redirect } from 'next/navigation';

export default function LegacyWarehouseRoute() {
  redirect('/central-depositos/controle-de-itens?aba=stock');
}
