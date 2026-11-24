(function(){
  const form=document.getElementById("admin-login-form");
  const identity=document.getElementById("admin-identity");
  const password=document.getElementById("admin-password");
  const toggle=document.getElementById("password-toggle");
  const status=document.getElementById("login-status");
  const submit=form?.querySelector('button[type="submit"]');
  if(!form||!identity||!password||!toggle||!status||!submit)return;

  function clearStatus(){
    status.hidden=true;
    status.textContent="";
    status.className="login-status";
  }
  function showStatus(message,type){
    status.hidden=false;
    status.className="login-status "+(type==="error"?"is-error":type==="success"?"is-success":"is-info");
    status.textContent=message;
  }
  function markInvalid(input,message){
    input.setAttribute("aria-invalid","true");
    showStatus(message,"error");
    input.focus();
  }
  function resetPasswordVisibility(){
    password.type="password";
    toggle.setAttribute("aria-pressed","false");
    toggle.setAttribute("aria-label","Show password");
    toggle.querySelector("span").textContent="Show";
  }
  function setBusy(busy){
    submit.disabled=busy;
    submit.setAttribute("aria-busy",String(busy));
    submit.querySelector("span").textContent=busy?"Signing in...":"Sign in";
  }

  identity.addEventListener("input",function(){
    identity.removeAttribute("aria-invalid");
    clearStatus();
  });
  password.addEventListener("input",function(){
    password.removeAttribute("aria-invalid");
    clearStatus();
  });
  toggle.addEventListener("click",function(){
    const showing=password.type==="password";
    password.type=showing?"text":"password";
    toggle.setAttribute("aria-pressed",String(showing));
    toggle.setAttribute("aria-label",showing?"Hide password":"Show password");
    toggle.querySelector("span").textContent=showing?"Hide":"Show";
    password.focus();
  });

  form.addEventListener("submit",async function(event){
    event.preventDefault();
    clearStatus();
    const email=identity.value.trim();
    if(!email){
      markInvalid(identity,"Enter your registered work email.");
      return;
    }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      markInvalid(identity,"Use your registered work email. Username sign-in is not enabled yet.");
      return;
    }
    if(!password.value){
      markInvalid(password,"Enter your password to continue.");
      return;
    }

    setBusy(true);
    showStatus("Checking your authorized TFI account...","info");
    try{
      const response=await fetch("/api/auth/login",{
        method:"POST",
        credentials:"same-origin",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({email,password:password.value})
      });
      const payload=await response.json().catch(()=>({}));
      password.value="";
      resetPasswordVisibility();

      if(!response.ok){
        showStatus(payload.error||"Sign-in was not completed. Check your account and try again.","error");
        return;
      }

      showStatus("Sign-in successful. Opening your workspace...","success");
      document.body.dataset.tfiAuthConnected="true";
      document.body.dataset.tfiSessionCreated="true";
      window.location.assign("/design/dashboard-preview.html");
    }catch(error){
      password.value="";
      resetPasswordVisibility();
      showStatus("The TFI application server could not be reached. Start the TFI_NEW application and try again.","error");
    }finally{
      setBusy(false);
    }
  });

  document.body.dataset.tfiReady="true";
  document.body.dataset.tfiAuthConnected="true";
  document.body.dataset.tfiSessionCreated="false";
})();