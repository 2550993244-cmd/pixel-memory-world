const api=require('../../utils/room-api');

Page({
  data:{
    code:'',honoree:'重要的人',avatar:{name:'朋友',hair:'1',outfit:'coral',item:'🎁'},
    questItems:[],playerX:50,playerY:82,nearbyId:'',
    spots:[
      {key:'meadow',label:'草地',icon:'🌿',x:28,y:72},
      {key:'bridge',label:'小桥',icon:'⌁',x:48,y:57},
      {key:'pond',label:'湖边',icon:'◌',x:69,y:68},
      {key:'hill',label:'山坡',icon:'▲',x:73,y:33},
      {key:'mailbox',label:'邮箱',icon:'✉',x:86,y:48}
    ],
    selectedSpot:'meadow',questTitle:'',questText:'',questImage:'',
    saving:false,uploading:false,selectedQuest:null
  },

  onLoad(q){
    this.setData({code:String(q.code||'').toUpperCase(),avatar:api.getAvatar()});
  },

  onShow(){this.loadQuest()},

  async loadQuest(){
    try{
      const r=await api.getRoom(this.data.code);
      const items=(r.quest&&r.quest.items||[]).filter(x=>!x.hidden).sort((a,b)=>(a.order||0)-(b.order||0));
      this.setData({honoree:r.world&&r.world.honoree||'重要的人',questItems:items});
      this.updateNearby();
    }catch(_){wx.showToast({title:'门外地图加载失败',icon:'none'})}
  },

  move(e){
    const dx=Number(e.currentTarget.dataset.dx||0);
    const dy=Number(e.currentTarget.dataset.dy||0);
    this.setData({
      playerX:Math.max(7,Math.min(93,this.data.playerX+dx)),
      playerY:Math.max(12,Math.min(91,this.data.playerY+dy))
    });
    this.updateNearby();
  },

  updateNearby(){
    let best='',dist=999;
    this.data.questItems.forEach(item=>{
      const d=Math.hypot(this.data.playerX-Number(item.x||50),this.data.playerY-Number(item.y||50));
      if(d<10&&d<dist){best=item.id;dist=d}
    });
    this.setData({nearbyId:best});
  },

  discoverNearby(){
    const item=this.data.questItems.find(x=>x.id===this.data.nearbyId);
    if(item)this.setData({selectedQuest:item});
  },

  openQuestItem(e){
    const item=this.data.questItems.find(x=>x.id===e.currentTarget.dataset.id);
    if(item)this.setData({selectedQuest:item});
  },

  closeQuestDetail(){this.setData({selectedQuest:null})},
  noop(){},

  chooseSpot(e){this.setData({selectedSpot:e.currentTarget.dataset.key})},
  onQuestTitle(e){this.setData({questTitle:e.detail.value})},
  onQuestText(e){this.setData({questText:e.detail.value})},

  pickQuestImage(){
    wx.chooseMedia({
      count:1,mediaType:['image'],sourceType:['album','camera'],sizeType:['compressed'],
      success:async r=>{
        const file=r.tempFiles&&r.tempFiles[0];
        if(!file)return;
        this.setData({uploading:true});
        try{
          const up=await api.uploadFile(this.data.code,file.tempFilePath);
          this.setData({questImage:up.url||''});
        }catch(_){wx.showToast({title:'线索照片上传失败',icon:'none'})}
        finally{this.setData({uploading:false})}
      }
    });
  },

  async saveQuest(){
    const title=this.data.questTitle.trim();
    const text=this.data.questText.trim();
    if(!title&&!text)return wx.showToast({title:'先写一点回忆',icon:'none'});
    const spot=this.data.spots.find(x=>x.key===this.data.selectedSpot)||this.data.spots[0];
    const avatar=api.getAvatar();
    this.setData({saving:true});
    try{
      const item={
        id:api.uid(),
        authorName:avatar.name,by:avatar.name,
        order:this.data.questItems.length+1,
        title:title||'一段藏在路上的回忆',
        text:text||'看到它的时候，希望你会想起那一天。',
        image:this.data.questImage,
        icon:spot.icon,x:spot.x,y:spot.y,time:Date.now()
      };
      await api.applyOp(this.data.code,'quest',{kind:'add',item});
      await api.addActivity(this.data.code,avatar.name,avatar.name+' 在门外藏下了「'+item.title+'」');
      this.setData({questTitle:'',questText:'',questImage:''});
      await this.loadQuest();
      wx.showToast({title:'已经藏在路上'});
    }catch(_){wx.showToast({title:'保存失败，请重试',icon:'none'})}
    finally{this.setData({saving:false})}
  },

  deleteSelectedQuest(){
    const item=this.data.selectedQuest;
    if(!item)return;
    wx.showModal({
      title:'删除这段门外回忆？',
      success:async r=>{
        if(!r.confirm)return;
        try{
          await api.applyOp(this.data.code,'quest',{kind:'remove',id:item.id});
          this.setData({selectedQuest:null});
          await this.loadQuest();
        }catch(_){wx.showToast({title:'删除失败',icon:'none'})}
      }
    });
  },

  onShareAppMessage(){
    const a=api.getAccess(this.data.code);
    return{
      title:'来'+this.data.honoree+'的小小世界门外走走吧',
      path:'/pages/index/index?code='+this.data.code+'&invite='+encodeURIComponent(a.inviteToken||'')
    };
  }
});