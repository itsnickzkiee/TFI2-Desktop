(function(){
  const form=document.getElementById("recovery-request-form");
  const email=document.getElementById("recovery-email");
  const status=document.getElementById("recovery-request-status");
  const button=document.getElementById("recovery-request-submit");
  if(!form||!email||!status||!button)return;

  function show(message,type){
    status.hidden=false;
    status.className="recovery-status"+(type==="error"?" is-error":type==="success"?" is-success":"");
    status.textContent=message;
  }

  form.addEventListener("submit",async function(event){
    event.preventDefault();
    const value=email.value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){
      email.setAttribute("aria-invalid","true");
      show("Enter a valid registered work email.","error");
      email.focus();
      return;
    }
    email.removeAttribute("aria-invalid");
    button.disabled=true;
    button.querySelector("span").textContent="Sending...";
    try{
      const response=await fetch("/api/auth/recover",{
        method:"POST",
        credentials:"same-origin",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({email:value})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){
        show(payload.error||"The reset request could not be sent. Wait a moment and try again.","error");
        return;
      }
      form.hidden=true;
      show("If an active TFI account matches that email, a fresh one-time reset link will be sent. Check your inbox and spam folder. Open the newest email only.","success");
    }catch(error){
      show("The TFI application could not reach its server. Open TFI_NEW and try again.","error");
    }finally{
      button.disabled=false;
      button.querySelector("span").textContent="Send reset link";
    }
  });
})();