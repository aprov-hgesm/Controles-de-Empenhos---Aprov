import {spawnSync} from 'node:child_process';
const args=['--test','tests/hospital/core/core.test.mjs'];
const child=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,NODE_ENV:'test'}});
process.exit(child.status??1);
