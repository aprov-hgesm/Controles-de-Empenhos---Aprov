import { redirect } from 'next/navigation';

export default function LegacyWarehouseRoute() {
  redirect('/central-depositos/cadastro-de-itens?aba=siscofis');
}
