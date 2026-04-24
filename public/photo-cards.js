// photo-cards.js — Adds photos from Supabase to search result cards
(function(){
  var SB='https://sebvfvtofiysbywxjqut.supabase.co';
  var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
  var photoCache=null;

  function loadPhotos(cb){
    if(photoCache){cb(photoCache);return}
    var x=new XMLHttpRequest();
    x.open('GET',SB+'/rest/v1/apartments?select=id,name,photo_url');
    x.setRequestHeader('apikey',SK);
    x.setRequestHeader('Authorization','Bearer '+SK);
    x.onload=function(){
      try{
        var data=JSON.parse(x.responseText);
        photoCache={};
        for(var i=0;i<data.length;i++){
          var a=data[i],url='';
          try{var p=JSON.parse(a.photo_url);if(p&&p.length)url=p[0]}catch(e){url=a.photo_url||''}
          if(url){
            photoCache[a.id]=url;
            // Also map by apartment number from name
            var numMatch=a.name.match(/(\d+)/);
            if(numMatch)photoCache['apt_'+numMatch[1]]=url;
          }
        }
        cb(photoCache);
      }catch(e){photoCache={};cb(photoCache)}
    };
    x.onerror=function(){photoCache={};cb(photoCache)};
    x.send();
  }

  function applyPhotos(){
    var cards=document.querySelectorAll('#resultsList .card__img');
    if(!cards.length)return;
    loadPhotos(function(photos){
      for(var i=0;i<cards.length;i++){
        var imgDiv=cards[i];
        if(imgDiv.getAttribute('data-phdone'))continue;
        imgDiv.setAttribute('data-phdone','1');
        // Get apartment number from title
        var card=imgDiv.closest?imgDiv.closest('.card'):imgDiv.parentElement;
        if(!card)continue;
        var titleEl=card.querySelector('.card__title')||card.querySelector('h3');
        if(!titleEl)continue;
        var title=titleEl.textContent.trim();
        var numMatch=title.match(/(\d+)/);
        if(!numMatch)continue;
        var aptNum=numMatch[1];
        var url=photos['apt_'+aptNum]||'';
        if(url){
          imgDiv.style.backgroundImage='url('+url+')';
          imgDiv.style.backgroundSize='cover';
          imgDiv.style.backgroundPosition='center';
          imgDiv.style.minHeight='220px';
        }
      }
    });
  }

  // Use MutationObserver to detect when cards appear
  function startObserving(){
    var el=document.getElementById('resultsList');
    if(!el)return;
    var obs=new MutationObserver(function(){
      setTimeout(applyPhotos,100);
    });
    obs.observe(el,{childList:true,subtree:true});
    // Also apply immediately in case cards already exist
    applyPhotos();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',startObserving);
  }else{
    startObserving();
  }
})();
