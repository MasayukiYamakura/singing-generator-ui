import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {webkit} from 'playwright';

const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try{
  browser=await webkit.launch();
  for(const width of [320,390,430]){
    const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/',{waitUntil:'networkidle'});
    await assert.doesNotReject(()=>page.getByRole('navigation',{name:'制作工程'}).waitFor());
    await page.getByRole('button',{name:'3 編集・補正'}).click();
    assert.equal(await page.locator('#songStudio').isVisible(),true);
    assert.equal(await page.locator('#materialsPanel').isVisible(),false);
    assert.match(await page.locator('#studioRuler').innerText(),/0秒/);
    const metrics=await page.evaluate(()=>{
      const el=document.querySelector('.wave-track strong');
      return {fg:getComputedStyle(el).color,bg:getComputedStyle(el.closest('.wave-track')).backgroundColor,
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        culprits:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+2||r.left< -2}).slice(0,12).map(e=>`${e.tagName}#${e.id}.${e.className} ${Math.round(e.getBoundingClientRect().left)}..${Math.round(e.getBoundingClientRect().right)}`),
        hit:document.querySelector('#studioPreview').getBoundingClientRect().height};
    });
    assert.equal(metrics.fg,'rgb(231, 243, 240)');
    assert.equal(metrics.bg,'rgb(18, 35, 43)');
    assert.equal(metrics.overflow,false,`${width}px has horizontal overflow: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.hit>=44);
    await page.getByRole('button',{name:'2 音源を用意'}).click();
    assert.equal(await page.locator('#songSeparation').isVisible(),true);
    await page.getByRole('button',{name:'4 試聴・書き出し'}).click();
    assert.equal(await page.locator('#finishPanel').isVisible(),true);
    await page.getByRole('button',{name:'5 MV制作'}).click();
    assert.equal(await page.locator('#mvStudio').isVisible(),true);
    assert.deepEqual(errors,[]);
    if(width===390){await page.getByRole('button',{name:'3 編集・補正'}).click();await page.screenshot({path:'mobile-workflow.png',fullPage:true});}
    await page.close();
  }
  console.log('Mobile workflow, contrast colors, navigation and reflow passed.');
}finally{await browser?.close();server.kill();}
