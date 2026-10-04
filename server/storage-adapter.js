'use strict';

const fs=require('fs');
const path=require('path');

class FileRoomStore {
  constructor({dataDir,filename='rooms.json',debounceMs=80}){
    this.dataDir=dataDir;
    this.file=path.join(dataDir,filename);
    this.debounceMs=debounceMs;
    this.timer=null;
    fs.mkdirSync(dataDir,{recursive:true});
  }
  load(){
    try{return JSON.parse(fs.readFileSync(this.file,'utf8'))||{}}
    catch(_){return {}}
  }
  saveSoon(snapshot){
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.saveNow(snapshot),this.debounceMs);
  }
  saveNow(snapshot){
    const tmp=this.file+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(snapshot,null,2));
    fs.renameSync(tmp,this.file);
  }
  info(){return {kind:'file',path:this.file}}
}

function createRoomStore(options){
  const kind=(process.env.PIXEL_ROOM_STORE||'file').toLowerCase();
  if(kind!=='file'){
    throw new Error('Unsupported PIXEL_ROOM_STORE='+kind+'. V15.1 ships the provider-neutral interface and file adapter; choose a database provider before enabling another adapter.');
  }
  return new FileRoomStore(options);
}

module.exports={FileRoomStore,createRoomStore};
