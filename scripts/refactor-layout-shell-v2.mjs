import fs from 'node:fs';
import path from 'node:path';

const pagePath = path.join(process.cwd(), 'app', 'page.tsx');
let page = fs.readFileSync(pagePath, 'utf8');

const requireMarker = (marker, label) => {
  if (!page.includes(marker)) {
    throw new Error(`Refatoracao abortada: marcador ausente (${label}).`);
  }
};

const importAnchor = "import { usePlatformBranding } from '../hooks/usePlatformBranding';\n";
const backgroundStartMarker = '      {/* iOS-style background gradient blobs */}';
const frameworkMarker = '      {/* Main Framework Wrapper */}';
const sidebarStartMarker = '        {/* Backdrop for mobile sidebar */}';
const contentMarker = '        {/* Content Container Area */}';

for (const [marker, label] of [
  [importAnchor, 'imports'],
  [backgroundStartMarker, 'background'],
  [frameworkMarker, 'framework'],
  [sidebarStartMarker, 'sidebar'],
  [contentMarker, 'conteudo'],
]) {
  requireMarker(marker, label);
}

const layoutImports = `${importAnchor}import { AppBackground } from '../components/layout/AppBackground';\nimport { AppHeader } from '../components/layout/AppHeader';\nimport { AppSidebar } from '../components/layout/AppSidebar';\nimport { ToastNotification } from '../components/layout/ToastNotification';\n`;
page = page.replace(importAnchor, layoutImports);

const backgroundStart = page.indexOf(backgroundStartMarker);
const frameworkStart = page.indexOf(frameworkMarker, backgroundStart);
if (backgroundStart < 0 || frameworkStart <= backgroundStart) {
  throw new Error('Refatoracao abortada: intervalo do shell superior invalido.');
}

const upperShell = `      <AppBackground />\n\n      <ToastNotification toast={toast} onClose={() => setToast(null)} />\n\n      <AppHeader\n        customLogo={customLogo}\n        syncing={syncing}\n        userDisplayName={user?.displayName || 'Aprovisionamento HGeSM'}\n        onOpenSidebar={() => setSidebarOpen(true)}\n        onLogoUpload={handleLogoUpload}\n        onRemoveLogo={handleRemoveLogo}\n      />\n\n`;
page = `${page.slice(0, backgroundStart)}${upperShell}${page.slice(frameworkStart)}`;

const sidebarStart = page.indexOf(sidebarStartMarker);
const contentStart = page.indexOf(contentMarker, sidebarStart);
if (sidebarStart < 0 || contentStart <= sidebarStart) {
  throw new Error('Refatoracao abortada: intervalo da sidebar invalido.');
}

const sidebarComponent = `        <AppSidebar\n          activeTab={activeTab}\n          open={sidebarOpen}\n          userDisplayName={user?.displayName || 'Aprovisionamento HGeSM'}\n          onClose={() => setSidebarOpen(false)}\n          onNavigate={(tab) => {\n            setActiveTab(tab);\n            if (tab === 'empenhos') setSelectedEmpenhoDetailId(null);\n            setSidebarOpen(false);\n          }}\n          onLogout={async () => {\n            try {\n              localStorage.removeItem('local_user_session');\n              await signOut(auth);\n              setUser(null);\n              showToast('Você saiu do sistema.', 'info');\n            } catch (err: any) {\n              console.error(err);\n              showToast('Erro ao sair do sistema', 'error');\n            }\n          }}\n        />\n\n`;
page = `${page.slice(0, sidebarStart)}${sidebarComponent}${page.slice(contentStart)}`;

for (const required of [
  '<AppBackground />',
  '<ToastNotification',
  '<AppHeader',
  '<AppSidebar',
  'Content Container Area',
]) {
  if (!page.includes(required)) {
    throw new Error(`Refatoracao abortada: resultado incompleto (${required}).`);
  }
}

for (const removed of [backgroundStartMarker, sidebarStartMarker, '      {/* Top Header / App Bar */}']) {
  if (page.includes(removed)) {
    throw new Error(`Refatoracao abortada: trecho antigo permaneceu (${removed}).`);
  }
}

fs.writeFileSync(pagePath, page, 'utf8');
console.log(`Shell extraido com sucesso. page.tsx: ${page.split('\\n').length} linhas.`);
