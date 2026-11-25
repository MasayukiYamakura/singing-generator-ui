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
    assert.equal(await page.locator('.studio-lane').count(),2);
    assert.equal(await page.locator('.studio-switch svg').count(),2);
    assert.equal(await page.locator('#studioSoloVocal,#studioSoloBacking,#studioZoom,#studioViewStart').count(),0);
    for(const name of ['Vocal','Backing']){
      const mute=page.locator(`#studioMute${name}`);
      assert.equal(await mute.isChecked(),false);
      await mute.check();assert.equal(await mute.isChecked(),true);
      assert.equal(await page.locator(`#studioMute${name}:checked + span .mute-slash`).evaluate(e=>getComputedStyle(e).display),'block');
      await mute.uncheck();
    }
    await page.locator('#studioOverview').evaluate(el=>{
      el.setPointerCapture=()=>{};
      const r=el.getBoundingClientRect(),send=(type,fraction)=>el.dispatchEvent(new PointerEvent(type,{pointerId:10,pointerType:'touch',clientX:r.left+r.width*fraction,bubbles:true,cancelable:true}));
      send('pointerdown',.04);send('pointermove',.35);send('pointerup',.35);
    });
    assert.notEqual(await page.locator('#studioViewportLabel').innerText(),'表示 0.0〜30.0秒');
    const beforePinch=await page.locator('#studioViewportLabel').innerText();
    await page.locator('#vocalWave').evaluate(el=>{
      el.setPointerCapture=()=>{};
      const r=el.getBoundingClientRect(),send=(type,id,fraction)=>el.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:r.left+r.width*fraction,bubbles:true,cancelable:true}));
      send('pointerdown',1,.25);send('pointerdown',2,.55);send('pointermove',2,.75);send('pointerup',1,.25);send('pointerup',2,.75);
    });
    assert.notEqual(await page.locator('#studioViewportLabel').innerText(),beforePinch);
    await page.locator('[data-select-track="backing"]').click();
    assert.equal(await page.locator('#backingInspector').isVisible(),true);
    assert.equal(await page.locator('#vocalInspector').isVisible(),false);
    await page.locator('[data-select-track="vocal"]').click();
    assert.match(await page.locator('#leaveStatus').innerText(),/待機中/);
    await page.locator('#studioNudgeRight').click();
    assert.equal(await page.locator('#vocalPosition').inputValue(),'0.10');
    assert.match(await page.locator('#studioEditState').innerText(),/未保存/);
    await page.locator('#vocalTrimStart').fill('0.50');
    await page.locator('#vocalTrimStart').press('Tab');
    assert.equal(await page.locator('#vocalPosition').inputValue(),'0.60');
    await page.locator('#studioUndo').click();
    assert.equal(await page.locator('#vocalPosition').inputValue(),'0.10');
    const metrics=await page.evaluate(()=>{
      const el=document.querySelector('.studio-track-select');
      return {fg:getComputedStyle(el).color,bg:getComputedStyle(el.closest('.studio-shell')).backgroundColor,
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        culprits:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+2||r.left< -2}).slice(0,12).map(e=>`${e.tagName}#${e.id}.${e.className} ${Math.round(e.getBoundingClientRect().left)}..${Math.round(e.getBoundingClientRect().right)}`),
        hit:document.querySelector('#studioPreview').getBoundingClientRect().height,
        mutes:[...document.querySelectorAll('.studio-switch span')].map(e=>e.getBoundingClientRect().height)};
    });
    assert.equal(metrics.fg,'rgb(125, 240, 192)');
    assert.equal(metrics.bg,'rgb(13, 27, 33)');
    assert.equal(metrics.overflow,false,`${width}px has horizontal overflow: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.hit>=44);
    assert.ok(metrics.mutes.every(h=>h>=44));
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

