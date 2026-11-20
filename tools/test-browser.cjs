/* npm install --no-save playwright; npx playwright install chromium
   PLAYWRIGHT_MODULE puede apuntar a una instalación aislada. No inicia servidor,
   no hace compras ni carga terceros: responde las rutas desde disco. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.QA_OUTPUT || path.join(ROOT, 'qa');
const types = {'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp4':'video/mp4'};
const errors=[];
const report={viewports:[], interactions:[], externalRequests:[], video:null};
fs.mkdirSync(OUT,{recursive:true});
async function context(browser, options={}) {
 const c=await browser.newContext({reducedMotion:'reduce', ...options});
 await c.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(u.hostname!=='audit.local') {
   report.externalRequests.push(u.hostname);
   return r.fulfill({status:200,contentType:'text/javascript',body:'/* SDK externo simulado; no se envía medición */'});
  }
  const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)) return r.fulfill({status:404,body:'Not found'});
  return r.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
 });
 return c;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  for(const width of [320,390,768,1440]) {
   const c=await context(browser,{viewport:{width,height:900}});
   await c.addInitScript(()=>localStorage.setItem('vjl-consent-v1','essential'));
   const p=await c.newPage(); p.on('pageerror',e=>errors.push(e.message));
   for(const page of fs.readdirSync(ROOT).filter(x=>x.endsWith('.html'))) {
    await p.goto('http://audit.local/'+page);
    const info=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,h1:document.querySelectorAll('h1').length, broken:[...document.images].filter(i=>i.loading!=='lazy'&&(!i.complete||i.naturalWidth===0)).map(i=>i.src)}));
    assert.equal(info.overflow,false,`${page} desborda a ${width}px`);
    assert.equal(info.h1,1,`${page} h1`); assert.deepEqual(info.broken,[],`${page} imágenes`);
    report.viewports.push({page,width,ok:true});
   }
   await p.goto('http://audit.local/index.html');
   if(width===390 || width===1440) {
    await p.screenshot({path:path.join(OUT,`portada-${width}.png`),fullPage:false});
    if(width===1440) await p.screenshot({path:path.join(OUT,'pagina-completa.png'),fullPage:true});
   }
   if(width===390) {
    // El menú superior debe estar siempre visible y la cabecera, fija.
    assert.equal(await p.locator('#nav').isVisible(),true,'menú superior visible');
    await p.locator('#muestra').scrollIntoViewIfNeeded(); await p.waitForTimeout(350);
    const topY=await p.locator('.topbar').evaluate(el=>Math.round(el.getBoundingClientRect().top));
    assert.ok(topY<=2,'la cabecera debe quedar fija arriba al hacer scroll');
    report.interactions.push('Menú superior siempre visible y cabecera fija: OK');
    await p.locator('#faq details').nth(2).locator('summary').click();
    assert.equal(await p.locator('#faq details').nth(2).getAttribute('open'),'');
    report.interactions.push('FAQ: OK');
    await p.locator('#evaluaciones').scrollIntoViewIfNeeded();
    await p.waitForFunction(()=>document.querySelector('.sticky-buy').classList.contains('is-visible'));
    assert.equal(await p.locator('.sticky-buy').evaluate(e=>e.inert),false);
    await p.locator('[data-placement=hero]').scrollIntoViewIfNeeded();
    await p.waitForFunction(()=>!document.querySelector('.sticky-buy').classList.contains('is-visible'));
    assert.equal(await p.locator('.sticky-buy').evaluate(e=>e.inert),true);
    report.interactions.push('Barra móvil y foco cuando se oculta: OK');
    const videoRequests=[]; p.on('request',r=>{if(r.url().endsWith('.mp4'))videoRequests.push(r.url())});
    await p.reload(); assert.equal(videoRequests.length,0,'video precarga antes de pulsar');
    await p.locator('.video-play').click();
    await p.waitForFunction(()=>document.querySelector('video').readyState>=1);
    report.video=await p.locator('video').evaluate(v=>({duration:v.duration,readyState:v.readyState,controls:v.controls,paused:v.paused}));
    assert.equal(report.video.controls,true); assert.ok(report.video.duration>0);
    report.interactions.push('Vídeo metadata/carga al pulsar: OK');
   }
   await c.close();
  }
  assert.equal(report.externalRequests.length,0,'Sin consentimiento no debe haber peticiones a terceros');
  const c=await context(browser,{viewport:{width:390,height:844}}), p=await c.newPage();
  await p.goto('http://audit.local/');
  await p.getByRole('button',{name:'Rechazar Meta',exact:true}).click();
  await p.reload();
  assert.equal(await p.evaluate(()=>localStorage.getItem('vjl-consent-v1')),'essential');
  assert.equal(await p.locator('.consent').count(),0);
  await p.evaluate(()=>window.vjlOpenConsent());
  await p.getByRole('button',{name:'Aceptar Meta',exact:true}).click();
  assert.equal(await p.evaluate(()=>window.vjlTrack('CourseOutboundClick',{placement:'hero'})),true);
  await p.evaluate(()=>window.vjlOpenConsent());
  await p.getByRole('button',{name:'Rechazar Meta',exact:true}).click();
  assert.equal(await p.evaluate(()=>window.vjlTrack('CourseOutboundClick',{placement:'hero'})),false);
  report.interactions.push('Consentimiento real DOM, recarga y revocación (SDK simulado): OK');
  await c.close();
  const nojs=await context(browser,{javaScriptEnabled:false,viewport:{width:390,height:844}}), n=await nojs.newPage();
  await n.goto('http://audit.local/');
  assert.equal(await n.locator('.video-play').isVisible(),false);
  assert.equal(await n.locator('video').getAttribute('controls'),'');
  assert.equal(await n.locator('#nav').isVisible(),true);
  report.interactions.push('Sin JS: menú superior visible; vídeo nativo: OK');
  await nojs.close();
  assert.deepEqual(errors,[]);
  report.jsErrors=errors;
  fs.writeFileSync(path.join(OUT,'browser-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({layouts:report.viewports.length,interactions:report.interactions,video:report.video,jsErrors:errors},null,2));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
