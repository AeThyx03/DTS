'use strict';
process.env.TZ='Asia/Manila';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),os=require('node:os');
const {spawn}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const {prepare,sourceFingerprint,PASSWORD,ACTIONS}=require('./stress-fixtures');
const {functional,measure,client}=require('./stress-checks');
const root=path.resolve(__dirname,'..'),BASE='http://127.0.0.1:3500';
const args=process.argv.slice(2),flags=new Set(args.filter(a=>!a.includes('=')));
const option=(name,fallback)=>{const arg=args.find(a=>a.startsWith('--'+name+'='));return arg?arg.slice(name.length+3):fallback;};
const integer=(name,fallback,min,max)=>{const n=Number(option(name,fallback));if(!Number.isInteger(n)||n<min||n>max)throw new Error('--'+name+' must be an integer from '+min+' to '+max);return n;};
let server,worker,ending=false,monitor,resourceBusy=false,fixture;
const report={startedAt:new Date().toISOString(),base:BASE,node:process.version,platform:process.platform,machine:{cpu:os.cpus()[0]?.model,logicalProcessors:os.cpus().length,ramGiB:os.totalmem()/1073741824},checks:[],failures:[],warnings:[],resources:[],measurements:[],coverage:{}};
let dir;
const log=message=>{const line='['+new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Manila'})+'] '+message;console.log(line);if(dir)fs.appendFileSync(path.join(dir,'runner.log'),line+'\n');};
const check=(name,pass,detail='')=>{report.checks.push({name,pass,detail});if(!pass){report.failures.push({name,detail});log('FAIL '+name+' '+detail);}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(port=0) {return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>{const chosen=s.address().port;s.close(()=>resolve(chosen));});});}
function playwright() {
  const paths=[root,process.env.NODE_PATH,path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')].filter(Boolean);
  try{return require.resolve('playwright',{paths});}catch{return null;}
}
function startServer() {
  const env={...process.env,PORT:'3500',HOST:'127.0.0.1',DATA_DIR:path.join(dir,'data'),TZ:'Asia/Manila',SEED_DEMO:'0',SR_TEST:'0',SR_NOW:'',COOKIE_SECURE:'0',TRUST_PROXY:'0',NODE_ENV:'test'};
  const child=spawn(process.execPath,['server.js'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});server=child;
  child.stdout.on('data',b=>fs.appendFileSync(path.join(dir,'server.log'),b));child.stderr.on('data',b=>fs.appendFileSync(path.join(dir,'server.log'),b));
  child.on('error',error=>{report.failures.push({name:'Server process',detail:error.message});});
  return child;
}
async function ready(child) {
  for(let i=0;i<600;i++){if(child.exitCode!==null||child.signalCode!==null)throw new Error('Stress server exited. See server.log.');try{if((await fetch(BASE+'/healthz',{signal:AbortSignal.timeout(1500)})).ok)return;}catch{}await sleep(100);}
  throw new Error('Stress server did not become ready.');
}
async function stop(child) {
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});
}
function openBrowser() {
  if(process.platform==='win32') {
    const roots=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean);
    const executables=roots.flatMap(folder=>[path.join(folder,'Microsoft/Edge/Application/msedge.exe'),path.join(folder,'Google/Chrome/Application/chrome.exe')]);
    const executable=executables.find(file=>fs.existsSync(file));
    if(!executable){report.warnings.push({name:'Automatic browser opening unavailable',reason:'Microsoft Edge or Google Chrome was not found.'});log('Open '+BASE+' in a private browser window.');return;}
    // Cookies are scoped to hosts, not ports. A separate profile preserves the live DTS sign-in.
    const c=spawn(executable,['--user-data-dir='+path.join(dir,'interactive-browser-profile'),'--no-first-run','--new-window',BASE],{windowsHide:true,stdio:'ignore'});
    c.on('error',e=>log('Open '+BASE+' manually in a private browser window: '+e.message));c.unref();
  }
  else log('Open '+BASE+' in your browser.');
}
async function resourceSample() {
  if(resourceBusy||!server?.pid||server.exitCode!==null||process.platform!=='win32')return;
  resourceBusy=true;
  try {
    const pid=server.pid;
    const result=await new Promise(resolve=>{
      const c=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$p=Get-Process -Id "+pid+" -ErrorAction Stop; [PSCustomObject]@{rssMiB=$p.WorkingSet64/1MB;cpuSeconds=$p.TotalProcessorTime.TotalSeconds;threads=$p.Threads.Count} | ConvertTo-Json -Compress"],{windowsHide:true,stdio:['ignore','pipe','ignore']});let out='';c.stdout.on('data',b=>out+=b);c.on('error',()=>resolve(null));c.on('exit',()=>{try{resolve(JSON.parse(out));}catch{resolve(null);}});
    });if(result)report.resources.push({at:new Date().toISOString(),pid,...result});
  }finally{resourceBusy=false;}
}
async function runRegressions(playwrightPath) {
  const suites=['api','new-rules','rules4','routing-visibility','schedule','schedule.attack','phase10','phase11','workflow','audit-corrections'];
  if(playwrightPath)suites.push('reporting.ui','sidebar-layout.ui','ux.ui','ui-fixes.ui','reference-ux.ui','document.ui','workflow.ui','schedule.ui','schedule.attack.ui','phase11.ui','special-picker.ui','splash','cursor.ui','audit-corrections.ui');
  const port=await freePort();let output='';
  const env={...process.env,TEST_PORT:String(port),NODE_PATH:playwrightPath?path.dirname(path.dirname(playwrightPath))+(process.env.NODE_PATH?path.delimiter+process.env.NODE_PATH:''):process.env.NODE_PATH,WF_BROWSER_CHANNEL:process.platform==='win32'?'msedge':''};
  const code=await new Promise((resolve,reject)=>{
    worker=spawn(process.execPath,['test/run-regression.js',...suites],{cwd:root,env,windowsHide:true});
    worker.stdout.on('data',b=>{output+=b;process.stdout.write(b);fs.appendFileSync(path.join(dir,'regression.log'),b);});
    worker.stderr.on('data',b=>{output+=b;process.stderr.write(b);fs.appendFileSync(path.join(dir,'regression.log'),b);});worker.on('error',reject);worker.on('exit',resolve);
  });worker=null;
  const match=output.match(/Artifacts: (.+)/),resultsFile=match?path.join(match[1].trim(),'results.json'):null;
  const results=resultsFile&&fs.existsSync(resultsFile)?JSON.parse(fs.readFileSync(resultsFile,'utf8')):[];
  report.regressions={port,exitCode:code,suitesRequested:suites.length,results};check('Maintained regression suites',code===0&&results.length===suites.length);
}
function saveReport() {
  report.finishedAt=new Date().toISOString();report.status=report.failures.length?'FAIL':report.warnings.length?'PARTIAL / REVIEW':'PASS';
  report.summary={passedChecks:report.checks.filter(c=>c.pass).length,failedChecks:report.checks.filter(c=>!c.pass).length,peakServerRssMiB:report.resources.length?Math.max(...report.resources.map(r=>r.rssMiB)):null};
  fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2));
  require('./stress-report').write(dir,report);
  fs.writeFileSync(path.join(root,'.stress-tests','3500','latest.json'),JSON.stringify({directory:dir,status:report.status,report:path.join(dir,'report.html'),url:BASE},null,2));
}
async function main() {
  if(flags.has('--help')){console.log('start-dts-stress-test.bat [--documents=6000] [--schedules=1200] [--reports=240] [--requests=30] [--concurrency=1,5,15,30] [--p95-ms=3000] [--source=PATH] [--no-browser] [--no-ui] [--skip-regression] [--exit]');return;}
  const known=/^--(documents|schedules|reports|requests|concurrency|p95-ms|source)=|^--(no-browser|no-ui|skip-regression|exit)$/;
  for(const arg of args)if(!known.test(arg))throw new Error('Unknown option: '+arg);
  const documents=integer('documents',6000,5001,50000),schedules=integer('schedules',1200,100,10000),reports=integer('reports',240,8,2000),requests=integer('requests',30,5,1000),budget=integer('p95-ms',3000,50,120000);
  const concurrency=String(option('concurrency','1,5,15,30')).split(',').map(Number);
  if(!concurrency.length||concurrency.some(n=>!Number.isInteger(n)||n<1||n>100))throw new Error('Concurrency values must be integers from 1 to 100.');concurrency.sort((a,b)=>a-b);
  await freePort(3500).catch(()=>{throw new Error('Port 3500 is already in use. Close the existing stress-test window or service and retry. No existing server was changed.');});
  const source=path.resolve(option('source',path.join(root,'data','dts.sqlite')));
  if(!fs.existsSync(source))throw new Error('Enrolled-staff database not found: '+source);
  dir=path.join(root,'.stress-tests','3500','runs',new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);fs.mkdirSync(dir,{recursive:true});
  log('Run directory: '+dir);log('Source database is read-only: '+source);
  const declared=fs.readFileSync(path.join(root,'server.js'),'utf8').match(/const ACT_TYPES = (\[[^;]+\]);/);
  if(!declared||JSON.stringify(JSON.parse(declared[1].replace(/'/g,'"')))!==JSON.stringify(ACTIONS))throw new Error('Supported document actions changed; update stress payload coverage before running.');
  fixture=prepare({root,dir,source,documents,schedules,reports,log});
  report.dataset={documents,schedules,specialReports:reports,enrolledAccounts:fixture.enrollment.length,activeAccounts:fixture.enrollment.filter(u=>u.active).length,distribution:fixture.distribution,roleFallbacks:fixture.roleFallbacks};
  report.parameterCombinations=require('./stress-combinations').run({fixture,root,dir,check,log});
  log('Starting isolated DTS on '+BASE);await ready(startServer());
  log('STRESS sign-in: '+fixture.admin.username+' / '+PASSWORD);log('All copied accounts use '+PASSWORD+'; live passwords are unchanged.');
  log('Wait for RESULT before editing the test data manually; automated restore/restart checks may require you to sign in again.');
  if(!flags.has('--no-browser'))openBrowser();
  monitor=setInterval(()=>resourceSample().catch(()=>{}),5000);await resourceSample();
  report.coverage.actionMatrix='Every active enrolled account x 10 workflow stages x 16 document actions';
  log('Running account, action matrix, lifecycle, schedule, report and restore checks.');
  const tested=await functional({fixture,dir,log,check});report.functional={restoreMs:tested.restoreMs,matrixCases:tested.matrixCases,matrixFailures:tested.matrixFailures};
  fixture.matrix=[]; // Release large per-probe documents before concurrent state payloads.
  log('Ramping concurrent API requests: '+concurrency.join(', '));
  report.measurements=await measure({clients:tested.clients,admin:tested.admin,concurrency,requests,log,check});
  const slow=report.measurements.filter(m=>m.p95Ms>budget);if(slow.length)report.warnings.push({name:'API latency budget',budgetMs:budget,operations:slow.map(m=>({label:m.label,concurrency:m.concurrency,p95Ms:m.p95Ms}))});
  const pw=playwright();
  if(flags.has('--no-ui')||!pw){report.warnings.push({name:'Browser coverage skipped',reason:flags.has('--no-ui')?'Requested --no-ui':'Playwright not found. Install Playwright and Microsoft Edge to run browser checks.'});report.coverage.browser='SKIPPED';}
  else {log('Testing browser performance and simultaneous enrolled-role sessions.');try{report.browser=await require('./stress-browser').run({playwrightPath:pw,fixture,dir,check,log});report.coverage.browser='Completed';}catch(error){check('Stress browser suite',false,error.stack);}}
  if(flags.has('--skip-regression')){report.warnings.push({name:'Maintained regression suites skipped',reason:'Requested --skip-regression'});report.coverage.regression='SKIPPED';}
  else {log('Running maintained regression suites on separate disposable fixtures.');await runRegressions(flags.has('--no-ui')?null:pw);report.coverage.regression='Completed';if(!pw)report.warnings.push({name:'Maintained browser regressions skipped',reason:'Playwright unavailable'});}
  // Explicit restart checks SQLite persistence, startup migrations and browser bootstrap.
  const before=(await tested.admin('GET','/api/state')).data.state;
  log('Restarting only the stress server to verify persistence.');await stop(server);await ready(startServer());
  const admin=client(fixture.admin);await admin.login();const after=(await admin('GET','/api/state')).data.state;
  report.finalCounts={documents:after.docs.length,schedules:after.schedules.length,specialReports:after.spItems.length};
  for(const key of ['docs','schedules','spItems'])check('Restart preserves '+key,JSON.stringify(before[key])===JSON.stringify(after[key]));
  const db=new DatabaseSync(fixture.file,{readOnly:true});try{check('Stress database integrity',db.prepare('PRAGMA quick_check').all().every(r=>r.quick_check==='ok'));check('Stress database foreign keys',db.prepare('PRAGMA foreign_key_check').all().length===0);}finally{db.close();}
  const sourceAfter=sourceFingerprint(source);report.sourceDatabase={path:source,before:fixture.sourceBefore,after:sourceAfter,unchanged:JSON.stringify(fixture.sourceBefore)===JSON.stringify(sourceAfter)};check('Original business/configuration database unchanged',report.sourceDatabase.unchanged,'Concurrent real edits, if any, are reported rather than overwritten.');
  await resourceSample();clearInterval(monitor);monitor=null;saveReport();
  log('RESULT: '+report.status+' | '+report.summary.passedChecks+' passed checks, '+report.summary.failedChecks+' failed checks');log('Report: '+path.join(dir,'report.html'));log('DTS is ready at '+BASE+' | '+fixture.admin.username+' / '+PASSWORD);
  if(flags.has('--exit')){await stop(server);process.exitCode=report.failures.length?1:0;return;}
  log('Keep this window open. Ctrl+C stops the stress server. Closing it never stops the live DTS on port 3000.');
  await new Promise(resolve=>server.once('exit',resolve));
}
async function shutdown() {
  if(ending)return;ending=true;if(monitor)clearInterval(monitor);
  if(dir&&!report.finishedAt){report.failures.push({name:'Interrupted run',detail:'Stopped before all requested checks finished.'});saveReport();}
  if(worker&&process.platform==='win32')await new Promise(resolve=>{const killer=spawn('taskkill.exe',['/PID',String(worker.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',resolve);killer.on('exit',resolve);});
  else if(worker)await stop(worker);
  await stop(server);process.exit(report.finishedAt&&report.failures.length===0?0:130);
}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
main().catch(async error=>{log(error.stack||error.message);report.failures.push({name:'Runner stopped',detail:error.stack||error.message});if(monitor)clearInterval(monitor);if(dir)saveReport();await stop(worker);await stop(server);process.exitCode=1;});
