import { redirect } from 'next/navigation';

export default function LegacyWarehouseRoute() {
  redirect('/adm-deposito/meus-depositos?aba=croquis');
}
