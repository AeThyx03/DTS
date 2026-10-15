'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const port=Number(process.env.SCHEDULE_DEMO_PORT||3131);assert.ok([3130,3131].includes(port),'Only the isolated demo ports are supported');
const base='http://127.0.0.1:'+port,out=path.resolve(__dirname,'..','.test-runs',port===3131?'stress-1000-20261007':'interactive-demo-20261007');
(async()=>{
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'X-Requested-With':'dts','Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Admin@2026'})});assert.equal(login.status,200);
 const headers={cookie:login.headers.get('set-cookie').split(';')[0],'X-Requested-With':'dts','Content-Type':'application/json'};
 const state=(await(await fetch(base+'/api/state',{headers})).json()).state;
 assert.ok(port===3131?state.docs.length===1000:state.docs.filter(d=>d.refNo.startsWith('MOCK-')).length>=9,'Use an isolated mock demo');
 const people=state.users.filter(u=>u.active),types=state.leaveTypes.filter(t=>t.active),existing=new Set(state.schedules.map(s=>s.remarks));
 const date=(year,month,day)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 let created=0,skipped=0,conflicts=0;
 async function add(key,data){const remarks='MOCK-SCHEDULE '+key;if(existing.has(remarks)){skipped++;return;}const r=await fetch(base+'/api/schedules',{method:'POST',headers,body:JSON.stringify({...data,remarks,confirm:true})});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));created++;conflicts+=j.conflicts||0;}
 for(const year of [2025,2026]){
  for(let i=0;i<people.length;i++){
   const person=people[i];
   for(let l=0;l<types.length;l++){
    const month=(i+l*3)%12+1,day=2+(i*3+l)%20;
    await add(`${year}-${person.id}-${types[l].id}`,{type:'leave',personnel:[person.id],leaveTypeId:types[l].id,startDate:date(year,month,day),endDate:date(year,month,day+1+l%3)});
   }
   for(const month of [3,9])await add(`inspection-${year}-${person.id}-${month}`,{type:'inspection',title:'MOCK Site inspection — '+person.name,project:'Regional flood protection and infrastructure assessment '+(i+1),location:'Regional project site '+(i%8+1),startDate:date(year,month,5+i%12),endDate:date(year,month,7+i%12),startTime:'08:00',endTime:'17:00',personnel:[person.id,people[(i+1)%people.length].id]});
  }
  for(let month=1;month<=12;month++)await add(`meeting-${year}-${month}`,{type:'meeting',title:'MOCK Monthly coordination and review meeting',location:'Main Conference Room',organizer:people[month%people.length].id,personnel:people.map(u=>u.id),link:'https://example.com/mock-meeting',startDate:date(year,month,15),endDate:date(year,month,15),startTime:'09:00',endTime:'11:30'});
 }
 // Busy week: all people have every leave type plus inspections and several meetings.
 for(let i=0;i<people.length;i++){
  for(let l=0;l<types.length;l++)await add(`busy-${people[i].id}-${types[l].id}`,{type:'leave',personnel:[people[i].id],leaveTypeId:types[l].id,startDate:date(2026,10,5+l),endDate:date(2026,10,7+l)});
  await add(`busy-inspection-${people[i].id}`,{type:'inspection',title:'MOCK Crowded-week inspection — '+people[i].name,project:'Long project name for dense calendar layout verification',location:'Inspection site — regional drainage improvement project',personnel:[people[i].id,people[(i+1)%people.length].id],startDate:'2026-10-06',endDate:'2026-10-09',startTime:'08:00',endTime:'17:00'});
 }
 for(let i=0;i<12;i++)await add('busy-meeting-'+i,{type:'meeting',title:'MOCK Coordination '+(i+1)+' — long meeting title for crowded calendar verification',personnel:people.filter((u,j)=>j%3===i%3).map(u=>u.id),organizer:people[i%people.length].id,location:'Conference Room '+(i%3+1),link:'https://example.com/mock-meeting/'+i,startDate:'2026-10-07',endDate:'2026-10-07',startTime:'10:00',endTime:'12:00'});
 for(const [key,start,end,type] of [['month-boundary','2026-09-28','2026-10-04','inspection'],['year-boundary','2025-12-29','2026-01-05','meeting'],['next-year','2026-12-28','2027-01-04','inspection']])await add(key,{type,title:'MOCK '+key+' multi-day event',project:'Boundary project',personnel:people.map(u=>u.id),organizer:people[0].id,location:'Regional office',startDate:start,endDate:end,startTime:'08:00',endTime:'17:00'});
 const after=(await(await fetch(base+'/api/state',{headers})).json()).state;
 for(const person of people)for(const type of types)assert.ok(after.schedules.some(s=>s.type==='leave'&&s.leaveTypeId===type.id&&s.personnel.includes(person.id)));
 const summary={created,skipped,confirmedConflictPairs:conflicts,total:after.schedules.length,personnel:people.length,leaveTypes:types.map(t=>t.name),types:Object.fromEntries(['leave','meeting','inspection'].map(t=>[t,after.schedules.filter(s=>s.type===t).length])),busyDate:'2026-10-07',busyDateEvents:after.schedules.filter(s=>s.startDate<='2026-10-07'&&s.endDate>='2026-10-07').length,range:{start:after.schedules.map(s=>s.startDate).sort()[0],end:after.schedules.map(s=>s.endDate).sort().at(-1)}};
 fs.writeFileSync(path.join(out,'schedule-seed.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
