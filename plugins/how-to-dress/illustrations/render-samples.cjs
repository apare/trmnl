// Prepare the real transform results for the offline Liquid-render checks.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'src/transform.js'),'utf8'),context);
const run=vm.runInContext('run',context);
const samples={};
for(const name of fs.readdirSync(path.join(root,'samples')).filter(f=>f.endsWith('.json'))){
 samples[name.slice(0,-5)]=run(JSON.parse(fs.readFileSync(path.join(root,'samples',name),'utf8')));
}
fs.mkdirSync(path.join(root,'_build'),{recursive:true});
fs.writeFileSync(path.join(root,'_build/sample-inputs.json'),JSON.stringify(samples));
console.log(`Prepared ${Object.keys(samples).length} local forecast samples.`);
