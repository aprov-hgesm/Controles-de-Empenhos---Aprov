import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(path,'utf8');
test('P0 founder admin opens lightweight overview without mounting 3D by default',()=>{
 const page=read('components/admin/PlatformAdminView.tsx');
 assert.match(page,/useState<AdminTabId>\('overview'\)/);
 assert.match(page,/activeTab === 'inicio' && mode === 'premium'/);
 assert.match(page,/onOpenOverview=\{\(\) => changeAdminTab\('overview'\)\}/);
 assert.match(page,/<AdminPanelErrorBoundary/);
 assert.match(page,/<AdminWorldHomePanel/);
 assert.match(page,/activeTab === 'overview'/);
 const route=read('app/admin/page.tsx');
 assert.match(route,/context.status !== 'platformAdmin'/);
 assert.match(route,/onAuthStateChanged\(auth,/);
});
test('P0 scene failure is contained and diagnostic stack preserved locally',()=>{
 const b=read('components/admin/AdminPanelErrorBoundary.tsx');
 assert.match(b,/getDerivedStateFromError/);
 assert.match(b,/EMPROVEX_ADMIN_HOME_RENDER_FAILURE/);
 assert.match(b,/this.props.onOpenOverview/);
 const global=read('components/visual-mode/VisualModeSafetyBoundary.tsx');
 assert.match(global,/EMPROVEX_RENDER_FAILURE/);
 assert.match(global,/info.componentStack/);
 assert.doesNotMatch(b,/fetch\(|sendBeacon|localStorage|setDoc\(/);
});
