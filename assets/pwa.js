(function(){
  const oldButton=document.getElementById('install-app');
  const oldDivider=document.getElementById('install-app-divider');
  oldButton?.remove();oldDivider?.remove();
  const buttons=[];
  let installPrompt=null;
  const isInstalled=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;

  function installButton(){
    const button=document.createElement('button');button.type='button';button.className='visitor-install-button button-outlined';
    const icon=document.createElement('i');icon.className='fa-solid fa-download';icon.setAttribute('aria-hidden','true');
    const label=document.createElement('span');label.textContent=window.AppI18n.t('installApp');
    button.append(icon,label);button.setAttribute('aria-label',label.textContent);button.addEventListener('click',install);buttons.push(button);return button;
  }
  function placeBesideExport(exportId){
    const exportButton=document.getElementById(exportId);if(!exportButton)return;
    const actions=document.createElement('div');actions.className='visitor-export-actions';
    exportButton.parentNode.insertBefore(actions,exportButton);actions.append(exportButton,installButton());
  }
  placeBesideExport('map-export-jpg');
  placeBesideExport('export-day-jpg');
  if(!buttons.length)return;

  window.addEventListener('image-map-language-change',()=>buttons.forEach(button=>{const label=button.querySelector('span');label.textContent=window.AppI18n.t('installApp');button.setAttribute('aria-label',label.textContent);}));
  if(isInstalled())buttons.forEach(button=>button.hidden=true);
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;buttons.forEach(button=>button.hidden=true);window.trackAppEvent?.('App','installed');});

  async function install(){
    window.trackAppEvent?.('App','install_button');
    if(installPrompt){
      const prompt=installPrompt;installPrompt=null;await prompt.prompt();
      const choice=await prompt.userChoice;window.trackAppEvent?.('App','install_prompt',choice.outcome);
      if(choice.outcome==='accepted')buttons.forEach(button=>button.hidden=true);
      return;
    }
    const instructions=isIOS()
      ? (window.AppI18n.lang()==='en'?'In Safari, tap Share, then “Add to Home Screen”.':'Tippe in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“.')
      : window.AppI18n.t('installFallback');
    window.alert(instructions);
  }
})();
