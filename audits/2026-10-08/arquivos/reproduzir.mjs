import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {utils,write,read,SSF} from 'xlsx';
import JSZip from 'jszip';
import {readInput} from '../../../src/importer.js';
import {normalizeRows,sha256,analyze,localIso} from '../../../src/core.js';
import {createPackage,openPackage} from '../../../src/packages.js';
import {exportWorkbook,exportPdf,exportCsv} from '../../../src/exports.js';
const folder=path.dirname(fileURLToPath(import.meta.url));
const context={sensorId:'AUDIT-SYNTHETIC',offsetMinutes:-180,units:{CO2:{unit:'ppm',confirmed:true}}};
const evidence=[];
async function checkFile(name,bytes) {
 await fs.writeFile(path.join(folder,name),new Uint8Array(bytes));
 const input=await readInput(new File([bytes],name));
 const sheet=input.sheets.find(s=>s.name===input.selectedSheet);
 const normalized=normalizeRows(sheet.rows,sheet.mapping,context,'audit-source');
 return {parsedRows:sheet.rows,mapping:sheet.mapping,observations:normalized.observations.map(o=>({value:o.value,originalTime:o.originalTime,localTime:localIso(o.timestamp,context.offsetMinutes),row:o.rowNumber})),issues:normalized.issues};
}
const modernSerial1904=(Date.UTC(2026,9,1)-Date.UTC(1904,0,1))/86400000;
const wb1904=utils.book_new();
const s1904=utils.aoa_to_sheet([['data_local','CO2'],[modernSerial1904,600]]);
s1904.A2.z='yyyy-mm-dd hh:mm:ss';
utils.book_append_sheet(wb1904,s1904,'Dados brutos');
wb1904.Workbook={WBProps:{date1904:true}};
evidence.push({id:'excel1904',expected:'2026-10-01T00:00:00',serial:modernSerial1904,libraryCalendar:SSF.parse_date_code(modernSerial1904,{date1904:true}),...await checkFile('excel-1904-sintetico.xlsx',write(wb1904,{type:'array',bookType:'xlsx'}))});
for(const [name,csv] of [
 ['csv-data-br.csv','data_local;CO2\r\n01/10/2026 00:00;600\r\n02/10/2026 00:00;700\r\n'],
 ['csv-decimal-comma.csv','data_local;CO2\r\n2026-10-01 00:00;"600,5"\r\n2026-10-01 00:01;"700,5"\r\n'],
 ['csv-iso-date.csv','data_local,CO2\r\n2026-10-01 00:00,600.5\r\n2026-10-01 00:01,700.5\r\n'],
 ['csv-formula.csv','data_local;CO2\r\n2026-10-01 00:00;=600+1\r\n']
]) evidence.push({id:name,...await checkFile(name,new TextEncoder().encode(csv))});
async function fixture() {
 const bytes=new TextEncoder().encode('entrada sintética'),hash=await sha256(bytes),sourceId=hash.slice(0,16);
 const normalized=normalizeRows([{data_local:'2026-10-01 00:00',CO2:500},{data_local:'2026-10-01 00:01',CO2:700}],{format:'wide',date:'data_local',columns:{CO2:'CO2'}},context,sourceId);
 const dataset={id:'synthetic-case',name:'Controle sintético',environment:'escola',synthetic:true,sensorId:context.sensorId,sensorLabel:'Sensor sintético',offsetMinutes:-180,nominalIntervalSeconds:60,units:context.units,sources:[{id:sourceId,name:'sintetico.txt',hash,bytes,size:bytes.length,rows:2,origin:'synthetic'}],observations:normalized.observations,issues:[],decisions:[],hasInputs:true};
 const analysis=analyze(dataset,{parameter:'CO2',window:'hour',start:Date.UTC(2026,9,1,3),end:Date.UTC(2026,9,1,4)});
 const run={id:'synthetic-run',createdAt:'2026-10-08T00:00:00Z',caseName:dataset.name,datasetId:dataset.id,sensorId:dataset.sensorId,offsetMinutes:-180,analysis};
 return {dataset,run};
}
{
 const {dataset,run}=await fixture();
 dataset.nominalIntervalSeconds=300;
 dataset.sensorLabel='Nome posterior à execução';
 dataset.units.CO2.confirmed=false;
 const exported=read(await exportWorkbook(dataset,run).arrayBuffer(),{type:'array'});
 evidence.push({id:'export-historical-metadata',archivedNominalInterval:60,currentNominalInterval:dataset.nominalIntervalSeconds,executionCoverage:run.analysis.quality.coverage,exportedMethod:utils.sheet_to_json(exported.Sheets.Metodo),exportedResults:utils.sheet_to_json(exported.Sheets.Resultados)});
 await fs.writeFile(path.join(folder,'execucao-historica-metadados-atuais.xlsx'),new Uint8Array(await exportWorkbook(dataset,run).arrayBuffer()));
}
{
 const {dataset,run}=await fixture();
 dataset.decisions=[{at:'2026-10-08T00:01:00Z',observationId:dataset.observations[0].id,include:true,reason:'Escolhi a leitura 500 ppm; a original 700 ppm é conflito.'}];
 const shared=await createPackage(dataset,run,[run],false);
 const opened=await openPackage(new File([shared],'sintetico-compartilhavel.aircase'));
 evidence.push({id:'shared-decisions',individualObservations:opened.dataset.observations.length,decisions:opened.dataset.decisions});
 await fs.writeFile(path.join(folder,'sintetico-compartilhavel.aircase'),new Uint8Array(await shared.arrayBuffer()));
}
{
 const {dataset,run}=await fixture();
 const full=await createPackage(dataset,run,[run],true);
 const zip=await JSZip.loadAsync(await full.arrayBuffer());
 const originalManifest=JSON.parse(await zip.file('manifest.json').async('string'));
 const editedCase=JSON.parse(await zip.file('case.json').async('string'));
 editedCase.id='another-case';
 editedCase.sensorId='another-sensor';
 const data=JSON.stringify(editedCase);
 zip.file('case.json',data);
 originalManifest.files['case.json']=await sha256(data);
 zip.file('manifest.json',JSON.stringify(originalManifest));
 const modified=await zip.generateAsync({type:'uint8array'});
 const opened=await openPackage(new File([modified],'inconsistent.aircase'));
 evidence.push({id:'package-inconsistent-schema',datasetId:opened.dataset.id,runDatasetId:opened.run.datasetId,datasetSensor:opened.dataset.sensorId,runSensor:opened.run.sensorId,accepted:true});
 await fs.writeFile(path.join(folder,'sintetico-inconsistente.aircase'),modified);
}
await fs.writeFile(path.join(folder,'evidencias.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
