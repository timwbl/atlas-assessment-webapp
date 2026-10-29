const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compiled = path.resolve(process.argv[2]);
const {validateAssessment} = require(path.join(compiled, 'assessmentValidator.js'));
const {summarizeAssessment, normalizeLoadedAssessmentSummaries} = require(path.join(compiled, 'assessmentSummary.js'));
const clientPath = path.join(compiled, 'assessmentClient.js');
const cache = require(path.join(compiled, 'assessmentCache.js'));
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/assessments/J2_Block1_KV02_03_ATLAS_Assessment.json')));
const validated = validateAssessment(raw);
assert.equal(validated.ok, true);
const full = {file:'sample.json', assessment:validated.value, errors:[], warnings:[]};
const summary = { ...full, assessment:summarizeAssessment(validated.value) };

// Reproduce the production incident: a full response cached as a summary.
const recovered = normalizeLoadedAssessmentSummaries([full]);
assert.deepEqual(recovered, [summary]);
assert.equal(recovered[0].assessment.questionCount, 20);
assert.ok(Array.isArray(recovered[0].assessment.tags));
assert.deepEqual([...recovered[0].assessment.tags], summary.assessment.tags);
assert.equal('questions' in recovered[0].assessment, false);
assert.deepEqual(normalizeLoadedAssessmentSummaries([summary]), [summary]);
assert.deepEqual(normalizeLoadedAssessmentSummaries(null), []);
assert.equal(normalizeLoadedAssessmentSummaries([{...full,assessment:null}])[0].assessment,null);
assert.equal(normalizeLoadedAssessmentSummaries([{...summary,assessment:{...summary.assessment,active:false}}])[0].assessment,null);
assert.equal(normalizeLoadedAssessmentSummaries([{...summary,assessment:{...summary.assessment,questionCount:NaN,questionIds:[]}}])[0].assessment,null);
const missingTags = normalizeLoadedAssessmentSummaries([{...summary,assessment:{...summary.assessment,tags:undefined}}]);
assert.deepEqual(missingTags[0].assessment.tags,[]);

// Every currently shipped full assessment must be safe for overview consumers.
for (const file of fs.readdirSync(path.join(__dirname,'../public/assessments')).filter(x=>x.endsWith('.json'))) {
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/assessments',file)));
 const v=validateAssessment(source);
 if(!v.ok || v.value.active===false)continue;
 const item=normalizeLoadedAssessmentSummaries([{file,assessment:v.value}])[0];
 assert.ok(item.assessment,file);
 assert.equal(item.assessment.questionCount,v.value.questions.length,file);
 assert.ok(Array.isArray(item.assessment.tags),file);
 assert.ok(Array.isArray(item.assessment.questionIds),file);
}

function client(){delete require.cache[require.resolve(clientPath)];return require(clientPath);}
async function main(){
 const originalFetch=global.fetch;
 const originalRead=cache.readCachedAssessmentSummaries;
 try {
  cache.readCachedAssessmentSummaries=async()=>[];
  for(const response of [[summary],[full]]){
   global.fetch=async url=>{
    assert.equal(url,'/api/assessments/summaries');
    return {ok:true,json:async()=>({assessments:response})};
   };
   assert.deepEqual(await client().loadAssessmentSummaries(),[summary]);
  }
  // Existing offline caches may have the same legacy full-response shape.
  cache.readCachedAssessmentSummaries=async()=>[full];
  global.fetch=async()=>{throw new Error('offline');};
  assert.deepEqual(await client().loadAssessmentSummaries(),[summary]);
  // Reject malformed network data and let a later request recover.
  cache.readCachedAssessmentSummaries=async()=>[];
  global.fetch=async()=>({ok:true,json:async()=>({assessments:[{assessment:{id:'broken'}}]})});
  const retry=client();
  await assert.rejects(retry.loadAssessmentSummaries(),/keine gültigen Übersichten/);
  global.fetch=async()=>({ok:true,json:async()=>({assessments:[summary]})});
  assert.deepEqual(await retry.loadAssessmentSummaries(),[summary]);
  console.log('Assessment client regression tests passed (HTTP shapes, offline cache, retry, all shipped sets).');
 } finally {global.fetch=originalFetch;cache.readCachedAssessmentSummaries=originalRead;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
