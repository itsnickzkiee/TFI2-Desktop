(function(){
  const form=document.getElementById("password-reset-form");
  const emailLabel=document.getElementById("recovery-account");
  const status=document.getElementById("password-reset-status");
  const back=document.getElementById("recovery-back-link");
  const password=document.getElementById("new-password");
  const confirm=document.getElementById("confirm-password");
  const button=document.getElementById("password-reset-submit");
  if(!form||!status||!back||!password||!confirm||!button)return;

  function show(message,type){
    status.hidden=false;
    status.className="recovery-status"+(type==="error"?" is-error":type==="success"?" is-success":"");
    status.textContent=message;
  }

  function fail(message){
    form.hidden=true;
    show(message,"error");
    back.hidden=false;
  }

  async function initialize(){
    const params=new URLSearchParams(window.location.hash.slice(1));
    const errorCode=params.get("error_code");
    const accessToken=params.get("access_token");
    const flowType=params.get("type");
    // Remove sensitive one-time values from the address bar immediately after reading.
    window.history.replaceState(null,document.title,window.location.pathname+window.location.search);

    if(errorCode){
      fail(errorCode==="otp_expired"||errorCode==="otp_invalid"
        ?"This reset link has expired or has already been used. Return to sign in and request a fresh reset link."
        :"The reset link could not be verified. Request a fresh reset link.");
      return;
    }
    if(!accessToken||flowType!=="recovery"){
      fail("No valid password-reset token was found. Open the newest reset email or request a fresh link.");
      return;
    }

    try{
      const response=await fetch("/api/auth/recovery/consume",{
        method:"POST",
        credentials:"same-origin",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({access_token:accessToken,type:flowType})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){
        fail(payload.error||"The reset link could not be verified. Request a fresh link.");
        return;
      }
      emailLabel.hidden=false;
      emailLabel.textContent=payload.email||"Verified TFI account";
      form.hidden=false;
      show("Reset link verified. Choose a new password below.","success");
    }catch(error){
      fail("The TFI application server could not be reached. Start TFI_NEW and open the newest reset link again.");
    }
  }

  form.addEventListener("submit",async function(event){
    event.preventDefault();
    if(password.value.length<12||password.value.length>128){
      show("Use a password with 12 to 128 characters.","error");
      password.focus();
      return;
    }
    if(password.value!==confirm.value){
      show("The passwords do not match. Check both fields.","error");
      confirm.focus();
      return;
    }

    button.disabled=true;
    button.querySelector("span").textContent="Updating...";
    try{
      const response=await fetch("/api/auth/recovery/update",{
        method:"POST",
        credentials:"same-origin",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({new_password:password.value})
      });
      const payload=await response.json().catch(()=>({}));
      password.value="";
      confirm.value="";
      if(!response.ok){
        show(payload.error||"The password could not be updated. Request a fresh reset link.","error");
        if(response.status===401){
          form.hidden=true;
          back.hidden=false;
        }
        return;
      }
      form.hidden=true;
      emailLabel.hidden=true;
      show("Your TFI password has been updated. You can now return to the sign-in page and use your new password.","success");
      back.hidden=false;
    }catch(error){
      password.value="";
      confirm.value="";
      show("The TFI application could not reach its server. Try again.","error");
    }finally{
      button.disabled=false;
      button.querySelector("span").textContent="Update password";
    }
  });

  initialize();
})();