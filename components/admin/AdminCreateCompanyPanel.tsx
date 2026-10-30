'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import type { CreateCompanyInput } from '../../hooks/usePlatformAdminCompanies';

interface Props {
  creating: boolean;
  onCreate: (input: CreateCompanyInput) => Promise<void>;
  onCreated: (companyName: string) => void;
}

const EMPTY: CreateCompanyInput = {
  legalName: '', tradeName: '', cnpj: '', workspaceId: '',
  responsibleName: '', responsiblePhone: '', companyEmail: '',
  loginEmail: '', initialPassword: '', postalCode: '', address: '',
  addressNumber: '', addressComplement: '', city: '', state: '',
};
const inputClass = 'min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-300/50 focus:ring-2 focus:ring-blue-400/10 disabled:opacity-50';
const digits = (value: string) => value.replace(/\D/g, '');

const maskCnpj = (value: string) => {
  const d = digits(value).slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
};
const maskCep = (value: string) => digits(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
const maskPhone = (value: string) => {
  const d = digits(value).slice(0, 11);
  if (d.length <= 2) return d ? '(' + d : '';
  const prefix = '(' + d.slice(0, 2) + ') ';
  const local = d.slice(2);
  const split = local.length > 8 ? 5 : 4;
  return prefix + (local.length > split ? local.slice(0, split) + '-' + local.slice(split) : local);
};
const suggestId = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

function validCnpj(value: string): boolean {
  const d = digits(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  for (const size of [12, 13]) {
    const weights = size === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const remainder = d.slice(0, size).split('').reduce((sum, n, index) => sum + Number(n) * weights[index], 0) % 11;
    if (Number(d[size]) !== (remainder < 2 ? 0 : 11 - remainder)) return false;
  }
  return true;
}

function Field({ label, value, onChange, required = false, type = 'text', placeholder, autoComplete, maxLength }: {
  label: string; value: string; onChange: (value: string) => void;
  required?: boolean; type?: string; placeholder?: string; autoComplete?: string; maxLength?: number;
}) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-[11px] font-bold text-slate-300">{label}{required && <span className="ml-1 text-blue-300">*</span>}</span>
      <input className={inputClass} type={type} value={value} onChange={(event) => onChange(event.target.value)}
        required={required} placeholder={placeholder} autoComplete={autoComplete} maxLength={maxLength} />
    </label>
  );
}

