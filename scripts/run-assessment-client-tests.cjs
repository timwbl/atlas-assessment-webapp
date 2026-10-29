const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-client-tests-'));
try {
 execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'lib/assessmentClient.ts','--strict','--module','commonjs','--moduleResolution','node','--target','es2020','--outDir',directory,'--esModuleInterop','--skipLibCheck','--noEmit','false'],{stdio:'inherit'});
 execFileSync(process.execPath,[path.join(__dirname,'assessment-client-test.cjs'),directory],{stdio:'inherit'});
} finally {fs.rmSync(directory,{recursive:true,force:true});}
