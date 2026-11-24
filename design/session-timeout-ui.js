(function(){
  const dialog=document.querySelector(".timeout-dialog");
  const countdown=document.getElementById("timeout-countdown");
  const progress=document.getElementById("timeout-progress");
  const progressFill=document.getElementById("timeout-progress-fill");
  const stayButton=document.getElementById("stay-signed-in");
  const signOutButton=document.getElementById("sign-out-now");
  const status=document.getElementById("action-status");
  const title=document.getElementById("timeout-title");
  if(!dialog||!countdown||!progress||!progressFill||!stayButton||!signOutButton||!status||!title)return;

  const totalSeconds=Math.max(1,Number(document.body.dataset.countdownStart)||90);
  let remainingSeconds=totalSeconds;
  let timerId=null;

  function formatTime(seconds){
    const minutes=Math.floor(seconds/60);
    const remainder=seconds%60;
    return String(minutes).padStart(2,"0")+":"+String(remainder).padStart(2,"0");
  }
  function renderCountdown(){
    countdown.textContent=formatTime(remainingSeconds);
    progress.setAttribute("aria-valuenow",String(remainingSeconds));
    progressFill.style.width=((remainingSeconds/totalSeconds)*100)+"%";
    if(remainingSeconds<=15)progressFill.classList.add("is-critical");
  }
  function showStatus(message){
    status.hidden=false;
    status.textContent=message;
  }

  stayButton.addEventListener("click",function(){
    showStatus("Preview only — session extension is not connected. No session was refreshed.");
  });
  signOutButton.addEventListener("click",function(){
    showStatus("Preview only — sign-out is not connected. No session was ended.");
  });

  dialog.addEventListener("keydown",function(event){
    if(event.key!=="Tab")return;
    const controls=[stayButton,signOutButton];
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){
      event.preventDefault();last.focus();
    }else if(!event.shiftKey&&document.activeElement===last){
      event.preventDefault();first.focus();
    }
  });
  document.addEventListener("keydown",function(event){
    if(event.key==="Escape"){
      event.preventDefault();
      showStatus("This security warning remains open in the preview so its actions can be reviewed.");
    }
  });

  renderCountdown();
  timerId=window.setInterval(function(){
    remainingSeconds=Math.max(0,remainingSeconds-1);
    renderCountdown();
    if(remainingSeconds===0){
      window.clearInterval(timerId);
      showStatus("The simulated countdown is complete. No real session was expired or ended.");
    }
  },1000);

  window.addEventListener("pagehide",function(){
    if(timerId!==null)window.clearInterval(timerId);
  });

  document.body.dataset.tfiReady="true";
  document.body.dataset.tfiSessionConnected="false";
  document.body.dataset.tfiCountdownSimulated="true";
})();