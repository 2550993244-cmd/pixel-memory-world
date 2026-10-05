const accessKey=code=>'pixel-room-access:'+String(code||'').toUpperCase();
const actorKey='pixel-memory-actor-v1';
const actorTokenKey='pixel-memory-actor-token-v1';
const avatarKey='pixel-memory-avatar-v1';

const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
const longToken=()=>uid()+uid()+uid();

function serverUrl(){
  return String(getApp().globalData.serverUrl||'').replace(/\/$/,'');
}

function getAccess(code){
  return wx.getStorageSync(accessKey(code))||{};
}

function saveAccess(code,patch){
  const current=getAccess(code);
  const next={...current,...patch};
  wx.setStorageSync(accessKey(code),next);
  return next;
}

function ensureActor(){
  let id=wx.getStorageSync(actorKey);
  let token=wx.getStorageSync(actorTokenKey);
  if(!id){id=uid();wx.setStorageSync(actorKey,id)}
  if(!token){token=longToken();wx.setStorageSync(actorTokenKey,token)}
  return {id:String(id),token:String(token)};
}

function actorHeaders(){
  const a=ensureActor();
  return {'X-Actor-Id':a.id,'X-Actor-Token':a.token};
}

function accessHeaders(code,{mutation=false,upload=false}={}){
  const a=getAccess(code);
  const h={};
  if(a.inviteToken)h['X-Room-Invite']=String(a.inviteToken);
  if(a.ownerToken)h['X-Room-Owner']=String(a.ownerToken);
  if(mutation||upload)Object.assign(h,actorHeaders());
  if(upload)h['X-Room-Code']=String(code||'').toUpperCase();
  return h;
}

function request({url,method='GET',data,header={},timeout=12000}){
  return new Promise((resolve,reject)=>{
    wx.request({
      url,method,data,header:{'content-type':'application/json',...header},timeout,
      success:r=>{
        if(r.statusCode>=200&&r.statusCode<300)resolve(r.data);
        else{
          const e=new Error((r.data&&r.data.error)||('HTTP_'+r.statusCode));
          e.statusCode=r.statusCode;e.data=r.data||{};
          reject(e);
        }
      },
      fail:reject
    });
  });
}

function getRoom(code){
  return request({
    url:serverUrl()+'/api/rooms/'+encodeURIComponent(String(code).toUpperCase()),
    header:{...accessHeaders(code),...actorHeaders()}
  });
}

function applyOp(code,scope,op){
  return request({
    url:serverUrl()+'/api/rooms/'+encodeURIComponent(String(code).toUpperCase())+'/ops',
    method:'POST',
    header:accessHeaders(code,{mutation:true}),
    data:{scope,op}
  });
}

function uploadFile(code,filePath){
  return new Promise((resolve,reject)=>{
    wx.uploadFile({
      url:serverUrl()+'/api/uploads',
      filePath,
      name:'file',
      header:accessHeaders(code,{mutation:true,upload:true}),
      success:r=>{
        let data={};
        try{data=JSON.parse(r.data||'{}')}catch(_){}
        if(r.statusCode>=200&&r.statusCode<300)resolve(data);
        else{
          const e=new Error(data.error||('HTTP_'+r.statusCode));
          e.statusCode=r.statusCode;e.data=data;reject(e);
        }
      },
      fail:reject
    });
  });
}

function activityItem(name,text){
  const now=new Date();
  const hh=String(now.getHours()).padStart(2,'0');
  const mm=String(now.getMinutes()).padStart(2,'0');
  return {
    id:uid(),
    authorName:name||'朋友',
    by:name||'朋友',
    time:hh+':'+mm,
    text:String(text||'')
  };
}

async function addActivity(code,name,text){
  return applyOp(code,'memory',{kind:'activity:add',item:activityItem(name,text)});
}

function getAvatar(){
  return wx.getStorageSync(avatarKey)||{
    name:'朋友',
    hair:'1',
    outfit:'coral',
    item:'🎁'
  };
}

function saveAvatar(avatar){
  const next={...getAvatar(),...avatar};
  wx.setStorageSync(avatarKey,next);
  return next;
}

module.exports={
  uid,
  serverUrl,
  getAccess,
  saveAccess,
  ensureActor,
  actorHeaders,
  accessHeaders,
  getRoom,
  applyOp,
  uploadFile,
  addActivity,
  getAvatar,
  saveAvatar
};
