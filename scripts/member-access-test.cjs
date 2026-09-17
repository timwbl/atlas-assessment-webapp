const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { NextRequest } = require('next/server');
function load(path, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (name) => mocks[name] || require(name), Request, Response, URL, process, crypto: globalThis.crypto, TextEncoder, Uint8Array, btoa });
  return module.exports;
}
(async () => {
  const access = load('lib/memberAccess.ts');
  for (const profile of [null, {}, { role: 'student', close_circle: false }, { role: 'student', close_circle: 'true' }]) assert.equal(access.hasPriorityAccess(profile), false);
  assert.equal(access.hasPriorityAccess({ role: 'admin' }), true);
  assert.equal(access.hasPriorityAccess({ role: 'student', close_circle: true }), true);
  for (const path of ['//evil.test', '/\\evil.test', '/maintenance?returnTo=/', 'https://evil.test']) assert.equal(access.safeReturnPath(path), '/');
  assert.equal(access.safeReturnPath('/assessments?year=2'), '/assessments?year=2');
  let auth = null;
  let enabled = true;
  const server = { authenticateRequest: async (request) => request.headers.get('authorization') === 'Bearer valid' ? auth : null };
  const { middleware } = load('middleware.ts', {
    './lib/serverAuth': server, './lib/memberAccess': access,
    './lib/maintenance': { getMaintenanceStatus: async () => ({ enabled, source: 'database' }), maintenanceEnabled: () => false }
  });
  const request = (cookie = '', path = '/') => new NextRequest(`https://atlas.test${path}`, { headers: cookie ? { cookie: `${access.MEMBER_SESSION_COOKIE}=${cookie}` } : {} });
  assert.equal((await middleware(request())).status, 307);
  assert.equal((await middleware(request('forged'))).status, 307);
  auth = { token: 'valid', profile: { role: 'student', close_circle: false } };
  assert.equal((await middleware(request('valid'))).status, 307);
  auth.profile.close_circle = true;
  assert.equal((await middleware(request('valid'))).status, 200);
  auth.profile.close_circle = false;
  assert.equal((await middleware(request('valid'))).status, 307, 'revocation must apply to existing cookies');
  auth.profile.role = 'admin';
  assert.equal((await middleware(request('valid'))).status, 200);
  auth = null;
  assert.equal((await middleware(request('valid'))).status, 307, 'expired token must fail closed');
  assert.equal((await middleware(request('', '/auth/callback'))).status, 200);
  assert.equal((await middleware(request('', '/api/maintenance/member'))).status, 200);
  enabled = false;
  assert.equal((await middleware(request())).status, 200);
  const route = load('app/api/maintenance/member/route.ts', { '@/lib/serverAuth': server, '@/lib/memberAccess': access });
  const post = () => route.POST(new Request('https://atlas.test/api/maintenance/member', { method: 'POST', headers: { Authorization: 'Bearer valid' } }));
  assert.equal((await post()).status, 401);
  auth = { token: 'valid', profile: { role: 'student', close_circle: false } };
  assert.match((await post()).headers.get('set-cookie'), /Max-Age=0/i);
  auth.profile.close_circle = true;
  const response = await post();
  assert.equal((await response.json()).priority, true);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(response.headers.get('set-cookie'), /SameSite=lax/i);
  assert.match((await route.DELETE()).headers.get('set-cookie'), /Max-Age=0/i);
  console.log('Member access: ordinary/admin/close-circle, revocation, invalid sessions, cookies and safe redirects passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
