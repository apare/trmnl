'use strict';
const { assets, path, base, bareHands, bareFeet, hairBack, hoodOpening, head } = wardrobe;
const W = wardrobe.colors.white;
const categories=[['tops','Les hauts','Pour commencer'],['bottoms','Les bas','Une pièce à la fois'],['outer','Manteaux','Pour sortir'],['head','La tête','Jusqu’aux oreilles'],['feet','Les pieds','Prêts à partir'],['extras','Les extras','Les petits détails']];
const lookup=Object.fromEntries(assets.map(a=>[a.id,a]));
let state={top:'tshirt',bottom:'pantalon',feet:'souliers'};
let category='tops';
let character='short';
const presets={sun:{top:'tshirt',bottom:'short',feet:'souliers',head:'casquette',sunscreen:'creme'},rain:{top:'manches',bottom:'pluie',outer:'impermeable',feet:'bottesPluie'},snow:{top:'chandail',bottom:'pantalon',bib:'neige',outer:'hiver',feet:'bottesHiver',head:'tuque',hands:'mitaines',neck:'cachecou'}};
function svg(content,viewBox='0 0 400 680',extra=''){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="#000000" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" ${extra}>${content}</svg>`;}
function composition(){
 const rain=state.outer==='impermeable';
 const layer=(slot,part='front')=>state[slot]&&lookup[state[slot]][part]?`<g data-layer="${slot}" data-side="${part}" data-item="${state[slot]}">${lookup[state[slot]][part]}</g>`:'';
 const rearSlot=state.outer?'outer':'top';
 return `<defs><clipPath id="head-shape">${path(hoodOpening)}</clipPath></defs>`+
  (character==='long'&&!rain?`<g data-layer="hair-back">${hairBack}</g>`:'')+
  layer(rearSlot,'back')+`<g id="mannequin">${base}</g>`+
  ['tights','bottom','top','dress','bib'].map(slot=>layer(slot)).join('')+
  (state.feet?layer('feet'):state.tights?'':`<g data-layer="bare-feet">${bareFeet}</g>`)+
  layer('outer')+`<g data-layer="face" ${rain?'clip-path="url(#head-shape)"':''}>${head(character)}</g>`+
  (rain?`<g clip-path="url(#head-shape)">${layer('head')}</g>`:layer('head'))+
  layer('outer','headFront')+layer('neck')+
  (state.hands?layer('hands'):`<g data-layer="bare-hands">${bareHands}</g>`)+layer('sunscreen');
}
function toggle(id){const a=lookup[id];if(state[a.slot]===id){delete state[a.slot];}else{state[a.slot]=id;if(a.slot==='dress'){delete state.top;delete state.bib;}if(a.slot==='top'||a.slot==='bib')delete state.dress;if(a.slot==='bottom')delete state.bib;}render();document.querySelector('#announcement').textContent=`${a.label} ${state[a.slot]===id?'ajouté à':'enlevé de'} la tenue.`;}
function render(){
 const description=(character==='long'?'Personnage aux cheveux longs. ':'Personnage aux cheveux courts. ')+(Object.values(state).map(id=>lookup[id].label).join(', ')||'Personnage sans vêtements');
 document.querySelector('#doll-stage').innerHTML=svg(`<title id="doll-title">Mon compagnon en tenue du jour</title><desc id="doll-description">${description}</desc>${composition()}`,'0 0 400 680','role="img" aria-labelledby="doll-title doll-description"');
 document.querySelectorAll('[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(character===b.dataset.character)));
 const c=categories.find(c=>c[0]===category);
 document.querySelector('#category-title').textContent=c[1];document.querySelector('#category-subtitle').textContent=c[2];
 document.querySelector('#categories').innerHTML=categories.map(([id,label])=>`<button type="button" data-category="${id}" aria-pressed="${category===id}">${label}</button>`).join('');
 document.querySelector('#items').innerHTML=assets.filter(a=>a.category===category).map(a=>`<button type="button" class="item" data-item="${a.id}" aria-pressed="${state[a.slot]===a.id}">${svg(a.art,a.box.join(' '),'aria-hidden="true"')}<span class="item-label">${a.label}</span></button>`).join('');
 const chosen=Object.values(state).map(id=>lookup[id]);
 document.querySelector('#selected').innerHTML=chosen.length?chosen.map(a=>`<button type="button" data-item="${a.id}" aria-label="Enlever ${a.label}">${a.label}<span aria-hidden="true">×</span></button>`).join(''):'<span class="empty">Les vêtements choisis apparaîtront ici.</span>';
 document.querySelector('#item-count').textContent=`${chosen.length} pièce${chosen.length>1?'s':''} dans la tenue`;
 document.querySelector('#outfit-name').textContent=chosen.length?'Tout prêt pour une belle journée.':'À toi de choisir sa tenue !';
 document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(JSON.stringify(state)===JSON.stringify(presets[b.dataset.preset]))));
 try{localStorage.setItem('petit-vestiaire-v1',JSON.stringify(state));localStorage.setItem('petit-vestiaire-character-v1',character);}catch{}
}
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.item){const area=b.closest('#items')?'#items':'#selected';const id=b.dataset.item;toggle(id);document.querySelector(`${area} [data-item="${id}"]`)?.focus({preventScroll:true});}
 if(b.dataset.category){category=b.dataset.category;render();document.querySelector(`[data-category="${category}"]`).focus({preventScroll:true});}
 if(b.dataset.preset){state={...presets[b.dataset.preset]};render();document.querySelector('#announcement').textContent=`Tenue ${b.textContent.trim()} appliquée.`;}
 if(b.dataset.character&&['short','long'].includes(b.dataset.character)){character=b.dataset.character;render();document.querySelector('#announcement').textContent=character==='long'?'Personnage aux cheveux longs sélectionné.':'Personnage aux cheveux courts sélectionné.';}
});
document.querySelector('#reset').addEventListener('click',()=>{state={};render();document.querySelector('#announcement').textContent='Tous les vêtements ont été enlevés.';});
document.querySelector('#print').addEventListener('click',()=>window.print());
document.querySelector('#download').addEventListener('click',async()=>{
 const button=document.querySelector('#download');button.disabled=true;
 try{
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1740;
  const ctx=canvas.getContext('2d');ctx.fillStyle=W;ctx.fillRect(0,0,canvas.width,canvas.height);
  const blob=new Blob([svg(composition(),'0 0 400 680','width="1024" height="1740"')],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);const image=new Image();
  try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});ctx.drawImage(image,0,0,1024,1740);}finally{URL.revokeObjectURL(url);}
  const pixels=ctx.getImageData(0,0,1024,1740),tones=[0,85,154,212,255];
  for(let i=0;i<pixels.data.length;i+=4){const gray=pixels.data[i];let nearest=tones[0];for(const tone of tones)if(Math.abs(tone-gray)<Math.abs(nearest-gray))nearest=tone;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=nearest;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);
  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw new Error('Export indisponible');
  const pngUrl=URL.createObjectURL(png);const a=document.createElement('a');a.href=pngUrl;a.download='ma-tenue-du-jour.png';a.click();setTimeout(()=>URL.revokeObjectURL(pngUrl),1000);
  document.querySelector('#announcement').textContent='La tenue a été téléchargée en PNG.';
 }catch{document.querySelector('#announcement').textContent='Le téléchargement a échoué. Réessaie.';}finally{button.disabled=false;}
});
try{const saved=JSON.parse(localStorage.getItem('petit-vestiaire-v1'));if(saved&&typeof saved==='object'&&!Array.isArray(saved)){const valid={};for(const [slot,id]of Object.entries(saved))if(lookup[id]?.slot===slot)valid[slot]=id;state=valid;}}catch{}
try{const saved=localStorage.getItem('petit-vestiaire-character-v1');if(['short','long'].includes(saved))character=saved;}catch{}
render();