function Group({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 border-b border-white/10 pb-3">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-400/10 text-[11px] font-black text-blue-200">{number}</span>
        <h4 className="text-sm font-extrabold text-white">{title}</h4>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function AdminCreateCompanyPanel({ creating, onCreate, onCreated }: Props) {
  const [form, setForm] = useState<CreateCompanyInput>(EMPTY);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touchedId, setTouchedId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestedId = useMemo(() => suggestId(form.tradeName || form.legalName), [form.legalName, form.tradeName]);

  useEffect(() => {
    if (!touchedId) setForm((current) => ({ ...current, workspaceId: suggestedId }));
  }, [suggestedId, touchedId]);

  const set = (field: keyof CreateCompanyInput, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!validCnpj(form.cnpj)) return setError('Informe um CNPJ válido, com 14 dígitos verificáveis.');
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(form.workspaceId)) {
      return setError('O workspace deve ter de 3 a 40 caracteres: letras minúsculas, números e hífen.');
    }
    if (digits(form.responsiblePhone).length < 10) return setError('Informe um telefone do responsável com DDD.');
    if (form.postalCode && digits(form.postalCode).length !== 8) return setError('O CEP deve conter 8 dígitos.');
    if (!/^[A-Z]{2}$/.test(form.state)) return setError('Informe uma UF válida com duas letras.');
    if (form.initialPassword.length < 12) return setError('A senha inicial deve ter pelo menos 12 caracteres.');
    if (form.initialPassword !== confirmPassword) return setError('A confirmação da senha não coincide.');

    try {
      const companyName = form.tradeName.trim() || form.legalName.trim();
      await onCreate({
        ...form,
        legalName: form.legalName.trim(), tradeName: form.tradeName.trim(),
        cnpj: digits(form.cnpj), workspaceId: form.workspaceId.trim(),
        responsibleName: form.responsibleName.trim(), responsiblePhone: digits(form.responsiblePhone),
        companyEmail: form.companyEmail.trim().toLowerCase(), loginEmail: form.loginEmail.trim().toLowerCase(),
        postalCode: digits(form.postalCode), address: form.address.trim(),
        addressNumber: form.addressNumber.trim(), addressComplement: form.addressComplement.trim(),
        city: form.city.trim(), state: form.state,
      });
      setForm(EMPTY); // descarta a senha da memória do formulário imediatamente após confirmação
      setConfirmPassword('');
      setTouchedId(false);
      onCreated(companyName);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar a empresa.');
    }
  };

  return (
    <section data-testid="admin-create-company-panel" className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#071225]/90 text-white shadow-xl">
      <header className="border-b border-white/10 px-5 py-6 sm:px-7">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200"><Building2 className="h-4 w-4" /> Provisionamento empresarial</p>
        <h3 className="mt-2 text-xl font-extrabold">Cadastrar empresa</h3>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-400">O cadastro será encaminhado ao servidor administrativo do EMPROVEX. Nenhum dado é salvo diretamente no Firestore pelo navegador.</p>
      </header>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-7 p-5 sm:p-7">
        {error && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-4 text-xs text-rose-100">{error}</div>}
        <fieldset disabled={creating} className="space-y-7 disabled:opacity-65">
          <Group number="01" title="Identificação empresarial">
            <Field required label="Razão social" value={form.legalName} onChange={(v) => set('legalName', v)} autoComplete="organization" />
            <Field label="Nome fantasia" value={form.tradeName} onChange={(v) => set('tradeName', v)} />
            <Field required label="CNPJ" value={form.cnpj} onChange={(v) => set('cnpj', maskCnpj(v))} placeholder="00.000.000/0000-00" maxLength={18} />
            <Field required label="Workspace" value={form.workspaceId} onChange={(v) => { setTouchedId(true); set('workspaceId', suggestId(v)); }} placeholder="identificador-da-empresa" maxLength={40} />
          </Group>
          <Group number="02" title="Responsável e contato">
            <Field required label="Nome completo do responsável" value={form.responsibleName} onChange={(v) => set('responsibleName', v)} autoComplete="name" />
            <Field required label="Telefone / WhatsApp" value={form.responsiblePhone} onChange={(v) => set('responsiblePhone', maskPhone(v))} type="tel" placeholder="(00) 00000-0000" autoComplete="tel" />
            <Field required label="E-mail principal da empresa" value={form.companyEmail} onChange={(v) => set('companyEmail', v)} type="email" autoComplete="email" />
          </Group>
          <Group number="03" title="Acesso inicial">
            <Field required label="E-mail de login" value={form.loginEmail} onChange={(v) => set('loginEmail', v)} type="email" autoComplete="off" />
            <Field required label="Senha inicial (mínimo 12 caracteres)" value={form.initialPassword} onChange={(v) => set('initialPassword', v)} type="password" autoComplete="new-password" />
            <Field required label="Confirmar senha inicial" value={confirmPassword} onChange={setConfirmPassword} type="password" autoComplete="new-password" />
          </Group>
          <Group number="04" title="Localização">
            <Field label="CEP (opcional)" value={form.postalCode} onChange={(v) => set('postalCode', maskCep(v))} placeholder="00000-000" maxLength={9} autoComplete="postal-code" />
            <Field required label="Endereço" value={form.address} onChange={(v) => set('address', v)} autoComplete="street-address" />
            <Field required label="Número" value={form.addressNumber} onChange={(v) => set('addressNumber', v)} />
            <Field label="Complemento" value={form.addressComplement} onChange={(v) => set('addressComplement', v)} />
            <Field required label="Cidade" value={form.city} onChange={(v) => set('city', v)} autoComplete="address-level2" />
            <Field required label="UF" value={form.state} onChange={(v) => set('state', v.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2))} maxLength={2} autoComplete="address-level1" />
          </Group>
          <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
            <p className="flex max-w-lg items-center gap-2 text-xs leading-relaxed text-slate-400"><LockKeyhole className="h-4 w-4 shrink-0 text-blue-300" /> A senha é transmitida apenas ao endpoint de provisionamento. Nunca será exibida na lista de empresas.</p>
            <button type="submit" disabled={creating} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-extrabold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {creating ? 'Cadastrando empresa...' : 'Cadastrar empresa'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
