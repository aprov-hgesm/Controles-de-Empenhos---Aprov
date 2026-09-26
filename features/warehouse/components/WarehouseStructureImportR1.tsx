'use client';

import { useMemo, useState } from 'react';
import { Bot, CheckCircle2, Clipboard, Upload } from 'lucide-react';

import {
  createWarehouseDepot,
  createWarehouseLocation,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  buildWarehouseStructureAiPrompt,
  parseWarehouseStructureImport,
  summarizeWarehouseStructureImport,
  type WarehouseStructureImportPayload,
} from '../../../lib/warehouse/structureImport';

interface Props {
  workspaceId: string;
  depots: WarehouseDepotListItem[];
  locations: WarehouseLocationListItem[];
  onImported: () => Promise<void> | void;
}

type Preview = {
  payload: WarehouseStructureImportPayload;
  depotExists: boolean;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function WarehouseStructureImportR1({
  workspaceId,
  depots,
  locations,
  onImported,
}: Props) {
  const [description, setDescription] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const summary = useMemo(
    () => (preview ? summarizeWarehouseStructureImport(preview.payload) : null),
    [preview]
  );

  async function copyPrompt() {
    setMessage(null);
    try {
      const prompt = buildWarehouseStructureAiPrompt(description);
      await navigator.clipboard.writeText(prompt);
      setMessage('Prompt oficial copiado. Cole em sua IA externa e depois traga somente o JSON retornado.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  function validateJson() {
    setMessage(null);
    try {
      const payload = parseWarehouseStructureImport(jsonText);
      const depotExists = depots.some((item) => item.depot.code === payload.depot.code);
      setPreview({ payload, depotExists });
    } catch (error) {
      setPreview(null);
      setMessage(errorMessage(error));
    }
  }

  async function importStructure() {
    if (!preview) return;

    setWorking(true);
    setMessage(null);

    let createdDepot = 0;
    let createdLocals = 0;
    let createdSubpositions = 0;
    let skipped = 0;

    try {
      const payload = preview.payload;
      let depot = depots.find((item) => item.depot.code === payload.depot.code)?.depot;

      if (!depot) {
        depot = await createWarehouseDepot(workspaceId, payload.depot);
        createdDepot += 1;
      }

      const knownLocations = locations.filter((item) => item.location.depotId === depot.id);
      const localByCode = new Map(
        knownLocations
          .filter((item) => item.location.kind === 'LOCAL')
          .map((item) => [item.location.code, item.location])
      );

      for (const localInput of payload.locations) {
        let local = localByCode.get(localInput.code);

        if (!local) {
          local = await createWarehouseLocation(workspaceId, {
            kind: 'LOCAL',
            depotId: depot.id,
            code: localInput.code,
            name: localInput.name,
            description: localInput.description,
          });
          localByCode.set(local.code, local);
          createdLocals += 1;
        } else {
          skipped += 1;
        }

        const existingChildren = new Set(
          knownLocations
            .filter(
              (item) =>
                item.location.kind === 'SUBPOSITION'
                && item.location.parentLocationId === local.id
            )
            .map((item) => item.location.code)
        );

        for (const child of localInput.children) {
          if (existingChildren.has(child.code)) {
            skipped += 1;
            continue;
          }

          await createWarehouseLocation(workspaceId, {
            kind: 'SUBPOSITION',
            depotId: depot.id,
            parentLocationId: local.id,
            code: child.code,
            name: child.name,
            description: child.description,
          });
          existingChildren.add(child.code);
          createdSubpositions += 1;
        }
      }

      await onImported();
      setMessage(
        'Importação concluída: '
        + createdDepot + ' depósito(s), '
        + createdLocals + ' Local(is) e '
        + createdSubpositions + ' Subposição(ões) criados. '
        + skipped + ' registro(s) já existente(s) foram preservados.'
      );
      setPreview(null);
      setJsonText('');
    } catch (error) {
      setMessage(
        'Importação interrompida. Os registros já confirmados no Firestore foram preservados. '
        + errorMessage(error)
      );
      await onImported();
    } finally {
      setWorking(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-cyan-300/15 bg-[#07111f]/90 p-5 shadow-[0_20px_60px_rgba(2,8,23,0.28)] backdrop-blur-sm"
      data-testid="warehouse-r1-ai-import"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/[0.08] p-2 text-cyan-200 shadow-inner">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-100">
            Importar estrutura via IA externa
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-300">
            O EMPROVEX não envia dados para a IA. Você copia o prompt oficial, usa Gemini,
            ChatGPT ou outra IA externa e cola aqui somente o JSON retornado.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-white/[0.10] bg-[#0b1726]/90 p-4 shadow-inner">
          <p className="text-xs font-black text-slate-100">1. Descreva o depósito</p>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={7}
            placeholder="Ex.: Meu depósito tem 10 estantes com 5 prateleiras cada, 5 estantes com 4 prateleiras cada, 2 freezers, 2 geladeiras industriais e 6 paletes."
            className="mt-3 w-full resize-y rounded-xl border border-white/[0.12] bg-[#030b15] p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/10"
          />
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/[0.10] px-4 text-xs font-black text-cyan-50 transition hover:border-cyan-200/40 hover:bg-cyan-300/[0.14]"
          >
            <Clipboard className="h-3.5 w-3.5" />
            Copiar prompt para IA
          </button>
        </div>

        <div className="rounded-xl border border-white/[0.10] bg-[#0b1726]/90 p-4 shadow-inner">
          <p className="text-xs font-black text-slate-100">2. Cole o JSON retornado</p>
          <textarea
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value);
              setPreview(null);
            }}
            rows={7}
            placeholder='{"version":"emprovex_warehouse_import_v1", ...}'
            className="mt-3 w-full resize-y rounded-xl border border-white/[0.12] bg-[#030b15] p-3 font-mono text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-blue-300/40 focus:ring-2 focus:ring-blue-300/10"
          />
          <button
            type="button"
            onClick={validateJson}
            disabled={!jsonText.trim()}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-500 px-4 text-xs font-black text-white shadow-[0_8px_24px_rgba(59,130,246,0.22)] transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Validar e revisar
          </button>
        </div>
      </div>

      {preview && summary && (
        <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-400/[0.08] p-4 shadow-inner">
          <p className="text-xs font-black text-emerald-100">Prévia da importação</p>
          <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
            <p>
              <span className="font-black text-slate-200">{preview.payload.depot.code}</span>
              <br />
              {preview.payload.depot.name}
            </p>
            <p>
              <span className="font-black text-slate-200">{summary.localCount}</span>
              <br />
              Locais
            </p>
            <p>
              <span className="font-black text-slate-200">{summary.subpositionCount}</span>
              <br />
              Subposições
            </p>
            <p>
              <span className="font-black text-slate-200">{summary.totalCount}</span>
              <br />
              Total
            </p>
          </div>

          <p className="mt-3 text-[11px] text-slate-300">
            {preview.depotExists
              ? 'O código do depósito já existe; a importação reutilizará esse depósito e preservará códigos já cadastrados.'
              : 'O depósito será criado antes das localizações.'}
          </p>

          <button
            type="button"
            onClick={() => void importStructure()}
            disabled={working}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white shadow-[0_8px_24px_rgba(16,185,129,0.20)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" />
            {working ? 'Importando…' : 'Confirmar importação'}
          </button>
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-sky-300/15 bg-sky-400/[0.06] px-4 py-3 text-xs leading-5 text-slate-200">
          {message}
        </div>
      )}
    </section>
  );
}
