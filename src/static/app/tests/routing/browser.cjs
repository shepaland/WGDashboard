const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});const page=await browser.newPage();let saved;
const gateways=[{id:'a',name:'Основной',endpoint_host:'vpn-a.example.net',endpoint_port:51821,enabled:true},{id:'b',name:'Резервный',endpoint_host:'vpn-b.example.net',endpoint_port:51821,enabled:true}];let order=['a','b'];let revision=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/routing/api/v1/**',async route=>{const request=route.request();const path=new URL(request.url()).pathname.split('/v1/')[1];let data={};let code=200;
if(path==='session')data={csrf_token:'test'};
else if(path==='status')data={desired_revision:revision,applied_revision:0,active_gateway_id:'a',agent_available:false,stale:false};
else if(path==='gateways')data={items:gateways,revision};
else if(path==='route-entries')data={items:[],revision};
else if(path==='policy'&&request.method()==='GET')data={revision,policy:{ordered_gateway_ids:order,failback:true,interval_seconds:10,failure_threshold:3,recovery_threshold:12}};
else if(path==='policy'){saved=JSON.parse(request.postData());order=saved.ordered_gateway_ids;revision++;data={revision};}
else {code=503;data={error:'AGENT_UNAVAILABLE'}};
await route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(data)});});
await page.goto('http://127.0.0.1:5178/tests/routing/harness.html');await page.getByRole('button',{name:'Поднять Резервный'}).click();await page.getByRole('button',{name:'Сохранить очередь',exact:true}).click();await page.getByText('Очередь сохранена в черновике.').waitFor();assert.deepEqual(saved.ordered_gateway_ids,['b','a']);assert.equal(await page.getByRole('button',{name:'Проверить изменения',exact:true}).isDisabled(),true);
await page.screenshot({path:'/tmp/awg-routing-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Карта маршрутов',exact:true}).click();await page.screenshot({path:'/tmp/awg-routing-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);assert.deepEqual(errors,[]);console.log('PASS: order save, unavailable apply guard, mobile overflow, browser errors');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
