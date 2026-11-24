const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
(async()=>{
 console.log("STEP 0 launch");
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 const page=await browser.newPage();
 console.log("STEP 1 browser ready");
 const errors=[],failed=[],apiCalls=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
 await page.setRequestInterception(true);
 page.on("request",async req=>{
  const url=req.url();
  if(new URL(url).pathname==="/api/auth/recover"&&req.method()==="POST"){
   apiCalls.push({path:"recover",body:req.postData()});
   return req.respond({status:200,contentType:"application/json",body:JSON.stringify({message:"If an active TFI account matches that email, password-reset instructions will be sent."})});
  }
  if(url.includes("/api/auth/recovery/consume")&&req.method()==="POST"){
   apiCalls.push({path:"consume",body:req.postData()});
   return req.respond({status:200,contentType:"application/json",headers:{"Set-Cookie":"tfi_recovery=test; HttpOnly; SameSite=Strict; Path=/"},body:JSON.stringify({ready:true,email:"dutsrominick@gmail.com"})});
  }
  if(url.includes("/api/auth/recovery/update")&&req.method()==="POST"){
   apiCalls.push({path:"update",body:req.postData()});
   return req.respond({status:200,contentType:"application/json",body:JSON.stringify({password_updated:true})});
  }
  return req.continue();
 });
 await page.setViewport({width:1440,height:900});
 await page.goto("http://127.0.0.1:5100/design/admin-login-preview.html",{waitUntil:"domcontentloaded",timeout:10000});
 console.log("STEP 2 login loaded");
 const loginLink=await page.$eval(".login-forgot-link",a=>a.getAttribute("href"));
 await page.click(".login-forgot-link");
 console.log("STEP 3 forgot clicked",page.url());
 await page.waitForSelector("#recovery-request-form");
 await page.$eval("#recovery-email",e=>e.value="dutsrominick@gmail.com");
 await page.click("#recovery-request-submit");
 await page.waitForFunction(()=>document.querySelector("#recovery-request-status")?.textContent.includes("newest email"),{timeout:10000});
 console.log("STEP 4 request complete");
 const requestStatus=await page.$eval("#recovery-request-status",e=>e.textContent);
 const requestFormHidden=await page.$eval("#recovery-request-form",e=>e.hidden);
 await page.screenshot({path:path.join(dir,"password-recovery-request-desktop.png"),fullPage:true});

 const rateLimited=await browser.newPage();
 await rateLimited.setRequestInterception(true);
 rateLimited.on("request",req=>{
  if(new URL(req.url()).pathname==="/api/auth/recover"&&req.method()==="POST"){
   return req.respond({status:429,contentType:"application/json",body:JSON.stringify({code:"email_rate_limited",error:"TFI2 has reached its email-sending quota. Password-reset and invitation emails share the built-in email allowance. Wait for the hourly allowance to reset before requesting another link; repeated clicks will not send an email."})});
  }
  return req.continue();
 });
 await rateLimited.goto("http://127.0.0.1:5100/design/password-recovery-request.html",{waitUntil:"domcontentloaded"});
 await rateLimited.$eval("#recovery-email",e=>e.value="dutsrominick@gmail.com");
 await rateLimited.$eval("#recovery-request-form",form=>form.requestSubmit());
 await rateLimited.waitForFunction(()=>document.querySelector("#recovery-request-status")?.textContent.includes("email-sending quota"),{timeout:10000});
 const rateLimitState=await rateLimited.$eval("#recovery-request-status",e=>e.textContent);

 const expired=await browser.newPage();
 await expired.setRequestInterception(true);
 expired.on("request",req=>req.continue());
 await expired.goto("http://127.0.0.1:5100/auth/recovery#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",{waitUntil:"domcontentloaded",timeout:10000});
 console.log("STEP 5 expired page loaded");
 await expired.waitForFunction(()=>document.querySelector("#password-reset-status")?.textContent.includes("expired"),{timeout:10000});
 console.log("STEP 6 expired state ready");
 const expiredState=await expired.evaluate(()=>({
  message:document.querySelector("#password-reset-status")?.textContent,
  hash:location.hash,
  backVisible:!document.querySelector("#recovery-back-link")?.hidden
 }));

 await page.goto("http://127.0.0.1:5100/auth/recovery#access_token=fake-recovery-access-token&refresh_token=fake-refresh-token&type=recovery&expires_in=3600&token_type=bearer",{waitUntil:"domcontentloaded",timeout:10000});
 console.log("STEP 7 valid page loaded");
 await page.waitForFunction(()=>!document.querySelector("#password-reset-form")?.hidden,{timeout:10000});
 console.log("STEP 8 valid state ready");
 const validState=await page.evaluate(()=>({
  title:document.title,
  account:document.querySelector("#recovery-account")?.textContent,
  hash:location.hash,
  visible:!document.querySelector("#password-reset-form")?.hidden
 }));
 await page.$eval("#new-password",e=>e.value="Correct-Horse-Battery-2026!");
 await page.$eval("#confirm-password",e=>e.value="Correct-Horse-Battery-2026!");
 console.log("STEP 9 before update click",await page.$eval("#password-reset-submit",e=>({disabled:e.disabled,visible:!!e.getClientRects().length})));
 await page.$eval("#password-reset-form",form=>form.requestSubmit());
 console.log("STEP 10 update submitted");
 await new Promise(resolve=>setTimeout(resolve,1500));
 console.log("STEP 11 update state",await page.evaluate(()=>({status:document.querySelector("#password-reset-status")?.textContent,formHidden:document.querySelector("#password-reset-form")?.hidden,buttonText:document.querySelector("#password-reset-submit")?.textContent})));
 const updateState=await page.evaluate(()=>({
  message:document.querySelector("#password-reset-status")?.textContent,
  formHidden:document.querySelector("#password-reset-form")?.hidden,
  backVisible:!document.querySelector("#recovery-back-link")?.hidden
 }));
 await page.screenshot({path:path.join(dir,"password-reset-success-desktop.png"),fullPage:true});
 const mobile=await browser.newPage();
 await mobile.setViewport({width:390,height:844});
 await mobile.goto("http://127.0.0.1:5100/design/password-recovery-request.html",{waitUntil:"networkidle0"});
 const mobileState=await mobile.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
 await mobile.screenshot({path:path.join(dir,"password-recovery-request-mobile.png"),fullPage:true});
 const pass=loginLink==="/design/password-recovery-request.html"&&requestStatus.includes("newest email")&&requestFormHidden&&rateLimitState.includes("hourly allowance")&&rateLimitState.includes("repeated clicks")&&expiredState.message.includes("expired")&&expiredState.hash===""&&expiredState.backVisible&&validState.visible&&validState.account==="dutsrominick@gmail.com"&&validState.hash===""&&updateState.message.includes("password has been updated")&&updateState.formHidden&&updateState.backVisible&&!mobileState.overflow&&apiCalls.map(x=>x.path).join(",")==="recover,consume,update"&&errors.length===0&&failed.length===0;
 console.log(JSON.stringify({loginLink,requestStatus,requestFormHidden,rateLimitState,expiredState,validState,updateState,mobileState,apiCalls:apiCalls.map(x=>({path:x.path,body:x.body})),errors,failed,pass},null,2));
 await browser.close();
 if(!pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});