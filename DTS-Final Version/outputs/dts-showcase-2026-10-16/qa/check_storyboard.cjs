'use strict';
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),results=[],errors=[];
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
   const p=await browser.newPage({viewport});p.on('pageerror',e=>errors.push(e.message));
   await p.goto(pathToFileURL(path.join(out,'storyboard.html')).href);
   await p.locator('.card').last().waitFor();
   const checks=await p.evaluate(()=>({cards:document.querySelectorAll('.card').length,images:[...document.images].length,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,overflow:document.documentElement.scrollWidth>innerWidth,frameOverlaps:[...document.querySelectorAll('.frame')].filter(f=>f.querySelector('.headline').getBoundingClientRect().bottom>f.querySelector('.safe').getBoundingClientRect().top).length}));
   if(checks.cards!==32||checks.images!==32||checks.brokenImages||checks.overflow||checks.frameOverlaps)throw new Error(JSON.stringify(checks));
   await p.screenshot({path:path.join(__dirname,`html-${viewport.width}.png`)});
   await p.locator('#frame-11').scrollIntoViewIfNeeded();
   await p.screenshot({path:path.join(__dirname,`html-scene11-${viewport.width}.png`)});
   results.push({viewport,...checks});
   await p.goto(pathToFileURL(path.join(out,'boards/scene-29.html')).href);
   await p.locator('.frame img').waitFor();
   const single=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length}));
   if(single.overflow||single.brokenImages)throw new Error(JSON.stringify(single));
   await p.screenshot({path:path.join(__dirname,`html-single-${viewport.width}.png`)});
   await p.getByRole('link',{name:'Next',exact:true}).click();
   if(!p.url().endsWith('scene-30.html'))throw new Error('Next link failed');
   await p.getByRole('link',{name:'Previous',exact:true}).click();
   if(!p.url().endsWith('scene-29.html'))throw new Error('Previous link failed');
   await p.close();
  }
  if(errors.length)throw new Error(errors.join('; '));
  fs.writeFileSync(path.join(__dirname,'html-validation.json'),JSON.stringify({status:'PASS',results,uncaughtErrors:errors,navigation:'PASS'},null,2));
  console.log('Storyboards passed desktop/mobile images, layout and navigation checks.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
