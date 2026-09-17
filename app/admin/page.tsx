'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

import { PlatformAdminView } from '../../components/admin/PlatformAdminView';
import { usePlatformAdminDirectory } from '../../hooks/usePlatformAdminDirectory';
import { auth } from '../../lib/firebase';
import { resolveWorkspaceContext } from '../../lib/workspaceContext';

export default function PlatformAdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser || null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const context = resolveWorkspaceContext(user?.email);
  const adminDirectory = usePlatformAdminDirectory(
    context.status === 'platformAdmin' ? context.email : null
  );

  useEffect(() => {
    if (loading) return;

    if (!user || context.status !== 'platformAdmin') {
      window.location.replace('/');
    }
  }, [context.status, loading, user]);

  if (loading || !user || context.status !== 'platformAdmin') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
          Validando acesso administrativo...
        </p>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
    window.location.replace('/');
  };

  return (
    <PlatformAdminView
      adminEmail={context.email}
      workspaces={adminDirectory.directory.workspaces}
      loadingDirectory={adminDirectory.loading}
      directoryError={adminDirectory.error}
      creatingSector={adminDirectory.creating}
      onCreateSector={async (input) => {
        await adminDirectory.createSector(input);
      }}
      onLogout={handleLogout}
    />
  );
}
