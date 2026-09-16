import fs from 'node:fs';
import ts from 'typescript';

const PAGE = 'app/page.tsx';
const HOOK = 'hooks/useOperationalData.ts';
let source = fs.readFileSync(PAGE, 'utf8');
const originalLines = source.split('\n').length;

const hookSource = `'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Alert, Comissao, CronogramaEmpenho, Empenho, Invoice } from '../lib/types';
import { normalizeSupplier } from '../features/empenhos/domain/empenhoHelpers';

/**
 * Fonte de verdade da sessão e das coleções operacionais em tempo real.
 * Mantém o mesmo comportamento de autenticação e subscriptions que antes vivia no page.tsx.
 */
export function useOperationalData() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [empenhos, setEmpenhos] = useState<Empenho[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [cronogramas, setCronogramas] = useState<CronogramaEmpenho[]>([]);

  useEffect(() => {
    localStorage.removeItem('local_user_session');
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setEmpenhos([]);
      setAlerts([]);
      setInvoices([]);
      setComissoes([]);
      return;
    }

    setSyncing(true);

    const unsubscribeEmpenhos = onSnapshot(
      collection(db, 'empenhos'),
      (snapshot) => {
        const fetched = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data() as Empenho;
          return { ...data, supplier: normalizeSupplier(data.supplier) };
        });
        setEmpenhos(fetched);
        setSyncing(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'empenhos');
        setSyncing(false);
      }
    );

    const unsubscribeAlerts = onSnapshot(
      collection(db, 'alerts'),
      (snapshot) => setAlerts(snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as Alert)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'alerts')
    );

    const unsubscribeInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snapshot) => {
        const fetched = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data() as Invoice;
          return { ...data, supplier: normalizeSupplier(data.supplier) };
        });
        setInvoices(fetched);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    const unsubscribeComissoes = onSnapshot(
      collection(db, 'comissoes'),
      (snapshot) => setComissoes(snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as Comissao)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'comissoes')
    );

    const unsubscribeCronogramas = onSnapshot(
      collection(db, 'cronogramas'),
      (snapshot) => setCronogramas(snapshot.docs.map((snapshotDoc) => snapshotDoc.data() as CronogramaEmpenho)),
      (error) => handleFirestoreError(error, OperationType.LIST, 'cronogramas')
    );

    return () => {
      unsubscribeEmpenhos();
      unsubscribeAlerts();
      unsubscribeInvoices();
      unsubscribeComissoes();
      unsubscribeCronogramas();
    };
  }, [user]);

  const signInUser = async () => {
    setSyncing(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } finally {
      setSyncing(false);
    }
  };

  const signOutUser = async () => {
    localStorage.removeItem('local_user_session');
    await signOut(auth);
    setUser(null);
  };

  const getBalanceByClass = (classification: 'QR' | 'CALI' | 'PASA') => {
    const filtered = empenhos.filter((emp) => emp.classification === classification);
    return filtered.reduce((total, emp) => {
      const totalCommitted = emp.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const totalReceived = emp.items.reduce((sum, item) => sum + item.received * item.unitPrice, 0);
      return total + (totalCommitted - totalReceived);
    }, 0);
  };

  const uniquePregaos = Array.from(new Set(empenhos.map((emp) => emp.pregao).filter(Boolean))) as string[];
  const uniqueEmpenhoYears = Array.from(new Set(empenhos.map((emp) => {
    if (!emp.date) return '';
    const parts = emp.date.split('/');
    if (parts.length === 3) return parts[2];
    if (emp.date.includes('-')) return emp.date.split('-')[0];
    return '';
  }).filter(Boolean))).sort((a, b) => b.localeCompare(a)) as string[];
  const uniqueNfMonths = Array.from(new Set(invoices.map((inv) => (
    inv.issueDate && inv.issueDate.length >= 7 ? inv.issueDate.substring(0, 7) : ''
  )).filter(Boolean))).sort((a, b) => b.localeCompare(a));

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (Number.isNaN(date.getTime())) return isoString;
      return date.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const formatDateOnly = (dateStr?: string) => {
    if (!dateStr) return '—';
    if (dateStr.includes('T')) {
      try {
        const date = new Date(dateStr);
        if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('pt-BR');
      } catch {
        // fallback to textual parsing below
      }
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) return \`${'${parts[2]}/${parts[1]}/${parts[0]}'}\`;
    return dateStr;
  };

  return {
    user, loadingAuth, syncing,
    empenhos, setEmpenhos,
    alerts, setAlerts,
    invoices, setInvoices,
    comissoes, setComissoes,
    cronogramas, setCronogramas,
    signInUser, signOutUser,
    getBalanceByClass,
    uniquePregaos, uniqueEmpenhoYears, uniqueNfMonths,
    formatDateTime, formatDateOnly,
  };
}
`.replace(/[ \t]+$/gm, '');

