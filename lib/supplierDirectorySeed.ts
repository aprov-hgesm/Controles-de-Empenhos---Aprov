import type { SupplierDirectoryEntry } from './types';

/**
 * Pré-cadastro global de contatos de fornecedores.
 * Fonte inicial: relação institucional fornecida em 2026-09-29.
 * Mantém somente CNPJ e e-mail; nenhuma razão social ou pregão é persistido aqui.
 */
export const GLOBAL_SUPPLIER_DIRECTORY_SEED: readonly SupplierDirectoryEntry[] = [
  { cnpj: '59201113000106', email: 'bunkercomercioeservicos@gmail.com' },
  { cnpj: '42846652000191', email: 'csratacado@gmail.com' },
  { cnpj: '48451121000186', email: 'amccomerciodealimentos@gmail.com' },
  { cnpj: '28337943000123', email: 'cacomercioalimentos@gmail.com' },
  { cnpj: '93440717000135', email: 'alimentosfoletto@gmail.com' },
  { cnpj: '88774922000105', email: 'fabiolinassi@hotmail.com' },
  { cnpj: '17579774000111', email: 'acucaraduspoa@gmail.com' },
  { cnpj: '26717739000102', email: 'maildecavalcante056@gmail.com' },
  { cnpj: '56088943000172', email: 'ltda.cruz1224@gmail.com' },
  { cnpj: '52091344000157', email: 'ryansaotiago1@gmail.com' },
  { cnpj: '02483088000175', email: 'jcamaral2002@ibest.com.br' },
  { cnpj: '91360420000134', email: 'agfamiliar@vendaspublicas.com.br' },
  { cnpj: '22469865000134', email: 'unicentralsm@gmail.com' },
  { cnpj: '51584433000172', email: 'cabanhatrescantos@gmail.com' },
  { cnpj: '50113922000183', email: 'fronteira.alimentos2023@gmail.com' },
  { cnpj: '07384861000160', email: 'cruzltda@gmail.com' },
  { cnpj: '04912998000151', email: 'vipaanemgeral@gmail.com' },
  { cnpj: '10626630000120', email: 'manaimcomercial@hotmail.com' },
  { cnpj: '12433700000159', email: 'supra_pr@hotmail.com' },
  { cnpj: '10286929000182', email: 'luiza@bergalli.com.br' },
  { cnpj: '40713112000104', email: 'rancho.distribuidora21@gmail.com' },
  { cnpj: '52188022000120', email: 'ssdiasecialtda@gmail.com' },
  { cnpj: '34926350000103', email: 'itamar@cecconlicitacoes.com.br' },
  { cnpj: '23181735000164', email: 'oenningcontabilidade@gmail.com' },
  { cnpj: '37334256000145', email: 'chefcncbr@gmail.com' },
  { cnpj: '29820515000110', email: 'manatdbatista@gmail.com' },
  { cnpj: '07814284000107', email: 'castelo@casteloalimentos.com.br' },
  { cnpj: '18762737000107', email: 'jocelaine.everestalimentos@gmail.com' },
  { cnpj: '11091547000166', email: 'comercialalimix@hotmail.com' },
  { cnpj: '51504787000160', email: 'gestaoluisjung@gmail.com' },
  { cnpj: '09537392000105', email: 'geovaniealiners@hotmail.com' },
  { cnpj: '02708521000123', email: 'financeiro@jacobyhortifruti.com' },
  { cnpj: '62108332000141', email: 'lucas.citadin@cirox.com.br' },
  { cnpj: '59890062000169', email: 'disprocomercio@gmail.com' },
  { cnpj: '10305273000106', email: 'licitacoes@graosesaude.com' },
  { cnpj: '39649812000106', email: 'contatomccomercio@gmail.com' },
  { cnpj: '09026761000197', email: 'maurivanvicente@gmail.com' },
  { cnpj: '52333210000103', email: 'novax.distribuidoraltda@gmail.com' },
  { cnpj: '37722653000194', email: 'ednpinheiro@gmail.com' },
] as const;
