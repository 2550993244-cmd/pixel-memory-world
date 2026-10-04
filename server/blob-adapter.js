'use strict';

const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

class FileBlobStore {
  constructor({uploadDir}){
    this.uploadDir=uploadDir;
    fs.mkdirSync(uploadDir,{recursive:true});
  }
  save(buffer,originalName='upload.bin'){
    const ext=(path.extname(originalName)||'.bin').replace(/[^.a-zA-Z0-9]/g,'');
    const name=`${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(this.uploadDir,name),buffer);
    return {key:name,name:originalName,size:buffer.length};
  }
  pathFor(key){
    const p=path.resolve(this.uploadDir,'.'+('/'+String(key||'')));
    return p.startsWith(path.resolve(this.uploadDir))?p:null;
  }
  remove(key){
    const p=this.pathFor(key);
    if(!p||!fs.existsSync(p)) return false;
    fs.unlinkSync(p);
    return true;
  }
  removeMany(keys=[]){
    let removed=0;
    for(const key of new Set(keys||[])){
      try{if(this.remove(key))removed++}catch(_){}
    }
    return removed;
  }
  info(){return {kind:'file',path:this.uploadDir}}
}

function createBlobStore(options){
  const kind=(process.env.PIXEL_BLOB_STORE||'file').toLowerCase();
  if(kind!=='file'){
    throw new Error('Unsupported PIXEL_BLOB_STORE='+kind+'. V15.1 ships the provider-neutral interface and file adapter; choose an object-storage provider before enabling another adapter.');
  }
  return new FileBlobStore(options);
}

module.exports={FileBlobStore,createBlobStore};
