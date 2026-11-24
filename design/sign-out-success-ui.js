(function(){
  "use strict";
  const countdown=document.getElementById("redirect-countdown");
  const progress=document.getElementById("redirect-progress");
  const progressFill=document.getElementById("redirect-progress-fill");
  const returnLink=document.getElementById("return-to-sign-in");
  if(!countdown||!progress||!progressFill||!returnLink)return;

  const totalSeconds=Math.max(1,Number(document.body.dataset.redirectSeconds)||4);
  let remainingSeconds=totalSeconds;
  let timerId=null;
  let navigating=false;

  function render(){
    countdown.textContent=String(remainingSeconds).padStart(2,"0");
    progress.setAttribute("aria-valuenow",String(totalSeconds-remainingSeconds));
    progressFill.style.width=(((totalSeconds-remainingSeconds)/totalSeconds)*100)+"%";
  }
  function returnToSignIn(){
    if(navigating)return;
    navigating=true;
    if(timerId!==null)window.clearInterval(timerId);
    window.location.assign("admin-login-preview.html");
  }

  returnLink.addEventListener("click",function(event){
    event.preventDefault();
    returnToSignIn();
  });
  render();
  timerId=window.setInterval(function(){
    remainingSeconds=Math.max(0,remainingSeconds-1);
    render();
    if(remainingSeconds===0)returnToSignIn();
  },1000);
  window.addEventListener("pagehide",function(){
    if(timerId!==null)window.clearInterval(timerId);
  });

  document.body.dataset.tfiSignoutSuccessReady="true";
  document.body.dataset.tfiSignoutConnected="false";
  document.body.dataset.tfiAutoRedirect="true";
})();