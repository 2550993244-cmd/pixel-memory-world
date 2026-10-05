const api=require('../../utils/room-api');

Page({
  data:{
    code:'',honoree:'重要的人',occasion:'生日',invite:'',displayDate:'',
    stats:{people:0,notes:0,mementos:0,photos:0},
    people:[],lastLine:'这里还在等第一句话。',totalMemories:0,
    meter:{notes:0,mementos:0,photos:0}
  },

  onLoad(q){this.setData({code:String(q.code||'').toUpperCase()})},
  onShow(){this.loadCard()},

  async loadCard(){
    try{
      const r=await api.getRoom(this.data.code);
      const memory=r.memory||{},world=r.world||{};
      const notes=memory.notes||[],mementos=(memory.mementos||[]).filter(x=>!x.hidden),photos=memory.photos||[];
      const names=[];
      const add=n=>{const s=String(n||'').trim();if(s&&!names.includes(s))names.push(s)};
      notes.forEach(x=>add(x.by||x.authorName));
      mementos.forEach(x=>add(x.by||x.authorName));
      photos.forEach(x=>{
        add(x.by||x.authorName);
        (x.names||[]).forEach(add);
      });
      (memory.activity||[]).forEach(x=>add(x.by||x.authorName));

      const total=notes.length+mementos.length+photos.length;
      const pct=n=>total?Math.round(n/total*100):0;
      let displayDate='';
      if(world.date){
        const p=String(world.date).split('-');
        if(p.length===3)displayDate=p[0]+'年'+Number(p[1])+'月'+Number(p[2])+'日';
      }
      if(!displayDate){
        const d=new Date(r.meta&&r.meta.createdAt||Date.now());
        displayDate=d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日';
      }

      const last=notes.length?notes[notes.length-1]:null;
      this.setData({
        honoree:world.honoree||'重要的人',
        occasion:world.occasion||'生日',
        invite:world.invite||'今晚，我们在这里等你。',
        displayDate,
        people:names.slice(0,10),
        stats:{people:names.length,notes:notes.length,mementos:mementos.length,photos:photos.length},
        lastLine:last?'“'+(last.text||'')+'” — '+(last.by||last.authorName||'朋友'):'这里还在等第一句话。',
        totalMemories:total,
        meter:{notes:pct(notes.length),mementos:pct(mementos.length),photos:pct(photos.length)}
      });
    }catch(_){wx.showToast({title:'纪念卡加载失败',icon:'none'})}
  },

  backToRoom(){wx.navigateBack({delta:1})},

  onShareAppMessage(){
    const a=api.getAccess(this.data.code);
    return{
      title:this.data.honoree+'的小小世界纪念卡',
      path:'/pages/index/index?code='+this.data.code+'&invite='+encodeURIComponent(a.inviteToken||'')
    };
  }
});