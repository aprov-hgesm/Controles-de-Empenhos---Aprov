'use client';

import { useMemo, useState } from 'react';
import { Bot, CheckCircle2, Clipboard, Upload, Warehouse } from 'lucide-react';

import {
  createWarehouseDepot,
  createWarehouseLocation,
  type WarehouseDepotListItem,
  type WarehouseLocationListItem,
} from '../../../lib/warehouse/locationRepository';
import {
  normalizeWarehouseLogicalCode,
  type WarehouseDepotSizeProfile,
  type WarehouseDepotVisualType,
} from '../../../lib/warehouse/location';
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
};

type DepotConfirmation = {
  code: string;
  name: string;
  description: string;
  visualType: WarehouseDepotVisualType;
  sizeProfile: WarehouseDepotSizeProfile;
  reuseExisting: boolean;
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
  const [depotConfirmation, setDepotConfirmation] = useState<DepotConfirmation | null>(null);
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
      setPreview({ payload });
      setDepotConfirmation({
        code: payload.depot.code,
        name: payload.depot.name,
        description: payload.depot.description || '',
        visualType: 'STANDARD',
        sizeProfile: 'MEDIUM',
        reuseExisting: false,
      });
    } catch (error) {
      setPreview(null);
      setDepotConfirmation(null);
      setMessage(errorMessage(error));
    }
  }

  async function importStructure() {
    if (!preview || !depotConfirmation) return;

    setWorking(true);
    setMessage(null);

    let createdDepot = 0;
    let createdLocals = 0;
    let createdSubpositions = 0;
    let skipped = 0;

    try {
      const payload = preview.payload;
      const confirmedCode = normalizeWarehouseLogicalCode(depotConfirmation.code);
      if (!confirmedCode) throw new Error('Informe um código válido para o depósito.');
      const existingDepot = depots.find((item) => item.depot.code === confirmedCode)?.depot;
      let depot = depotConfirmation.reuseExisting ? existingDepot : undefined;

      if (existingDepot && !depotConfirmation.reuseExisting) {
        throw new Error(
          'Já existe um depósito com o código ' + confirmedCode
          + '. Altere o código para criar um novo depósito ou marque a opção de reutilizar o existente.'
        );
      }

      if (!depot) {
        depot = await createWarehouseDepot(workspaceId, {
          code: confirmedCode,
          name: depotConfirmation.name,
          description: depotConfirmation.description || null,
          visualType: depotConfirmation.visualType,
          sizeProfile: depotConfirmation.sizeProfile,
        });
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
      setDepotConfirmation(null);
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
      className="rounded-2xl border border-blue-100/80 bg-white/75 p-5 shadow-sm backdrop-blur-md"
      data-testid="warehouse-r1-ai-import"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-2 text-[#00288e]">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-black text-[#00288e]">
            Importar estrutura via IA externa
          </h3>
          <p className="mt-1 max-w-3xl text-xs font-medium leading-5 text-gray-500">
            O EMPROVEX não envia dados para a IA. Você copia o prompt oficial, usa Gemini,
            ChatGPT ou outra IA externa e cola aqui somente o JSON retornado.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200/80 bg-white/85 p-4 shadow-xs">
          <p className="text-xs font-black text-gray-700">1. Descreva o depósito</p>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={7}
            placeholder="Ex.: Meu depósito tem 10 estantes com 5 prateleiras cada, 5 estantes com 4 prateleiras cada, 2 freezers, 2 geladeiras industriais e 6 paletes."
            className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-black text-[#00288e] transition hover:bg-blue-100"
          >
            <Clipboard className="h-3.5 w-3.5" />
            Copiar prompt para IA
          </button>
        </div>

        <div className="rounded-xl border border-gray-200/80 bg-white/85 p-4 shadow-xs">
          <p className="text-xs font-black text-gray-700">2. Cole o JSON retornado</p>
          <textarea
            value={jsonText}
            onChange={(event) => {
              setJsonText(event.target.value);
              setPreview(null);
              setDepotConfirmation(null);
            }}
            rows={7}
            placeholder='{"version":"emprovex_warehouse_import_v1", ...}'
            className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white p-3 font-mono text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={validateJson}
            disabled={!jsonText.trim()}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#00288e] px-4 text-xs font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Validar e revisar
          </button>
        </div>
      </div>

      {preview && summary && depotConfirmation && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-emerald-200 bg-white p-2 text-emerald-700">
              <Warehouse className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-900">Confirmar dados do depósito</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                Revise os dados antes da importação. O JSON define a estrutura; aqui você confirma a identidade visual e operacional do novo depósito.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wide text-gray-500">Código</span>
              <input
                value={depotConfirmation.code}
                onChange={(event) => setDepotConfirmation((current) => current ? { ...current, code: event.target.value, reuseExisting: false } : current)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-1 xl:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-wide text-gray-500">Nome</span>
              <input
                value={depotConfirmation.name}
                onChange={(event) => setDepotConfirmation((current) => current ? { ...current, name: event.target.value } : current)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wide text-gray-500">Tipo</span>
              <select
                value={depotConfirmation.visualType}
                onChange={(event) => setDepotConfirmation((current) => current ? { ...current, visualType: event.target.value as WarehouseDepotVisualType } : current)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="STANDARD">Depósito padrão</option>
                <option value="CONTAINER">Contêiner</option>
                <option value="COLD_CONTAINER">Contêiner frigorífico</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wide text-gray-500">Porte</span>
              <select
                value={depotConfirmation.sizeProfile}
                onChange={(event) => setDepotConfirmation((current) => current ? { ...current, sizeProfile: event.target.value as WarehouseDepotSizeProfile } : current)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="SMALL">Pequeno</option>
                <option value="MEDIUM">Médio</option>
                <option value="LARGE">Grande</option>
              </select>
            </label>
          </div>

          <label className="mt-3 block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wide text-gray-500">Descrição opcional</span>
            <input
              value={depotConfirmation.description}
              onChange={(event) => setDepotConfirmation((current) => current ? { ...current, description: event.target.value } : current)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {(() => {
            const normalized = normalizeWarehouseLogicalCode(depotConfirmation.code);
            const existing = normalized
              ? depots.find((item) => item.depot.code === normalized)?.depot
              : undefined;
            return existing ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-black text-amber-900">
                  Já existe um depósito com o código {existing.code}: {existing.name}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-amber-800">
                  Para criar um novo depósito, altere o código acima. Só reutilize o existente se a nova estrutura realmente pertencer a ele.
                </p>
                <label className="mt-3 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={depotConfirmation.reuseExisting}
                    onChange={(event) => setDepotConfirmation((current) => current ? { ...current, reuseExisting: event.target.checked } : current)}
                    className="h-4 w-4 accent-[#00288e]"
                  />
                  <span className="text-xs font-black text-amber-900">Reutilizar este depósito existente</span>
                </label>
              </div>
            ) : null;
          })()}

          <div className="mt-4 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
            <p><span className="font-black text-gray-800">{summary.localCount}</span><br />Locais</p>
            <p><span className="font-black text-gray-800">{summary.subpositionCount}</span><br />Subposições</p>
            <p><span className="font-black text-gray-800">{summary.totalCount}</span><br />Total</p>
          </div>

          <button
            type="button"
            onClick={() => void importStructure()}
            disabled={
              working
              || !depotConfirmation.name.trim()
              || !normalizeWarehouseLogicalCode(depotConfirmation.code)
              || Boolean(
                depots.some((item) => item.depot.code === normalizeWarehouseLogicalCode(depotConfirmation.code))
                && !depotConfirmation.reuseExisting
              )
            }
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" />
            {working ? 'Importando…' : 'Confirmar e importar estrutura'}
          </button>
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs font-medium leading-5 text-gray-700">
          {message}
        </div>
      )}
    </section>
  );
}
