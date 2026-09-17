'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  HardDrive,
  Loader2,
  LogOut,
  Printer,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';

import { auth } from '../../lib/firebase';
import {
  connectGoogleDrive,
  deleteDrivePocFile,
  downloadDrivePocFile,
  DRIVE_POC_FOLDER_NAME,
  ensureDrivePocFolder,
  listDrivePocFiles,
  MAX_DRIVE_POC_PDF_BYTES,
  type DrivePocFile,
  type GoogleDriveSession,
  uploadDrivePocPdf,
} from '../../lib/googleDrivePoc';

function formatBytes(value?: string): string {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB`;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('pt-BR');
}

type Action = 'connect' | 'refresh' | 'upload' | 'view' | 'print' | 'download' | 'delete' | null;

export default function DrivePocPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [session, setSession] = useState<GoogleDriveSession | null>(null);
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);
  const [files, setFiles] = useState<DrivePocFile[]>([]);
  const [busy, setBusy] = useState<Action>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      if (!currentUser) {
        setSession(null);
        setFolder(null);
        setFiles([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const refreshFiles = async (activeSession: GoogleDriveSession, folderId: string) => {
    const items = await listDrivePocFiles(activeSession.accessToken, folderId);
    setFiles(items);
  };

  const handleConnect = async () => {
    if (!user) return;
    setBusy('connect');
    setMessage(null);
    try {
      const connected = await connectGoogleDrive(user);
      const driveFolder = await ensureDrivePocFolder(connected.accessToken);
      await refreshFiles(connected, driveFolder.id);
      setSession(connected);
      setFolder(driveFolder);
      setMessage({
        type: 'success',
        text: `Google Drive conectado à conta ${connected.email}. A pasta ${driveFolder.name} está pronta.`,
      });
    } catch (error) {
      setSession(null);
      setFolder(null);
      setFiles([]);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Falha ao conectar o Google Drive.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = () => {
    setSession(null);
    setFolder(null);
    setFiles([]);
    setMessage({
      type: 'info',
      text: 'Token temporário descartado desta página. A sessão principal do EMPROVEX permanece ativa.',
    });
  };

  const handleRefresh = async () => {
    if (!session || !folder) return;
    setBusy('refresh');
    setMessage(null);
    try {
      await refreshFiles(session, folder.id);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao atualizar a pasta.' });
    } finally {
      setBusy(null);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !session || !folder) return;

    setBusy('upload');
    setMessage(null);
    try {
      const uploaded = await uploadDrivePocPdf(session.accessToken, folder.id, file);
      await refreshFiles(session, folder.id);
      setMessage({ type: 'success', text: `${uploaded.name} foi enviado diretamente para o Google Drive de teste.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha no upload para o Google Drive.' });
    } finally {
      setBusy(null);
    }
  };

  const fetchFileBlob = async (file: DrivePocFile, action: Exclude<Action, 'connect' | 'refresh' | 'upload' | 'delete' | null>) => {
    if (!session) return;
    setBusy(action);
    setBusyFileId(file.id);
    setMessage(null);

    let target: Window | null = null;
    if (action === 'view' || action === 'print') {
      target = window.open('', '_blank');
      if (!target) {
        setBusy(null);
        setBusyFileId(null);
        setMessage({ type: 'error', text: 'O navegador bloqueou a nova janela. Autorize pop-ups para o EMPROVEX.' });
        return;
      }
      target.opener = null;
      target.document.write('<!doctype html><html><body style="font-family:Arial;display:grid;place-items:center;height:100vh;margin:0">Carregando PDF do Google Drive…</body></html>');
    }

    try {
      const blob = await downloadDrivePocFile(session.accessToken, file.id);
      const objectUrl = URL.createObjectURL(blob);
      if (action === 'download') {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      } else if (target && !target.closed) {
        target.location.replace(objectUrl);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5 * 60_000);
        if (action === 'print') {
          window.setTimeout(() => {
            try {
              target?.focus();
              target?.print();
            } catch {
              // O visualizador nativo continuará aberto para impressão manual.
            }
          }, 1_500);
        }
      }
    } catch (error) {
      target?.close();
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao recuperar o PDF.' });
    } finally {
      setBusy(null);
      setBusyFileId(null);
    }
  };

  const handleDelete = async (file: DrivePocFile) => {
    if (!session || !folder) return;
    if (!window.confirm(`Excluir definitivamente o arquivo de teste “${file.name}” do Google Drive?`)) return;

    setBusy('delete');
    setBusyFileId(file.id);
    setMessage(null);
    try {
      await deleteDrivePocFile(session.accessToken, file.id);
      await refreshFiles(session, folder.id);
      setMessage({ type: 'success', text: `${file.name} foi excluído do Google Drive.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Falha ao excluir o arquivo.' });
    } finally {
      setBusy(null);
      setBusyFileId(null);
    }
  };

  if (loadingAuth) {
    return <main className="min-h-screen grid place-items-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-[#00288e]" /></main>;
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 grid place-items-center p-6">
        <section className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center">
          <HardDrive className="w-12 h-12 mx-auto text-[#00288e] mb-4" />
          <h1 className="text-xl font-black text-slate-900">POC Google Drive</h1>
          <p className="mt-2 text-sm text-slate-600">Entre primeiro no EMPROVEX com a conta do setor. A POC não possui login independente.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00288e] text-white font-bold text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar ao EMPROVEX
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#00288e] hover:underline mb-3">
              <ArrowLeft className="w-4 h-4" /> Voltar ao EMPROVEX
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#00288e] text-white grid place-items-center"><HardDrive className="w-6 h-6" /></div>
              <div>
                <h1 className="text-2xl font-black">POC — Google Drive por setor</h1>
                <p className="text-sm text-slate-500">Ambiente experimental isolado. Não altera os PDFs atuais do Vercel Blob.</p>
              </div>
            </div>
          </div>
          <span className="self-start md:self-auto px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-black">EXPERIMENTAL</span>
        </header>

        {message && (
          <div className={`rounded-2xl border p-4 text-sm font-semibold ${message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
            {message.text}
          </div>
        )}

        <section className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Conta EMPROVEX</p>
            <p className="mt-2 font-black truncate">{user.email}</p>
            <p className="mt-1 text-xs text-slate-500">Firebase UID: {user.uid.slice(0, 12)}…</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Google Drive</p>
            <div className="mt-2 flex items-center gap-2">
              {session ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <div className="w-3 h-3 rounded-full bg-slate-300" />}
              <span className="font-black">{session ? 'Conectado temporariamente' : 'Não conectado'}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">O token não é salvo em Firestore, localStorage ou banco.</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Pasta experimental</p>
            <p className="mt-2 font-black">{folder?.name || DRIVE_POC_FOLDER_NAME}</p>
            <p className="mt-1 text-xs text-slate-500 break-all">{folder ? `ID: ${folder.id}` : 'Será criada automaticamente no primeiro teste.'}</p>
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-[#00288e] mt-0.5" />
              <div>
                <h2 className="font-black">Autorização drive.file</h2>
                <p className="text-sm text-slate-500 max-w-2xl mt-1">A POC solicita acesso somente aos arquivos criados/utilizados pelo EMPROVEX. Ao recarregar esta página, a conexão temporária é descartada e deverá ser refeita.</p>
              </div>
            </div>
            {!session ? (
              <button onClick={handleConnect} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00288e] text-white font-black text-sm disabled:opacity-50">
                {busy === 'connect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />} Conectar Google Drive
              </button>
            ) : (
              <button onClick={handleDisconnect} disabled={busy !== null} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-black text-sm disabled:opacity-50">
                <LogOut className="w-4 h-4" /> Desconectar token da POC
              </button>
            )}
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-lg">Arquivos de teste</h2>
              <p className="text-sm text-slate-500 mt-1">Use apenas PDFs fictícios. Limite da POC: {(MAX_DRIVE_POC_PDF_BYTES / 1024 / 1024).toFixed(0)} MB por arquivo.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleUpload} />
              <button onClick={handleRefresh} disabled={!session || !folder || busy !== null} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 font-bold text-sm disabled:opacity-40">
                {busy === 'refresh' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar
              </button>
              <button onClick={() => inputRef.current?.click()} disabled={!session || !folder || busy !== null} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00288e] text-white font-bold text-sm disabled:opacity-40">
                {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar PDF fictício
              </button>
            </div>
          </div>

          {!session ? (
            <div className="p-10 text-center text-sm text-slate-500">Conecte o Google Drive para iniciar os testes.</div>
          ) : files.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">A pasta está vazia. Envie um PDF fictício para validar o fluxo.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {files.map((file) => {
                const rowBusy = busyFileId === file.id;
                return (
                  <div key={file.id} className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00288e] grid place-items-center shrink-0"><FileText className="w-5 h-5" /></div>
                      <div className="min-w-0">
                        <p className="font-black truncate">{file.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatBytes(file.size)} • criado em {formatDate(file.createdTime)}</p>
                        <p className="text-[10px] text-slate-400 mt-1 truncate">Drive fileId: {file.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => fetchFileBlob(file, 'view')} disabled={busy !== null} className="p-2 rounded-lg border border-blue-100 text-blue-700 disabled:opacity-40" title="Visualizar">{rowBusy && busy === 'view' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}</button>
                      <button onClick={() => fetchFileBlob(file, 'print')} disabled={busy !== null} className="p-2 rounded-lg border border-purple-100 text-purple-700 disabled:opacity-40" title="Imprimir">{rowBusy && busy === 'print' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}</button>
                      <button onClick={() => fetchFileBlob(file, 'download')} disabled={busy !== null} className="p-2 rounded-lg border border-emerald-100 text-emerald-700 disabled:opacity-40" title="Baixar">{rowBusy && busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}</button>
                      <button onClick={() => handleDelete(file)} disabled={busy !== null} className="p-2 rounded-lg border border-red-100 text-red-700 disabled:opacity-40" title="Excluir arquivo de teste">{rowBusy && busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Regra da POC:</strong> não utilize NE/NF reais. Esta etapa valida apenas OAuth, criação da pasta, armazenamento, recuperação e exclusão no Drive. O Vercel Blob continua sendo o provedor oficial dos documentos de produção.
        </aside>
      </div>
    </main>
  );
}
