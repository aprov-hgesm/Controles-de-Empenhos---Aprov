'use client';

import { useCallback, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { db } from '../lib/firebase';
import {
  connectFounderRecoveryDrive,
} from '../lib/googleDriveWorkspace';
import type { FirebaseAuthMetadataBackup } from '../lib/server/firebaseAuthBackup';
import {
  ensureFounderAuthBackupFolder,
  uploadBackupBlob,
} from '../lib/workspaceBackupDrive';

export interface FounderAuthBackupStatus {
  createdAt: string;
  fileId: string;
  fileName: string;
  sizeBytes: number;
  userCount: number;
  mode: 'metadata-only';
  passwordHashIncluded: false;
  updatedBy: string;
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function useFounderAuthBackup(adminUser: User | null) {
  const [creating, setCreating] = useState(false);
  const [lastStatus, setLastStatus] = useState<FounderAuthBackupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createBackup = useCallback(async () => {
    if (!adminUser?.email) {
      throw new Error('Sessão fundadora inválida.');
    }

    setCreating(true);
    setError(null);
    try {
      const idToken = await adminUser.getIdToken();
      const response = await fetch('/api/admin/auth-backup', {
        headers: {
          authorization: `Bearer ${idToken}`,
          accept: 'application/json',
        },
        cache: 'no-store',
      });
      const payload = await response.json() as {
        ok?: boolean;
        backup?: FirebaseAuthMetadataBackup;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.backup) {
        throw new Error(payload.error || 'Não foi possível gerar o backup do Firebase Auth.');
      }

      const serialized = JSON.stringify(payload.backup, null, 2);
      const sha256 = await sha256Text(serialized);
      const session = await connectFounderRecoveryDrive(adminUser.email);
      const folderId = await ensureFounderAuthBackupFolder(session);
      const fileName = `emprovex-auth-backup-${payload.backup.createdAt.replace(/[-:.]/g, '')}.json`;
      const file = await uploadBackupBlob(
        session,
        folderId,
        new Blob([serialized], { type: 'application/json' }),
        fileName,
        {
          emprovexFileType: 'firebase-auth-backup',
          schemaVersion: String(payload.backup.schemaVersion),
          sha256,
          createdAt: payload.backup.createdAt,
        }
      );

      const status: FounderAuthBackupStatus = {
        createdAt: payload.backup.createdAt,
        fileId: file.id,
        fileName: file.name,
        sizeBytes: file.size,
        userCount: payload.backup.userCount,
        mode: 'metadata-only',
        passwordHashIncluded: false,
        updatedBy: adminUser.uid,
      };
      await setDoc(doc(db, 'platformRecoveryStatus', 'auth'), status, { merge: false });
      setLastStatus(status);
      return status;
    } catch (backupError) {
      const message = backupError instanceof Error
        ? backupError.message
        : 'Falha ao salvar o backup de identidades.';
      setError(message);
      throw backupError;
    } finally {
      setCreating(false);
    }
  }, [adminUser]);

  return {
    creating,
    lastStatus,
    error,
    createBackup,
    clearError: () => setError(null),
  };
}
