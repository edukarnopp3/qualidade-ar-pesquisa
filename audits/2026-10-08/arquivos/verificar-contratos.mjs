import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { utils, read, write } from 'xlsx';
import JSZip from 'jszip';
import { normalizeRows, sha256, analyze } from '../../../src/core.js';
import { createPackage, openPackage, readBounded } from '../../../src/packages.js';
import { exportWorkbook, exportPdf, exportCsv, safeCell } from '../../../src/exports.js';
import { readInput } from '../../../src/importer.js';
const folder=path.dirname(fileURLToPath(import.meta.url)), evidence=[];
async function fixture() {
 const bytes=new TextEncoder().encode('entrada sintetica'), hash=await sha256(bytes), sourceId=hash.slice(0,16), units={CO2:{unit:'ppm',confirmed:true}};
 const normalized=normalizeRows([{data_local:'2026-10-01 00:00',CO2:500},{data_local:'2026-10-01 00:01',CO2:700}],{format:'wide',date:'data_local',columns:{CO2:'CO2'}},{sensorId:'AUDIT-SYNTHETIC',offsetMinutes:-180,units},sourceId);
 const dataset={id:'synthetic-case',name:'Controle sintetico',environment:'escola',synthetic:true,sensorId:'AUDIT-SYNTHETIC',sensorLabel:'Controle',offsetMinutes:-180,nominalIntervalSeconds:60,units,sources:[{id:sourceId,name:'sintetico.txt',hash,bytes,size:bytes.length,rows:2,origin:'synthetic'}],observations:normalized.observations,issues:[],decisions:[],hasInputs:true};
 const analysis=analyze(dataset,{parameter:'CO2',window:'hour',start:Date.UTC(2026,9,1,3),end:Date.UTC(2026,9,1,4)});
 const run={id:'synthetic-run',createdAt:'2026-10-08T00:00:00Z',caseName:dataset.name,datasetId:dataset.id,sensorId:dataset.sensorId,offsetMinutes:-180,analysis};
 return {dataset,run};
}
{
 const {dataset,run}=await fixture();
 const full=await createPackage(dataset,run,[run],true), shared=await createPackage(dataset,run,[run],false);
 const a=await openPackage(new File([full],'full.aircase')), b=await openPackage(new File([shared],'shared.aircase'));
 assert.deepEqual(a.run,run); assert.deepEqual(b.run,run); assert.equal(a.dataset.observations.length,2); assert.equal(b.dataset.observations.length,0); assert.equal(b.dataset.hasInputs,false); assert.equal(await sha256(a.dataset.sources[0].bytes),dataset.sources[0].hash); assert.equal(b.dataset.sources[0].bytes,undefined);
 evidence.push({id:'full-shared-normal',passed:true,mean:a.run.analysis.summary.mean,fullObservations:2,sharedObservations:0,sharedHasInputs:false});
 const wb=read(await exportWorkbook(dataset,run).arrayBuffer(),{type:'array'}), results=utils.sheet_to_json(wb.Sheets.Resultados), csv=await exportCsv(run).text();
 assert.equal(results[0].media,600); assert.equal(results[0].leituras_usadas,2); assert.equal(results[0].slots_esperados,60); assert.equal(results[0].cobertura,2/60);
 assert.ok(csv.includes('"600"')); assert.equal(safeCell('=HYPERLINK("x")'),'\'=HYPERLINK("x")'); assert.equal(safeCell(-600),-600);
 await fs.writeFile(path.join(folder,'gabarito-600.pdf'),new Uint8Array(await exportPdf(dataset,run).arrayBuffer()));
 await fs.writeFile(path.join(folder,'gabarito-600.xlsx'),new Uint8Array(await exportWorkbook(dataset,run).arrayBuffer()));
 await fs.writeFile(path.join(folder,'gabarito-600.csv'),csv);
 evidence.push({id:'exports-independent-oracle',expected:{mean:(500+700)/2,p95:500+.95*(700-500),n:2,coverage:2/60},excel:results[0],csvIncludesMean:true});
 const zip=await JSZip.loadAsync(await full.arrayBuffer()); zip.file('execution.json','{}');
 let message=''; try {await openPackage(new File([await zip.generateAsync({type:'uint8array'})],'tampered.aircase'));}catch(e){message=e.message;}
 assert.match(message,/Integridade divergente/); evidence.push({id:'tamper-rejection',passed:true,message});
}
{
 const {dataset,run}=await fixture(); const zip=await JSZip.loadAsync(await (await createPackage(dataset,run,[run],false)).arrayBuffer());
 const manifest=JSON.parse(await zip.file('manifest.json').async('string')), badRun={...run,analysis:{...run.analysis,bins:{not:'an array'}}}, json=JSON.stringify(badRun);
 zip.file('execution.json',json); manifest.files['execution.json']=await sha256(json); zip.file('manifest.json',JSON.stringify(manifest));
 const bytes=await zip.generateAsync({type:'uint8array'}), opened=await openPackage(new File([bytes],'bins-invalido.aircase'));
 let message='';try {exportCsv(opened.run);}catch(e){message=e.message;}
 assert.match(message,/map/); evidence.push({id:'schema-bins-invalid',accepted:true,bins:opened.run.analysis.bins,exportError:message});
 await fs.writeFile(path.join(folder,'sintetico-bins-invalidos.aircase'),bytes);
}
{
 const {dataset,run}=await fixture(); const generated=[];
 for(let i=0;i<148;i++) {const bytes=new TextEncoder().encode(`origem sintetica ${i}`),hash=await sha256(bytes); generated.push({id:hash.slice(0,16),name:`source-${i}.csv`,bytes,size:bytes.length,hash});}
 dataset.sources=generated;
 const saved=await createPackage(dataset,run,[run],true); let message='';try{await openPackage(new File([saved],'148-fontes.aircase'));}catch(e){message=e.message;}
 assert.match(message,/arquivos demais/); evidence.push({id:'own-package-too-many-sources',sources:148,manifestFiles:151,size:saved.size,created:true,reopened:false,message});
 await fs.writeFile(path.join(folder,'sintetico-148-fontes.aircase'),new Uint8Array(await saved.arrayBuffer()));
}
{
 const zip=new JSZip();zip.file('payload','x'.repeat(100000)); const loaded=await JSZip.loadAsync(await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}));let message='';try{await readBounded(loaded.file('payload'),1000);}catch(e){message=e.message;}
 assert.match(message,/excede o limite/); evidence.push({id:'bounded-uncompression',passed:true,message});
}
{
 const {dataset,run}=await fixture();const zip=await JSZip.loadAsync(await (await createPackage(dataset,run,[run],false)).arrayBuffer());const manifest=JSON.parse(await zip.file('manifest.json').async('string'));manifest.schemaVersion=2;zip.file('manifest.json',JSON.stringify(manifest));let message='';try{await openPackage(new File([await zip.generateAsync({type:'uint8array'})],'schema2.aircase'));}catch(e){message=e.message;}assert.match(message,/Versão de pacote incompatível/);evidence.push({id:'schema-version-rejection',passed:true,message});
}
{
 const wb=utils.book_new();utils.book_append_sheet(wb,utils.aoa_to_sheet([['data_local','CO2']]),'Dados brutos');utils.book_append_sheet(wb,utils.aoa_to_sheet([['data_local','CO2'],['2026-10-01 00:00',600]]),'Historico');
 const bytes=write(wb,{type:'array',bookType:'xlsx'});let message='';try{await readInput(new File([bytes],'aba-vazia-com-historico.xlsx'));}catch(e){message=e.message;}assert.match(message,/não contém linhas/);evidence.push({id:'empty-preferred-sheet-blocks-valid-sheet',validDataRows:1,emptyPreferred:'Dados brutos',message});
 await fs.writeFile(path.join(folder,'sintetico-aba-vazia-com-historico.xlsx'),new Uint8Array(bytes));
}
{
 const wb=utils.book_new();utils.book_append_sheet(wb,utils.aoa_to_sheet([['data_local','sensor_id','CO2'],['2026-10-01 00:00','SCHOOL',600]]),'Dados brutos');utils.book_append_sheet(wb,utils.aoa_to_sheet([['data_local','sensor_id','CO2'],['2026-10-01 00:00','SCHOOL',600],['2026-10-01 00:00','HOSPITAL',900]]),'Resumo todos sensores');
 const bytes=write(wb,{type:'array',bookType:'xlsx'});let message='';try{await readInput(new File([bytes],'aba-escola-com-resumo.xlsx'));}catch(e){message=e.message;}assert.match(message,/vários sensores/);evidence.push({id:'unselected-mixed-sheet-blocks-valid-sheet',validDataRows:1,validPreferred:'Dados brutos',message});
 await fs.writeFile(path.join(folder,'sintetico-aba-escola-com-resumo.xlsx'),new Uint8Array(bytes));
}
await fs.writeFile(path.join(folder,'contratos-evidencias.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
