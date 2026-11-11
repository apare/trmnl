const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const wardrobe=require('../illustrations/wardrobe');
const code=fs.readFileSync(require('node:path').join(__dirname,'../illustrations/preview/app.js'),'utf8');

function app(saved=null,character=null){
 const elements=new Map(),events={};
 const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn},focus(){},setAttribute(){}});return elements.get(id)};
 const ctx=vm.createContext({console,setTimeout,wardrobe,document:{querySelector:get,querySelectorAll:()=>[],addEventListener(type,fn){events[type]=fn}},window:{print(){}},localStorage:{getItem:key=>key==='petit-vestiaire-v1'?saved:character,setItem(){}},Blob,URL,Image:function(){}});
 vm.runInContext(code,ctx);
 return {run:s=>vm.runInContext(s,ctx),get,events};
}
const front=slot=>`data-layer="${slot}" data-side="front"`;
const back=slot=>`data-layer="${slot}" data-side="back"`;

test('hoodie is behind the neck and face; its pocket and strings are on the front',()=>{
 const a=app();a.run("state={top:'chandail'}");
 const drawing=a.run('composition()');
 assert(drawing.indexOf(back('top'))<drawing.indexOf('id="mannequin"'));
 assert(drawing.indexOf('id="mannequin"')<drawing.indexOf(front('top')));
 assert(drawing.indexOf(front('top'))<drawing.indexOf('data-layer="face"'));
 assert(!a.run('lookup.chandail.front').includes(a.run('lookup.chandail.back')));
});
test('winter bib and clothes stay behind boots, gloves replace bare hands',()=>{
 const a=app();a.run('state={...presets.snow}');const drawing=a.run('composition()');
 assert(drawing.indexOf(front('top'))<drawing.indexOf(front('bib')));
 assert(drawing.indexOf(front('bib'))<drawing.indexOf(front('feet')));
 assert(drawing.indexOf(front('outer'))<drawing.indexOf(front('neck')));
 assert(!drawing.includes('data-layer="bare-feet"'));
 assert(!drawing.includes('data-layer="bare-hands"'));
 a.run("state={hands:'gants',feet:'bottesPluie'}");
 assert(!a.run('composition()').includes('data-layer="bare-hands"'));
 assert(!a.run('composition()').includes('data-layer="bare-feet"'));
 a.run('state={}');assert.match(a.run('composition()'),/data-layer="bare-hands"/);assert.match(a.run('composition()'),/data-layer="bare-feet"/);
});
test('skin is white, short hair fits inside the shared head shape',()=>{
 const a=app();assert(!a.run('base').includes('#D4D4D4'));
 assert.match(a.run('base'),/fill="#FFFFFF"/);
 assert.match(a.run('head()'),/clip-path="url\(#head-shape\)"/);
 assert.equal(a.run("assets.every(a=>typeof a.front==='string'&&typeof a.back==='string')"),true);
});
test('long-haired head uses the same fitting and is retained across outfit changes',()=>{
 const a=app(null,'long');assert.equal(a.run('character'),'long');
 const short=a.run("character='short';head(character)");const long=a.run("character='long';head(character)");assert.notEqual(long,short);
 assert.match(a.run('composition()'),/data-layer="hair-back"/);
 a.events.click({target:{closest:()=>({dataset:{preset:'snow'},textContent:'Bien au chaud'})}});
 assert.equal(a.run('character'),'long');assert.equal(a.run('state.head'),'tuque');
 assert.match(a.get('#doll-stage').innerHTML,/Personnage aux cheveux longs/);
 a.events.click({target:{closest:()=>({dataset:{character:'short'}})}});
 assert.equal(a.run('character'),'short');assert.equal(a.run('state.head'),'tuque');
});
test('rain hood wraps around the head; hair and hat are clipped to its opening',()=>{
 const a=app();a.run("character='long';state={...presets.rain,head:'casquette'}");const drawing=a.run('composition()');
 assert(!drawing.includes('data-layer="hair-back"'));
 assert.match(drawing,/<g data-layer="face" clip-path="url\(#head-shape\)"/);
 assert.match(drawing,/<g clip-path="url\(#head-shape\)"><g data-layer="head"/);
 assert(drawing.indexOf('data-side="headFront"')>drawing.indexOf(front('head')));
 assert(a.run('lookup.impermeable.headFront').includes(a.run('hoodOpening')));
});
test('neck warmer uses a single front piece above the neck and clothing',()=>{
 const a=app();a.run("state={top:'chandail',outer:'hiver',neck:'cachecou'}");const drawing=a.run('composition()');
 assert(!drawing.includes(back('neck')));
 assert.equal(a.run('lookup.cachecou.back'),'');
 assert.equal(drawing.split(front('neck')).length-1,1);
 assert(drawing.indexOf(front('neck'))>drawing.indexOf('data-layer="face"'));
 assert(drawing.indexOf(front('neck'))>drawing.indexOf(front('outer')));
});
test('existing selections, reset, categories, and saved outfits still work',()=>{
 const a=app();assert.equal(a.run('assets.length'),22);assert.equal(a.run('Object.keys(state).length'),3);
 a.run("toggle('robe')");assert.equal(a.run('state.top'),undefined);assert.equal(a.run('state.dress'),'robe');
 a.run("toggle('chandail')");assert.equal(a.run('state.dress'),undefined);
 for(const category of ['tops','bottoms','outer','head','feet','extras']){a.run(`category=${JSON.stringify(category)};render()`);assert.match(a.get('#items').innerHTML,/aria-pressed=/);}
 a.get('#reset').listeners.click();assert.equal(a.run('Object.keys(state).length'),0);
 assert.equal(app('{broken').run('Object.keys(state).length'),3);
 assert.equal(app('{"top":"hiver","feet":"souliers"}').run('Object.keys(state).length'),1);
 assert.equal(app('{}').run('Object.keys(state).length'),0);
});

module.exports={app};

test('Liquid is generated from the same illustration source as the preview',()=>{
 const path=require('node:path');
 const {build}=require('../illustrations/build.cjs');
 assert.equal(fs.readFileSync(path.join(__dirname,'../src/shared.liquid'),'utf8'),build());
 assert.equal(wardrobe.assets.length,22);
 const allowed=new Set(['#FFFFFF','#D4D4D4','#9A9A9A','#555555','#000000']);
 for(const asset of wardrobe.assets){
  for(const tone of asset.art.match(/#[a-fA-F0-9]{6}/g)||[])assert(allowed.has(tone),`${asset.id}: ${tone}`);
 }
});
