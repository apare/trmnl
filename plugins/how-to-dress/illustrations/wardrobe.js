'use strict';
// Approved paper-doll illustrations, shared by the local preview and Liquid generator.
const wardrobe = (() => {
const W='#FFFFFF',L='#D4D4D4',M='#9A9A9A',D='#555555';
const path=(d,fill=W,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const line=d=>path(d,'none');
const circle=(x,y,r,fill=W)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const drop=(x,y)=>path(`M${x} ${y}q-12 16 0 17q12-1 0-17Z`,L);
const tee='M178 217Q160 216 144 226Q128 248 116 285Q131 294 149 298Q151 290 153 290L151 378Q200 389 249 378L247 290Q249 290 251 298Q269 294 284 285Q272 248 256 226Q240 216 222 217Q200 241 178 217Z';
const longTop='M178 217Q159 215 144 226Q128 250 116 285L93 376Q108 385 124 386L149 308Q151 301 153 303L150 379Q200 390 250 379L247 303Q249 301 251 308L276 386Q292 385 307 376L284 285Q272 250 256 226Q241 215 222 217Q200 241 178 217Z';
const trousers='M153 369Q200 379 247 369L260 563Q241 573 220 566L200 440L180 566Q160 573 140 563Z';
const coat='M178 214Q157 213 143 225Q127 248 114 285L91 377Q107 388 126 388L149 313Q151 306 153 309L146 401Q200 415 254 401L247 309Q249 306 251 313L274 388Q293 388 309 377L286 285Q273 248 257 225Q243 213 222 214Q200 238 178 214Z';
const hoodOpening='M151 109Q151 65 200 63Q249 65 249 109L248 160Q245 202 200 207Q155 202 152 160Z';
const rainHood='M136 111Q136 63 173 51L200 39L227 51Q264 63 264 111L261 164Q258 205 235 225L222 231Q200 218 178 231L165 225Q142 205 139 164Z';
const downHood='M159 231Q142 212 154 195Q168 179 200 184Q232 179 246 195Q258 212 241 231L225 243Q200 252 175 243Z';
const winterHood='M156 231Q139 226 143 213Q133 199 148 193Q145 178 161 180Q170 164 183 174Q200 163 217 174Q230 164 239 180Q255 178 252 193Q267 199 257 213Q261 226 244 231L226 242Q200 249 174 242Z';
const cuff=line('M97 363q15 8 31 9m144 0q16-1 31-9');
const coatCuff=line('M94 365q18 10 36 9m140 0q18 1 36-9');
const pantsDetail=line('M154 385q46 9 92 0M200 383v43m-34 117 16 2m36 0 18-2');
const shoeSole='M113 600Q143 605 179 586L177 597Q150 615 121 613Q112 613 113 600Z';
const leftShoe=path('M139 557Q159 565 183 560L179 583Q183 593 174 599Q149 612 121 613Q109 613 112 598Q114 588 129 583L136 572Z')+line('M113 600q30 5 66-14M139 575l23 4m-27 4 23 3');
const footwear=(fill,boot=false,fur=false)=>{
 const one=boot?path('M137 518Q164 525 191 518L182 585Q184 593 174 599Q149 614 121 613Q109 613 112 598Q114 586 130 581Z',fill)+line('M113 600q30 5 66-14')+(fur?path('M135 523q-9-9 1-13q-1-9 11-6q9-9 16 0q11-5 14 4q13-4 10 8q5 9-6 10q-24 6-46-3Z'):line('M136 531q26 7 53 0')):leftShoe.replaceAll('fill="'+W+'"','fill="'+fill+'"');
 return one+`<g transform="translate(400 0) scale(-1 1)">${one}</g>`;
};
const glove=(mitten=false)=>{
 const band='M93 374Q108 383 126 384L123 394Q107 393 90 384Z';
 const one=mitten?path('M90 384L123 394Q129 398 134 402Q139 407 135 412Q131 416 126 411L120 405Q125 420 115 428Q106 436 95 430Q83 425 86 411Z',L)+path(band,M):path('M90 384L123 394Q129 397 134 402Q139 407 135 411Q131 415 126 410L119 404L118 425Q119 432 114 433Q109 434 109 427L107 415L107 435Q107 442 102 442Q97 442 98 435L100 415L96 434Q95 441 90 439Q85 437 87 430L92 412L87 427Q85 434 80 431Q76 428 80 421L87 401Z')+path(band);
 return one+`<g transform="translate(400 0) scale(-1 1)">${one}</g>`;
};
const assets=[
 {id:'tshirt',label:'T-shirt',category:'tops',slot:'top',box:[108,207,184,185],art:path(tee)},
 {id:'manches',label:'Manches longues',category:'tops',slot:'top',box:[87,205,226,185],art:path(longTop)+cuff},
 {id:'chandail',label:'Chandail à capuchon',category:'tops',slot:'top',box:[87,175,226,219],back:path(downHood,L),art:path(longTop,L)+line('M184 225v29m32-29v29')+path('M176 322h48l13 33q-37 10-74 0Z',L)+cuff},
 {id:'robe',label:'Robe d’été',category:'tops',slot:'dress',box:[121,205,158,290],art:path('M177 216Q160 216 146 225Q147 252 151 275Q149 302 147 319L130 476Q200 494 270 476L253 319Q251 302 249 275Q253 252 254 225Q240 216 223 216Q200 240 177 216Z')+line('M151 275q49 10 98 0')},
 {id:'misaison',label:'Veste légère',category:'outer',slot:'outer',box:[82,204,236,214],art:path(coat)+path('M178 214L166 237L184 251L200 226L216 251L234 237L222 214Q200 237 178 214Z')+line('M200 227v178m-38-60 18 5m40 0 18-5')+coatCuff},
 {id:'hiver',label:'Manteau d’hiver',category:'outer',slot:'outer',box:[84,163,232,255],back:path(winterHood),art:path(coat,M)+line('M150 282q50 10 100 0m-101 48q51 10 102 0m-104 48q53 10 106 0M112 311l25 10m-35 23 26 10m135-33 25-10m-16 43 26-10M200 226v180')+path('M174 212Q166 209 163 216Q151 214 153 225Q148 234 160 237Q172 241 185 229L200 221L215 229Q228 241 240 237Q252 234 247 225Q249 214 237 216Q234 209 226 212L221 220Q200 230 179 220Z')+path('M196 243h8v13h-8Z')},
 {id:'impermeable',label:'Imperméable',category:'outer',slot:'outer',box:[80,30,240,394],back:path(rainHood,L),headFront:path(`${rainHood} ${hoodOpening}`,L,'fill-rule="evenodd"'),art:path(coat,L)+line('M200 227v178m-40-59 23 5m34 0 23-5')+coatCuff},
 {id:'short',label:'Short',category:'bottoms',slot:'bottom',box:[139,358,122,113],art:path('M153 369Q200 379 247 369L256 458Q232 467 203 461L200 440L197 461Q168 467 144 458Z')+line('M154 384q46 9 92 0M200 383v44')},
 {id:'pantalon',label:'Pantalon',category:'bottoms',slot:'bottom',box:[131,357,138,221],art:path(trousers)+pantsDetail},
 {id:'neige',label:'Pantalon de neige',category:'bottoms',slot:'bib',box:[131,211,138,367],art:path(trousers,M)+path('M161 323V225Q168 221 177 220L180 323ZM220 323L223 220Q232 221 239 225V323Z',M)+path('M160 313h80l7 58q-47 17-94 0Z',M)+path('M166 333h68v24q-34 9-68 0Z',M)+line('M165 317h11m48 0h11M200 389v40m-57 111 39 3m36 0 39-3')},
 {id:'pluie',label:'Pantalon de pluie',category:'bottoms',slot:'bottom',box:[131,357,138,221],art:path(trousers,L)+line('M154 385q46 9 92 0M200 383v43')},
 {id:'jupe',label:'Jupe plissée',category:'bottoms',slot:'bottom',box:[111,356,178,145],art:path('M155 369Q200 379 245 369L279 482Q200 501 121 482Z')+line('M151 384q49 11 98 0M164 394l-23 89m42-86-9 92m43-92 9 92m10-95 23 89')},
 {id:'collants',label:'Collants',category:'bottoms',slot:'tights',box:[129,357,142,250],art:path(trousers,D)+footwear(D)},
 {id:'casquette',label:'Casquette',category:'head',slot:'head',box:[131,35,138,105],art:path('M148 113Q145 49 199 48Q253 49 252 113Z')+line('M200 49q-25 25-22 62')+path('M145 108Q200 96 255 108L262 126Q200 140 138 126Z',D)},
 {id:'tuque',label:'Tuque à pompon',category:'head',slot:'head',box:[132,20,136,119],art:path('M146 114Q143 52 200 50Q257 52 254 114Z',L)+path('M190 53q-12-3-11-13q-6-9 4-13q3-11 13-6q10-8 15 2q12 0 10 11q7 10-5 14q-5 10-15 5Z',L)+path('M143 103Q200 95 257 103L258 127Q200 139 142 127Z',M)+line('M154 105v20m15-21v23m15-24v25m16-26v27m16-26v25m15-24v23m15-22v20')},
 {id:'gants',label:'Gants',category:'extras',slot:'hands',box:[71,361,76,89],art:glove()},
 {id:'mitaines',label:'Mitaines',category:'extras',slot:'hands',box:[77,361,69,81],art:glove(true)},
 {id:'cachecou',label:'Cache-cou',category:'extras',slot:'neck',box:[157,187,86,67],art:path('M169 197Q200 218 231 197L235 239Q200 254 165 239Z',L)},
 {id:'souliers',label:'Souliers',category:'feet',slot:'feet',box:[103,547,89,77],art:footwear(W)+path(shoeSole,D)+`<g transform="translate(400 0) scale(-1 1)">${path(shoeSole,D)}</g>`},
 {id:'bottesPluie',label:'Bottes de pluie',category:'feet',slot:'feet',box:[103,506,99,119],art:footwear(L,true)},
 {id:'bottesHiver',label:'Bottes d’hiver',category:'feet',slot:'feet',box:[103,493,99,132],art:footwear(M,true,true)},
 {id:'creme',label:'Crème solaire',category:'extras',slot:'sunscreen',box:[303,459,55,106],art:path('M311 467h36l-4 66h-28Z')+path('M315 533h28v18h-28Z',D)+circle(329,495,4.5)+line('M329 486v-3m0 24v-3M320 495h-3m24 0h-3M322 488l-2-2m18 18-2-2m-14 0-2 2m18-18-2 2')}
];
// Rear pieces are painted behind the mannequin; front pieces stay above the body.
for(const asset of assets){asset.back??='';asset.front=asset.art;asset.headFront??='';asset.art=asset.back+asset.front+asset.headFront;}
const base=path('M180 191L179 219Q160 216 145 228Q126 253 117 285L95 375L122 384L146 307Q150 295 152 292L153 372L140 565Q160 572 180 566L200 437L220 566Q240 572 260 565L247 372L248 292Q250 295 254 307L278 384L305 375L283 285Q274 253 255 228Q240 216 221 219L220 191Z');
const bareHand=path('M95 375L122 384Q133 398 123 412Q113 425 100 418Q86 412 89 397Q89 384 95 375Z');
const bareHands=bareHand+`<g transform="translate(400 0) scale(-1 1)">${bareHand}</g>`;
const bareFoot=path('M139 558Q160 565 183 560L181 588Q169 606 138 609Q121 608 125 592Q128 578 139 558Z');
const bareFeet=bareFoot+`<g transform="translate(400 0) scale(-1 1)">${bareFoot}</g>`;
const hairBack=path('M151 111Q149 65 200 63Q251 65 249 111L265 244Q246 258 225 245L175 245Q154 258 135 244Z',L);
function head(character='short'){
 const fringe=character==='long'?'M151 111Q151 65 200 63Q249 65 249 111L242 125L237 92Q210 114 173 94L159 121Z':'M151 111Q151 65 200 63Q249 65 249 111L240 105L232 91Q205 110 170 94L159 117Z';
 const ears=path('M151 123Q137 118 138 134Q139 149 152 148Z M249 123Q263 118 262 134Q261 149 248 148Z');
 return ears+path(hoodOpening)+`<g clip-path="url(#head-shape)">${path(fringe,L)}</g>`+circle(181,139,2,'#000000')+circle(219,139,2,'#000000')+path('M197 146q-8 1-6 8q7 5 15 0q2-7-9-8Z')+line('M186 175q14 10 28 0');
}

return { assets, path, base, bareHands, bareFeet, hairBack, hoodOpening, head, colors: { white: W, light: L, mid: M, dark: D }, viewBox: '60 10 280 620' };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = wardrobe;
