const app=getApp();
const roomApi=require('../../utils/room-api');
const uid=()=>Date.now()+'-'+Math.random().toString(16).slice(2);

Page({
  data:{
    code:'',honoree:'重要的人',chat:'',lastChat:'',players:[],
    celebrated:false,recording:false,lastVoiceUrl:'',playerId:'',
    showMemoryPanel:false,
    memoryStats:{notes:0,mementos:0,photos:0,activity:0},
    memoryChart:[
      {key:'notes',label:'留言',value:0,width:0},
      {key:'mementos',label:'纪念物',value:0,width:0},
      {key:'photos',label:'照片',value:0,width:0}
    ],
    recentActivity:[],
    visibleMementos:[]
  },

  socket:null,player:null,recorder:null,audio:null,
  socketReady:false,unloading:false,reconnectTimer:null,inviteToken:'',
  memory:{notes:[],mementos:[],photos:[],activity:[]},

  onLoad(q){
    const code=String(q.code||'').toUpperCase();
    const cached=roomApi.getAccess(code);
    this.inviteToken=String(q.invite||cached.inviteToken||'');
    if(this.inviteToken)roomApi.saveAccess(code,{inviteToken:this.inviteToken});

    const savedAvatar=roomApi.getAvatar();
    const queryName=decodeURIComponent(q.name||'').trim();
    if(queryName&&(!savedAvatar.name||savedAvatar.name==='朋友')){
      roomApi.saveAvatar({...savedAvatar,name:queryName});
    }
    const avatar=roomApi.getAvatar();

    this.player={
      id:uid(),
      name:queryName||avatar.name||'朋友',
      x:50,y:76,
      hair:avatar.hair||'1',
      outfit:avatar.outfit||'coral',
      item:avatar.item||'🎁',
      host:q.host==='1',
      celebrated:false
    };

    this.setData({code,playerId:this.player.id,players:[{...this.player}]});
    this.refreshRoomData();

    this.recorder=wx.getRecorderManager();
    this.recorder.onStop(res=>{
      this.setData({recording:false});
      if(res.tempFilePath)this.uploadVoice(res.tempFilePath);
    });

    this.connect();
  },

  onShow(){
    if(!this.player||!this.data.code)return;
    const avatar=roomApi.getAvatar();
    const changed=
      this.player.name!==avatar.name||
      this.player.hair!==avatar.hair||
      this.player.outfit!==avatar.outfit||
      this.player.item!==avatar.item;

    if(changed){
      this.player={
        ...this.player,
        name:avatar.name||this.player.name,
        hair:avatar.hair||'1',
        outfit:avatar.outfit||'coral',
        item:avatar.item||'🎁'
      };
      this.refreshSelf();
      this.send({type:'state',sender:this.player.id,player:this.player});
    }

    this.refreshRoomData();
  },

  async refreshRoomData(){
    if(!this.data.code)return;
    try{
      const r=await roomApi.getRoom(this.data.code);
      if(r.world)this.setData({honoree:r.world.honoree||'重要的人'});
      if(r.memory)this.applyMemorySnapshot(r.memory);
    }catch(_){}
  },

  onUnload(){
    this.unloading=true;
    if(this.reconnectTimer)clearTimeout(this.reconnectTimer);
    try{this.send({type:'leave',sender:this.player.id,player:this.player})}catch(e){}
    try{this.socket&&this.socket.close({})}catch(e){}
    try{this.audio&&this.audio.destroy()}catch(e){}
  },

  connect(){
    if(this.unloading)return;
    if(!this.inviteToken){
      wx.showToast({title:'缺少邀请凭证',icon:'none'});
      return;
    }

    const actor=roomApi.ensureActor();
    const base=app.globalData.serverUrl.replace(/^http:/,'ws:').replace(/^https:/,'wss:');
    const channel='pixel-memory-live-'+this.data.code;
    const url=
      base+'/ws?room='+this.data.code+
      '&channel='+encodeURIComponent(channel)+
      '&player='+encodeURIComponent(this.player.id)+
      '&invite='+encodeURIComponent(this.inviteToken)+
      '&actorId='+encodeURIComponent(actor.id)+
      '&actorToken='+encodeURIComponent(actor.token);

    this.socketReady=false;
    this.socket=wx.connectSocket({url});

    this.socket.onOpen(()=>{
      this.socketReady=true;
      this.send({type:'hello',sender:this.player.id,player:this.player});
    });

    this.socket.onMessage(e=>{
      let m;
      try{m=JSON.parse(e.data)}catch(_){return}
      if(m.sender===this.player.id)return;
      this.receive(m);
    });

    this.socket.onError(()=>{
      wx.showToast({title:'实时连接正在重试',icon:'none'});
    });

    this.socket.onClose(()=>{
      this.socketReady=false;
      if(this.unloading)return;
      if(this.reconnectTimer)clearTimeout(this.reconnectTimer);
      this.reconnectTimer=setTimeout(()=>this.connect(),1800);
    });
  },

  receive(m){
    let ps=[...this.data.players];
    const upsert=p=>{
      if(!p)return;
      const i=ps.findIndex(x=>x.id===p.id);
      if(i>=0)ps[i]=p;else ps.push(p);
    };

    if(m.type==='room-snapshot'){
      if(m.world)this.setData({honoree:m.world.honoree||this.data.honoree});
      if(m.memory)this.applyMemorySnapshot(m.memory);
    }

    if(m.type==='memory-op'&&m.op)this.applyMemoryOp(m.op);

    if(['hello','state','move','celebrate','chat','voice'].includes(m.type)){
      upsert(m.player);
      if(m.type==='hello')this.send({type:'state',sender:this.player.id,player:this.player});
    }

    if(m.type==='leave'&&m.player)ps=ps.filter(x=>x.id!==m.player.id);

    if(m.type==='chat'){
      this.setData({lastChat:(m.player&&m.player.name||'朋友')+'：'+m.text});
    }

    if(m.type==='voice'&&m.url){
      this.setData({
        lastVoiceUrl:m.url,
        lastChat:(m.player&&m.player.name||'朋友')+' 留了一段声音 🎙'
      });
    }

    upsert(this.player);
    this.setData({players:ps});
  },

  applyMemorySnapshot(memory){
    this.memory={
      notes:Array.isArray(memory.notes)?memory.notes:[],
      mementos:Array.isArray(memory.mementos)?memory.mementos:[],
      photos:Array.isArray(memory.photos)?memory.photos:[],
      activity:Array.isArray(memory.activity)?memory.activity:[]
    };
    this.refreshMemoryVisuals();
  },

  applyMemoryOp(op){
    if(!op||!op.kind)return;

    const upsert=(list,item)=>{
      if(!item)return list;
      const next=[...list];
      const i=next.findIndex(x=>x.id===item.id);
      if(i>=0)next[i]={...next[i],...item};else next.push(item);
      return next;
    };

    if(op.kind==='note:add')this.memory.notes=upsert(this.memory.notes,op.item);
    if(op.kind==='note:update'){
      this.memory.notes=this.memory.notes.map(x=>x.id===op.id?{...x,text:op.text,editedAt:op.editedAt||Date.now()}:x);
    }
    if(op.kind==='note:remove')this.memory.notes=this.memory.notes.filter(x=>x.id!==op.id);

    if(op.kind==='memento:add')this.memory.mementos=upsert(this.memory.mementos,op.item);
    if(op.kind==='memento:update'){
      this.memory.mementos=this.memory.mementos.map(x=>x.id===op.id?{
        ...x,
        title:typeof op.title==='string'?op.title:x.title,
        meaning:typeof op.meaning==='string'?op.meaning:x.meaning,
        type:typeof op.type==='string'?op.type:x.type,
        editedAt:op.editedAt||Date.now()
      }:x);
    }
    if(op.kind==='memento:hide'){
      this.memory.mementos=this.memory.mementos.map(x=>x.id===op.id?{...x,hidden:!!op.hidden}:x);
    }
    if(op.kind==='memento:remove')this.memory.mementos=this.memory.mementos.filter(x=>x.id!==op.id);

    if(op.kind==='photo:add')this.memory.photos=upsert(this.memory.photos,op.item);
    if(op.kind==='photo:remove')this.memory.photos=this.memory.photos.filter(x=>x.id!==op.id);
    if(op.kind==='activity:add')this.memory.activity=upsert(this.memory.activity,op.item).slice(-60);

    this.refreshMemoryVisuals();
  },

  refreshMemoryVisuals(){
    const visibleMementos=this.memory.mementos.filter(x=>!x.hidden);
    const counts={
      notes:this.memory.notes.length,
      mementos:visibleMementos.length,
      photos:this.memory.photos.length,
      activity:this.memory.activity.length
    };

    const max=Math.max(1,counts.notes,counts.mementos,counts.photos);
    const chart=[
      {key:'notes',label:'留言',value:counts.notes,width:counts.notes?Math.max(10,Math.round(counts.notes/max*100)):0},
      {key:'mementos',label:'纪念物',value:counts.mementos,width:counts.mementos?Math.max(10,Math.round(counts.mementos/max*100)):0},
      {key:'photos',label:'照片',value:counts.photos,width:counts.photos?Math.max(10,Math.round(counts.photos/max*100)):0}
    ];

    const recent=this.memory.activity
      .slice()
      .reverse()
      .slice(0,8)
      .map((item,index)=>({
        id:item.id||('activity-'+index),
        text:String(item.text||'留下了一段回忆'),
        time:String(item.time||'')
      }));

    const visibleMementos=this.memory.mementos
      .filter(x=>!x.hidden)
      .map(x=>({
        id:x.id,type:x.type||'✦',photo:x.photo||'',
        x:Number.isFinite(Number(x.x))?Number(x.x):50,
        y:Number.isFinite(Number(x.y))?Number(x.y):78,
        title:x.title||'纪念物'
      }));
    this.setData({memoryStats:counts,memoryChart:chart,recentActivity:recent,visibleMementos});
  },

  openMemoryPanel(){this.setData({showMemoryPanel:true})},
  closeMemoryPanel(){this.setData({showMemoryPanel:false})},
  noop(){},

  goMemory(e){
    const tab=e.currentTarget.dataset.tab||'notes';
    this.setData({showMemoryPanel:false});
    wx.navigateTo({
      url:'/pages/memory/memory?code='+this.data.code+
        '&tab='+tab+
        '&x='+encodeURIComponent(this.player.x)+
        '&y='+encodeURIComponent(this.player.y)
    });
  },

  goAvatar(){
    this.setData({showMemoryPanel:false});
    wx.navigateTo({url:'/pages/avatar/avatar?code='+this.data.code});
  },

  goOutside(){
    this.setData({showMemoryPanel:false});
    wx.navigateTo({url:'/pages/outside/outside?code='+this.data.code});
  },

  goKeepsake(){
    this.setData({showMemoryPanel:false});
    wx.navigateTo({url:'/pages/keepsake/keepsake?code='+this.data.code});
  },

  send(obj){
    if(!this.socketReady)return;
    try{this.socket.send({data:JSON.stringify(obj)})}catch(e){}
  },

  move(e){
    const dx=Number(e.currentTarget.dataset.dx||0);
    const dy=Number(e.currentTarget.dataset.dy||0);
    this.player.x=Math.max(5,Math.min(95,this.player.x+dx));
    this.player.y=Math.max(12,Math.min(92,this.player.y+dy));
    this.refreshSelf();
    this.send({type:'move',sender:this.player.id,player:this.player});
  },

  refreshSelf(){
    const ps=[...this.data.players];
    const i=ps.findIndex(x=>x.id===this.player.id);
    if(i>=0)ps[i]={...this.player};else ps.push({...this.player});
    this.setData({players:ps});
  },

  onChat(e){this.setData({chat:e.detail.value})},

  sendChat(){
    const t=this.data.chat.trim();
    if(!t)return;
    this.setData({chat:'',lastChat:'我：'+t});
    this.send({type:'chat',sender:this.player.id,player:this.player,text:t});
  },

  celebrate(){
    this.player.celebrated=!this.player.celebrated;
    this.setData({celebrated:this.player.celebrated});
    this.refreshSelf();
    this.send({type:'celebrate',sender:this.player.id,player:this.player});
    wx.vibrateShort({type:'light'});
  },

  toggleRecord(){
    if(this.data.recording){
      this.recorder.stop();
      return;
    }

    wx.getSetting({
      success:s=>{
        if(s.authSetting['scope.record']===true)return this.startRecord();

        if(s.authSetting['scope.record']===false){
          return wx.showModal({
            title:'需要麦克风权限',
            content:'录音只会在你主动点击后开始，用来把一段声音留在当前房间。',
            confirmText:'去设置',
            success:r=>{if(r.confirm)wx.openSetting({})}
          });
        }

        wx.authorize({
          scope:'scope.record',
          success:()=>this.startRecord(),
          fail:()=>wx.showToast({title:'未获得麦克风权限',icon:'none'})
        });
      }
    });
  },

  startRecord(){
    this.recorder.start({duration:15000,format:'mp3'});
    this.setData({recording:true});
    wx.showToast({title:'开始录音，最长15秒',icon:'none'});
  },

  async uploadVoice(path){
    wx.showLoading({title:'保存声音'});
    try{
      const d=await roomApi.uploadFile(this.data.code,path);
      if(d.url){
        this.setData({lastVoiceUrl:d.url});
        this.send({type:'voice',sender:this.player.id,player:this.player,url:d.url});
        wx.showToast({title:'声音留下了'});
      }
    }catch(_){
      wx.showToast({title:'上传失败',icon:'none'});
    }finally{wx.hideLoading()}
  },

  playLastVoice(){
    if(!this.data.lastVoiceUrl)return wx.showToast({title:'还没有语音',icon:'none'});
    try{this.audio&&this.audio.destroy()}catch(e){}
    this.audio=wx.createInnerAudioContext();
    this.audio.src=this.data.lastVoiceUrl;
    this.audio.play();
  },

  onShareAppMessage(){
    return{
      title:'来'+this.data.honoree+'的小小世界吧｜'+this.data.code,
      path:'/pages/index/index?code='+this.data.code+
        '&invite='+encodeURIComponent(this.inviteToken)
    };
  }
});