const hookAst = ts.createSourceFile(HOOK, hookSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
if (hookAst.parseDiagnostics.length) throw new Error('Hook operacional inválido: ' + hookAst.parseDiagnostics.map(d => d.messageText).join('; '));
fs.writeFileSync(HOOK, hookSource);

// Simplifica imports que deixaram de pertencer ao orquestrador.
source = source.replace("import React, { useState, useEffect } from 'react';", "import { useState, useEffect } from 'react';");
source = source.replace(/import \{ motion, AnimatePresence \} from 'motion\/react';/, "import { motion } from 'motion/react';");
source = source.replace(/import \{[\s\S]*?\} from 'lucide-react';/, "import { Loader2, LogIn } from 'lucide-react';");
source = source.replace(/import \{ Empenho, Item, Alert, Invoice, InvoiceItem, Comissao, CronogramaEmpenho, CronogramaEntregaColuna, EmpenhoPdfDocument \} from '\.\.\/lib\/types';\n/, '');
source = source.replace("import { EmpenhoDocumentActions } from '../components/EmpenhoDocumentActions';\n", '');
source = source.replace("import { MILITARY_RANKS, normalizeSupplier, PROMPT_EXTRACAO_EMPENHO } from '../features/empenhos/domain/empenhoHelpers';\n", '');
source = source.replace("import { useOperationalViewState } from '../hooks/useOperationalViewState';\n", "import { useOperationalViewState } from '../hooks/useOperationalViewState';\nimport { useOperationalData } from '../hooks/useOperationalData';\n");
source = source.replace(/import \{ INITIAL_EMPENHOS, INITIAL_ALERTS, INITIAL_INVOICES, INITIAL_COMISSOES \} from '\.\.\/lib\/mockData';\n/, '');
source = source.replace(/import jsPDF from 'jspdf';\nimport autoTable from 'jspdf-autotable';\n\n/, '');
source = source.replace(/import \{ signInWithPopup, signOut, onAuthStateChanged, User \} from 'firebase\/auth';\n/, '');
source = source.replace(/import \{ auth, googleProvider, db, OperationType, handleFirestoreError \} from '\.\.\/lib\/firebase';\n/, '');
source = source.replace(/import \{ collection, onSnapshot, doc \} from 'firebase\/firestore';\n/, '');
source = source.replace(/import \{[\s\S]*?\} from '\.\.\/lib\/firebaseSync';\n\n/, '');

// Substitui os estados de autenticação pelo hook operacional.
const authStart = source.indexOf('  // Authentication & Loading state');
const brandingStart = source.indexOf('  const { customLogo, handleLogoUpload, handleRemoveLogo }', authStart);
if (authStart < 0 || brandingStart < 0) throw new Error('Bloco de autenticação não encontrado');
const dataDeclaration = `  const {\n    user, loadingAuth, syncing,\n    empenhos, setEmpenhos, alerts, setAlerts, invoices, setInvoices,\n    comissoes, setComissoes, cronogramas, setCronogramas,\n    signInUser, signOutUser, getBalanceByClass,\n    uniquePregaos, uniqueEmpenhoYears, uniqueNfMonths,\n    formatDateTime, formatDateOnly\n  } = useOperationalData();\n\n`;
source = source.slice(0, authStart) + dataDeclaration + source.slice(brandingStart);

// Remove estados centrais agora pertencentes ao hook, preservando estado de edição da NS.
const coreStart = source.indexOf('  // Core database state');
const nsStart = source.indexOf('  // State for inline editing of Número da NS', coreStart);
if (coreStart < 0 || nsStart < 0) throw new Error('Bloco de dados centrais não encontrado');
source = source.slice(0, coreStart) + source.slice(nsStart);

// Remove helpers, subscriptions, derivados e wrappers legados que agora pertencem ao hook.
const helperStart = source.indexOf('  // Helper to calculate remaining balance by classification');
const viewStateStart = source.indexOf('  const {\n    expandedEmpenhoId', helperStart);
if (helperStart < 0 || viewStateStart < 0) throw new Error('Bloco operacional legado não encontrado');
source = source.slice(0, helperStart) + source.slice(viewStateStart);

// Login/logout passam a chamar as ações do hook, mantendo as mesmas notificações no page.
source = source.replace(/setSyncing\(true\);\n\s*try \{\n\s*await signInWithPopup\(auth, googleProvider\);/, "try {\n                await signInUser();");
source = source.replace(/\n\s*\} finally \{\n\s*setSyncing\(false\);\n\s*\}/, '\n              }');
source = source.replace(/localStorage\.removeItem\('local_user_session'\);\n\s*await signOut\(auth\);\n\s*setUser\(null\);/, 'await signOutUser();');

// Guardrails estruturais.
for (const forbidden of ['onAuthStateChanged(', "collection(db, 'empenhos')", 'signInWithPopup(', 'signOut(auth)', 'const [empenhos, setEmpenhos]', 'const [invoices, setInvoices]']) {
  if (source.includes(forbidden)) throw new Error(`Responsabilidade operacional ainda no page.tsx: ${forbidden}`);
}
for (const required of ['useOperationalData()', 'signInUser()', 'signOutUser()', '<DashboardView', '<CronogramasView', '<MobileNavigation']) {
  if (!source.includes(required)) throw new Error(`Guardrail ausente: ${required}`);
}
const pageAst = ts.createSourceFile(PAGE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (pageAst.parseDiagnostics.length) throw new Error('page.tsx inválido: ' + pageAst.parseDiagnostics.map(d => d.messageText).join('; '));
fs.writeFileSync(PAGE, source.replace(/[ \t]+$/gm, ''));
console.log(`page.tsx: ${originalLines} -> ${source.split('\n').length} linhas.`);
console.log('Autenticação, subscriptions, dados centrais, derivados e formatadores extraídos para useOperationalData.');
