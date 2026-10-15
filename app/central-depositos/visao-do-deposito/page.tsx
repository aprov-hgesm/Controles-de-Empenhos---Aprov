import { redirect } from 'next/navigation';

export default function LegacyWarehouseRoute() {
  redirect('/central-depositos/controle-de-depositos?aba=croquis');
}
