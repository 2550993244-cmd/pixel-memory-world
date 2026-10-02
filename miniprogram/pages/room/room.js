const app=getApp();
const uid=()=>`${Date.now()}-${Math.random().toString(16).slice(2)}`;
Page({
  data:{code:'',honoree:'重要的人',chat:'',lastChat:'',players:[],celebrated:false,recording:false,lastVoiceUrl:''},
  socket:null,player:null,recorder:null,
  onLoad(q){
    const code=String(q.code||'').toUpperCase(),name=decodeURIComponent(q.name||'朋友');
    this.player={id:uid(),name,x:50,y:76,hair:'1',outfit:'coral',item:'🎁',host:q.host==='1',celebrated:false};
    this.setData({code});
    wx.request({url:`${app.globalData.serverUrl}/api/rooms/${code}`,success:r=>{if(r.data?.world)this.setData({honoree:r.data.world.honoree||'重要的人'})}});
    this.connect();
    this.recorder=wx.getRecorderManager();
    this.recorder.onStop(res=>this.uploadVoice(res.tempFilePath));
  },
  onUnload(){try{this.send({type:'leave',sender:this.player.id,player:this.player});this.socket?.close({})}catch(e){}},
  connect(){
    const base=app.globalData.serverUrl.replace(/^http:/,'ws:').replace(/^https:/,'wss:');
    const channel=`pixel-memory-v9-live-${this.data.code}`;
    this.socket=wx.connectSocket({url:`${base}/ws?room=${this.data.code}&channel=${encodeURIComponent(channel)}&player=${encodeURIComponent(this.player.id)}`});
    this.socket.onOpen(()=>this.send({type:'hello',sender:this.player.id,player:this.player}));
    this.socket.onMessage(e=>{let m;try{m=JSON.parse(e.data)}catch(_){return}if(m.sender===this.player.id)return;this.receive(m)});
    this.socket.onError(()=>wx.showToast({title:'实时连接失败',icon:'none'}));
  },
  receive(m){
    let ps=[...this.data.players];
    const upsert=p=>{if(!p)return;const i=ps.findIndex(x=>x.id===p.id);if(i>=0)ps[i]=p;else ps.push(p)};
    if(['hello','state','move','celebrate','chat','voice'].includes(m.type)){upsert(m.player);if(m.type==='hello')this.send({type:'state',sender:this.player.id,player:this.player});}
    if(m.type==='leave'&&m.player)ps=ps.filter(x=>x.id!==m.player.id);
    if(m.type==='chat')this.setData({lastChat:`${m.player.name}：${m.text}`});
    if(m.type==='voice'&&m.url)this.setData({lastVoiceUrl:m.url,lastChat:`${m.player.name} 留了一段声音 🎙`});
    upsert(this.player);this.setData({players:ps});
  },
  send(obj){try{this.socket?.send({data:JSON.stringify(obj)})}catch(e){}},
  move(e){const dx=+e.currentTarget.dataset.dx,dy=+e.currentTarget.dataset.dy;this.player.x=Math.max(5,Math.min(95,this.player.x+dx));this.player.y=Math.max(12,Math.min(92,this.player.y+dy));this.refreshSelf();this.send({type:'move',sender:this.player.id,player:this.player})},
  refreshSelf(){let ps=[...this.data.players];const i=ps.findIndex(x=>x.id===this.player.id);if(i>=0)ps[i]={...this.player};else ps.push({...this.player});this.setData({players:ps})},
  onChat(e){this.setData({chat:e.detail.value})},
  sendChat(){const t=this.data.chat.trim();if(!t)return;this.setData({chat:'',lastChat:`我：${t}`});this.send({type:'chat',sender:this.player.id,player:this.player,text:t})},
  celebrate(){this.player.celebrated=!this.player.celebrated;this.setData({celebrated:this.player.celebrated});this.refreshSelf();this.send({type:'celebrate',sender:this.player.id,player:this.player});wx.vibrateShort({type:'light'})},
  toggleRecord(){
    if(this.data.recording){this.recorder.stop();this.setData({recording:false});return;}
    wx.authorize({scope:'scope.record',success:()=>{this.recorder.start({duration:15000,format:'mp3'});this.setData({recording:true});},fail:()=>wx.showToast({title:'需要麦克风权限',icon:'none'})});
  },
  uploadVoice(path){
    wx.showLoading({title:'保存声音'});
    wx.uploadFile({url:`${app.globalData.serverUrl}/api/uploads`,filePath:path,name:'file',formData:{room:this.data.code},success:r=>{wx.hideLoading();let d;try{d=JSON.parse(r.data)}catch(_){return}if(d.url){this.setData({lastVoiceUrl:d.url});this.send({type:'voice',sender:this.player.id,player:this.player,url:d.url});wx.showToast({title:'声音留下了'})}},fail:()=>{wx.hideLoading();wx.showToast({title:'上传失败',icon:'none'})}})
  },
  playLastVoice(){if(!this.data.lastVoiceUrl)return wx.showToast({title:'还没有语音',icon:'none'});const a=wx.createInnerAudioContext();a.src=this.data.lastVoiceUrl;a.play()},
  onShareAppMessage(){return{title:`来${this.data.honoree}的小小世界吧｜${this.data.code}`,path:`/pages/index/index?code=${this.data.code}`}}
});
