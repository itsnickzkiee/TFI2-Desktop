const puppeteer=require("C:/Users/Rominick/AppData/Local/npm-cache/_npx/4b4c857f6efdfb61/node_modules/puppeteer");
const path=require("path");
const dir="C:/Users/Rominick/Desktop/TFI_NEW/design";
(async()=>{
 const browser=await puppeteer.launch({headless:true,args:["--no-sandbox","--disable-setuid-sandbox"]});
 const page=await browser.newPage();
 const errors=[],failed=[],authPosts=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 page.on("requestfailed",r=>failed.push(r.url()+" :: "+r.failure()?.errorText));
 page.on("request",r=>{if(r.url().includes("/api/auth/login")&&r.method()==="POST")authPosts.push(r.url());});
 await page.setViewport({width:1440,height:900});
 await page.goto("http://127.0.0.1:5100/",{waitUntil:"networkidle0"});
 const initial=await page.evaluate(()=>({
  url:location.href,
  title:document.title,
  authConnected:document.body.dataset.tfiAuthConnected,
  emailType:document.querySelector("#admin-identity")?.type,
  emailLabel:document.querySelector('label[for="admin-identity"]')?.textContent.trim(),
  warning:document.querySelector(".login-preview-warning")?.innerText.trim(),
  logoLoaded:document.querySelector(".login-logo-panel img")?.complete
 }));
 const health=await page.evaluate(async()=>{const r=await fetch("/api/health");return {status:r.status,body:await r.json()};});
 await page.$eval("#admin-identity",e=>e.value="admin");
 await page.$eval("#admin-password",e=>e.value="not-a-real-password");
 await page.click('#admin-login-form button[type="submit"]');
 await page.waitForFunction(()=>document.querySelector("#login-status")?.textContent.includes("Username sign-in is not enabled yet."));
 const usernameValidation=await page.$eval("#login-status",e=>e.textContent);
 const postCountAfterInvalid=authPosts.length;
 await page.$eval("#admin-identity",e=>e.value="admin@example.test");
 await page.$eval("#admin-password",e=>e.value="");
 await page.click('#admin-login-form button[type="submit"]');
 const passwordValidation=await page.$eval("#login-status",e=>e.textContent);
 await page.$eval("#admin-password",e=>e.value="not-a-real-password");
 await page.click("#password-toggle");
 const shown=await page.$eval("#admin-password",e=>e.type);
 await page.click("#password-toggle");
 const hidden=await page.$eval("#admin-password",e=>e.type);
 await page.reload({waitUntil:"networkidle0"});
 await page.screenshot({path:path.join(dir,"admin-login-backend-verified-desktop.png"),fullPage:true});
 await page.setViewport({width:390,height:844});
 await page.screenshot({path:path.join(dir,"admin-login-backend-verified-mobile.png"),fullPage:true});
 const mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
 const guard=await browser.newPage();
 await guard.goto("http://127.0.0.1:5100/design/dashboard-preview.html",{waitUntil:"networkidle0"});
 const guardResult={url:guard.url(),redirected:guard.url().includes("admin-login-preview.html")};
 const result={
  initial,health,usernameValidation,passwordValidation,postCountAfterInvalid,shown,hidden,mobile,guardResult,authPosts,errors,failed,
  pass:initial.title==="TFI | Administrator Sign In"&&initial.authConnected==="true"&&initial.emailType==="email"&&initial.emailLabel==="Work email"&&initial.logoLoaded&&health.status===200&&health.body.connected===true&&usernameValidation.includes("Username sign-in is not enabled yet.")&&passwordValidation==="Enter your password to continue."&&postCountAfterInvalid===0&&shown==="text"&&hidden==="password"&&!mobile.overflow&&guardResult.redirected&&errors.length===0&&failed.length===0
 };
 console.log(JSON.stringify(result,null,2));
 await browser.close();
 if(!result.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});