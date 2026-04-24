// photo-cards.js — Adds photos from Supabase to search result cards
// Include in index.html before </body>: <script src="photo-cards.js"></script>
(function(){
  const SB='https://sebvfvtofiysbywxjqut.supabase.co';
  const SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlYnZmdnRvZml5c2J5d3hqcXV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjgzNjIsImV4cCI6MjA5MTkwNDM2Mn0.Pk5C4mwyJNpWRSz30V-F6I-0qGs0If6FRhg8tM5mBcI';
  let photoCache=null;

  async function loadPhotos(){
    if(photoCache)return photoCache;
    try{
      const r=await fetch(SB+'/rest/v1/apartments?select=id,photo_url',{headers:{'apikey':SK,'Authorization':'Bearer '+SK}});
      const data=await r.json();
      photoCache={};
      data.forEach(a=>{
        let url='';
        try{const p=JSON.parse(a.photo_url);if(Array.isArray(p))url=p[0]||''}catch(e){url=a.photo_url||''}
        photoCache[a.id]=url;
      });
    }catch(e){photoCache={}}
    return photoCache;
  }

  // Watch for result cards appearing
  const observer=new MutationObserver(async()=>{
    const cards=document.querySelectorAll('#resultsList .card__img');
    if(!cards.length)return;
    const photos=await loadPhotos();
    cards.forEach(imgDiv=>{
      if(imgDiv.dataset.photo)return;
      // Find apt ID from the card's select button
      const card=imgDiv.closest('.card')||imgDiv.parentElement;
      const btn=card?.querySelector('[onclick*="selectForBooking"]');
      let aptId='';
      if(btn){const m=btn.getAttribute('onclick')?.match(/['"]([^'"]+)['"]/);if(m)aptId=m[1]}
      const url=aptId&&photos[aptId]?photos[aptId]:'';
      if(url){
        imgDiv.style.backgroundImage='url('+url+')';
        imgDiv.style.backgroundSize='cover';
        imgDiv.style.backgroundPosition='center';
        imgDiv.style.minHeight='220px';
      }
      imgDiv.dataset.photo='1';
    });
  });

  // Start observing once DOM is ready
  if(document.getElementById('resultsList')){
    observer.observe(document.getElementById('resultsList'),{childList:true,subtree:true});
  }else{
    document.addEventListener('DOMContentLoaded',()=>{
      const el=document.getElementById('resultsList');
      if(el)observer.observe(el,{childList:true,subtree:true});
    });
  }

  // Also apply to already existing cards on page load
  window.addEventListener('load',async()=>{
    const el=document.getElementById('resultsList');
    if(el)observer.observe(el,{childList:true,subtree:true});
  });
})();
