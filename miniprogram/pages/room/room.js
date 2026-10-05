const app=getApp();
const uid=()=>Date.now()+'-'+Math.random().toString(16).slice(2);
const accessKey=code=>'pixel-room-access:'+code;

Page({
  data:{
    code:'',honoree:'重要的人',chat:'',lastChat:'',players:[],
    celebrated:false,recording:false,lastVoiceUrl:'',playerId:''
  },

  socket:null,player:null,recorder:null,audio:null,
  socketReady:false,unloading:false,reconnectTimer:null,inviteToken:'',

  onLoad(q){
    const code=String(q.code||'').toUpperCase();
    const name=decodeURIComponent(q.name||'朋友');
    const cached=wx.getStorageSync(accessKey(code))||{};
    this.inviteToken=String(q.invite||cached.inviteToken||'');

    if(this.inviteToken){
      wx.setStorageSync(accessKey(code),{...cached,inviteToken:this.inviteToken});
    }

    this.player={
      id:uid(),name,x:50,y:76,hair:'1',outfit:'coral',
      item:'🎁',host:q.host==='1',celebrated:false
    };

    this.setData({code,playerId:this.player.id,players:[{...this.player}]});

    wx.request({
      url:app.globalData.serverUrl+'/api/rooms/'+code,
      header:this.inviteToken?{'X-Room-Invite':this.inviteToken}:{},
      timeout:12000,
      success:r=>{
        if(r.statusCode===200&&r.data&&r.data.world){
          this.setData({honoree:r.data.world.honoree||'重要的人'});
        }
      }
    });

    this.recorder=wx.getRecorderManager();
    this.recorder.onStop(res=>{
      this.setData({recording:false});
      if(res.tempFilePath)this.uploadVoice(res.tempFilePath);
    });

    this.connect();
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

    const base=app.globalData.serverUrl.replace(/^http:/,'ws:').replace(/^https:/,'wss:');
    const channel='pixel-memory-live-'+this.data.code;
    const url=
      base+'/ws?room='+this.data.code+
      '&channel='+encodeURIComponent(channel)+
      '&player='+encodeURIComponent(this.player.id)+
      '&invite='+encodeURIComponent(this.inviteToken);

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
      if(i>=0)ps[i]=p; else ps.push(p);
    };

    if(['hello','state','move','celebrate','chat','voice'].includes(m.type)){
      upsert(m.player);
      if(m.type==='hello'){
        this.send({type:'state',sender:this.player.id,player:this.player});
      }
    }

    if(m.type==='leave'&&m.player){
      ps=ps.filter(x=>x.id!==m.player.id);
    }

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
    if(i>=0)ps[i]={...this.player}; else ps.push({...this.player});
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

  uploadVoice(path){
    wx.showLoading({title:'保存声音'});

    wx.uploadFile({
      url:app.globalData.serverUrl+'/api/uploads',
      filePath:path,
      name:'file',
      formData:{room:this.data.code},
      success:r=>{
        let d;
        try{d=JSON.parse(r.data)}catch(_){return}
        if(d.url){
          this.setData({lastVoiceUrl:d.url});
          this.send({
            type:'voice',
            sender:this.player.id,
            player:this.player,
            url:d.url
          });
          wx.showToast({title:'声音留下了'});
        }
      },
      fail:()=>wx.showToast({title:'上传失败',icon:'none'}),
      complete:()=>wx.hideLoading()
    });
  },

  playLastVoice(){
    if(!this.data.lastVoiceUrl){
      return wx.showToast({title:'还没有语音',icon:'none'});
    }

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