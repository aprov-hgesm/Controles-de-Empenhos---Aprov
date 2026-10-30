/**
 * Inicia o segundo Firestore Emulator. Node 24 no Windows não executa
 * npx.cmd diretamente via spawn(): isso gera spawn EINVAL.
 * Executar cmd.exe explicitamente evita shell:true e mantém um comando fixo.
 *
 * Todos os argumentos são literais internos, sem entrada do usuário.
 */
export function warehouseEmulatorLaunch(platform = process.platform, commandProcessor = process.env.ComSpec) {
  const firebaseArgs = [
    '--yes', 'firebase-tools', 'emulators:start',
    '--config', 'firebase.warehouse-e2e-test.json',
    '--project', 'demo-emprovex-security',
    '--only', 'firestore',
  ];
  if (platform === 'win32') {
    return {
      command: commandProcessor || 'cmd.exe',
      args: ['/d', '/s', '/c', ['npx.cmd', ...firebaseArgs].join(' ')],
    };
  }
  return { command: 'npx', args: firebaseArgs };
}
