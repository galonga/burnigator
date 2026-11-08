(function(){
  const toast=document.getElementById('burnigator-easter-toast');
  if(!toast)return;
  let toastTimer,chaosTimer,sunsetTimer,sparkleMode=false,lastPointerSparkAt=0;
  const mapElement=document.getElementById('map');
  const sunset=document.createElement('div');
  sunset.className='burnigator-sunset burnigator-sunset-map';
  sunset.setAttribute('aria-hidden','true');
  mapElement?.appendChild(sunset);
  const timetable=document.getElementById('timetable-view');
  const timetableSunset=document.createElement('div');
  timetableSunset.className='burnigator-sunset burnigator-sunset-timetable';
  timetableSunset.setAttribute('aria-hidden','true');
  timetable?.appendChild(timetableSunset);
  const sparkles=document.createElement('div');
  sparkles.className='burnigator-sparkles';
  sparkles.setAttribute('aria-hidden','true');
  document.body.appendChild(sparkles);

  function sparkleAt(x,y,count=14){
    for(let i=0;i<count;i++){
      const spark=document.createElement('span');
      spark.className='burn-sparkle'+(i%4===0?' ember':'');
      spark.style.left=x+'px';spark.style.top=y+'px';
      const angle=(Math.PI*2*i/22)+(Math.random()-.5)*.35;
      const distance=34+Math.random()*96;
      spark.style.setProperty('--spark-x',Math.cos(angle)*distance+'px');
      spark.style.setProperty('--spark-y',Math.sin(angle)*distance+'px');
      spark.style.setProperty('--spark-delay',Math.random()*.2+'s');
      spark.style.setProperty('--spark-size',(5+Math.random()*9)+'px');
      sparkles.appendChild(spark);
      setTimeout(()=>spark.remove(),1400);
    }
  }

  document.addEventListener('pointermove',event=>{
    if(!sparkleMode)return;
    const now=performance.now();
    if(now-lastPointerSparkAt<85)return;
    lastPointerSparkAt=now;
    sparkleAt(event.clientX,event.clientY,7);
  },{passive:true});

  document.addEventListener('pointerdown',event=>{
    if(!sparkleMode||event.pointerType!=='touch')return;
    sparkleAt(event.clientX,event.clientY,16);
  },{passive:true});

  document.addEventListener('click',event=>{
    const trigger=event.target.closest('#burnigator-easter-trigger');
    if(!trigger)return;
    window.trackAppEvent?.('Visitor','burnigator_easter_egg');
    sparkleMode=true;
    if(window.matchMedia('(max-width:760px)').matches)window.scrollTo({top:0,behavior:'smooth'});
    const triggerBounds=trigger.getBoundingClientRect();
    const sparkleX=event.clientX===0&&event.clientY===0?triggerBounds.left+triggerBounds.width/2:event.clientX;
    const sparkleY=event.clientX===0&&event.clientY===0?triggerBounds.top+triggerBounds.height/2:event.clientY;
    sparkleAt(sparkleX,sparkleY,22);
    document.body.classList.remove('burnigator-chaos');
    requestAnimationFrame(()=>document.body.classList.add('burnigator-chaos'));
    clearTimeout(chaosTimer);
    chaosTimer=setTimeout(()=>document.body.classList.remove('burnigator-chaos'),7600);
    sunset.classList.remove('active');
    timetableSunset.classList.remove('active');
    requestAnimationFrame(()=>sunset.classList.add('active'));
    requestAnimationFrame(()=>timetableSunset.classList.add('active'));
    clearTimeout(sunsetTimer);
    sunsetTimer=setTimeout(()=>{
      sunset.classList.remove('active');
      timetableSunset.classList.remove('active');
    },7600);
    toast.textContent='Burnigator says: The map is not on fire. That is just sunset mode. Hydrate! 🔥';
    toast.hidden=false;
    toast.classList.remove('show');
    requestAnimationFrame(()=>toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{
      toast.classList.remove('show');
      setTimeout(()=>{toast.hidden=true;},250);
    },7600);
  });
})();
