'use client';

import { useEffect, useState } from 'react';

import type { Invoice } from '../../../lib/types';
import {
  loadInvoicesForEmpenho,
  loadInvoicesForSupplier,
} from '../../../lib/historicalInvoiceQueries';

type HistoricalInvoiceMode = 'empenho' | 'supplier';

interface UseHistoricalInvoicesInput {
  mode: HistoricalInvoiceMode;
  keyValue: string;
  enabled?: boolean;
}

export function useHistoricalInvoices({
  mode,
  keyValue,
  enabled = true,
}: UseHistoricalInvoicesInput) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedKey = keyValue.trim();
    if (!enabled || !normalizedKey) {
      setInvoices([]);
      setLoading(false);
      setTruncated(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const load = mode === 'empenho'
      ? loadInvoicesForEmpenho(normalizedKey)
      : loadInvoicesForSupplier(normalizedKey);

    void load
      .then((result) => {
        if (!active) return;
        setInvoices(result.invoices);
        setTruncated(result.truncated);
      })
      .catch((loadError) => {
        if (!active) return;
        setInvoices([]);
        setTruncated(false);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível consultar o histórico solicitado.'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, keyValue, mode]);

  return {
    invoices,
    loading,
    truncated,
    error,
  };
}
