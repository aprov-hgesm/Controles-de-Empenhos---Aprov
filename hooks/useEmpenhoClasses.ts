'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { db } from '../lib/firebase';
import type { Empenho } from '../lib/types';
import type { ResolvedWorkspaceContext } from '../lib/workspaceContext';
import { isOperationalSectorContext } from '../lib/workspaceContext';
import {
  mergeEmpenhoClassDefinitions,
  normalizeEmpenhoClassCode,
  normalizeEmpenhoClassDescription,
  validateNewEmpenhoClass,
  type EmpenhoClassDefinition,
} from '../lib/empenhoClasses';
import {
  getOperationalSettingsDocumentPath,
  operationalScopeFromContext,
} from '../lib/operationalPaths';

const SETTINGS_DOCUMENT_ID = 'empenhoClasses';

interface EmpenhoClassSettingsDocument {
  schemaVersion: 2;
  classes: EmpenhoClassDefinition[];
  updatedAt: string;
  updatedBy: string;
}

interface UseEmpenhoClassesInput {
  user: User | null;
  workspaceContext: ResolvedWorkspaceContext;
  empenhos: Empenho[];
}

export function useEmpenhoClasses({
  user,
  workspaceContext,
  empenhos,
}: UseEmpenhoClassesInput) {
  const [configuredClasses, setConfiguredClasses] = useState<EmpenhoClassDefinition[]>(() =>
    mergeEmpenhoClassDefinitions([])
  );
  const [savingClassConfig, setSavingClassConfig] = useState(false);

  useEffect(() => {
    if (!user || !isOperationalSectorContext(workspaceContext)) {
      setConfiguredClasses(mergeEmpenhoClassDefinitions([]));
      return;
    }

    const scope = operationalScopeFromContext(workspaceContext);
    const settingsRef = doc(
      db,
      getOperationalSettingsDocumentPath(scope, SETTINGS_DOCUMENT_ID)
    );

    return onSnapshot(
      settingsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setConfiguredClasses(mergeEmpenhoClassDefinitions([]));
          return;
        }

        const data = snapshot.data() as Partial<EmpenhoClassSettingsDocument>;
        setConfiguredClasses(mergeEmpenhoClassDefinitions(data.classes || []));
      },
      (error) => {
        console.warn('Não foi possível carregar a configuração das classes de empenho.', error);
        setConfiguredClasses(mergeEmpenhoClassDefinitions([]));
      }
    );
  }, [user, workspaceContext]);

  const empenhoClasses = useMemo(
    () => mergeEmpenhoClassDefinitions(configuredClasses, empenhos),
    [configuredClasses, empenhos]
  );

  const persistClasses = async (nextClasses: EmpenhoClassDefinition[]) => {
    if (!user || !isOperationalSectorContext(workspaceContext)) {
      throw new Error('Não existe um workspace operacional ativo para salvar as classes.');
    }

    const normalized = mergeEmpenhoClassDefinitions(nextClasses);
    const scope = operationalScopeFromContext(workspaceContext);
    const settingsRef = doc(
      db,
      getOperationalSettingsDocumentPath(scope, SETTINGS_DOCUMENT_ID)
    );

    setSavingClassConfig(true);
    try {
      await setDoc(
        settingsRef,
        {
          schemaVersion: 2,
          classes: normalized,
          updatedAt: new Date().toISOString(),
          updatedBy: user.email || user.uid,
        } satisfies EmpenhoClassSettingsDocument,
        { merge: false }
      );
      setConfiguredClasses(normalized);
    } finally {
      setSavingClassConfig(false);
    }
  };

  const addEmpenhoClass = async (
    codeInput: string,
    descriptionInput: string,
    requiresTermoRecebimento: boolean
  ) => {
    const created = validateNewEmpenhoClass(
      codeInput,
      descriptionInput,
      requiresTermoRecebimento,
      empenhoClasses
    );
    await persistClasses([...configuredClasses, created]);
    return created;
  };

  const updateEmpenhoClass = async (
    codeInput: string,
    descriptionInput: string,
    requiresTermoRecebimento: boolean
  ) => {
    const code = normalizeEmpenhoClassCode(codeInput);
    const description = normalizeEmpenhoClassDescription(descriptionInput);

    if (!code || !description) {
      throw new Error('O código e o descritivo da classe são obrigatórios.');
    }

    const source = mergeEmpenhoClassDefinitions(configuredClasses, empenhos);
    const exists = source.some((item) => item.code === code);
    const updatedDefinition = { code, description, requiresTermoRecebimento };
    const nextClasses = exists
      ? source.map((item) => (
          item.code === code ? updatedDefinition : item
        ))
      : [...source, updatedDefinition];

    await persistClasses(nextClasses);
  };

  return {
    empenhoClasses,
    savingClassConfig,
    addEmpenhoClass,
    updateEmpenhoClass,
  };
}
