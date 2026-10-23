/**
 * Rótulo exclusivo de apresentação do croqui 2D.
 * Não modifica os dados persistidos nem a associação do Local.
 * Ex.: "EST-15 - Estante 15" e "EST-15 · Estante 15" -> "EST-15".
 */
export function warehouseCroquiCardCode(label: string): string {
  const head = label.trim().split(/\s+·\s+|\s+-\s+/u, 1)[0]?.trim() ?? '';
  // Usa o código operacional, nunca um id interno loc_/sub_.
  if (/^[A-Z0-9][A-Z0-9._-]{1,31}$/.test(head)
    && !/^(?:loc|sub)_[a-f0-9]{32}$/i.test(head)) return head;
  return 'LOCAL';
}
