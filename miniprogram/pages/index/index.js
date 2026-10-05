const app=getApp();
const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode=()=>Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
const ok=status=>status>=200&&status<300;

Page({
  data:{mode:'join',code:'',name:'',honoree:'',loading:false},

  onLoad(q){
    if(q.code){
      const code=String(q.code).replace(/[^A-Z0-9]/gi,'').slice(0,6).toUpperCase();
      this.setData({code,mode:'join'});
    }
  },

  setJoin(){if(!this.data.loading)this.setData({mode:'join'})},
  setCreate(){if(!this.data.loading)this.setData({mode:'create'})},
  onCode(e){
    const code=String(e.detail.value||'').replace(/[^A-Z0-9]/gi,'').slice(0,6).toUpperCase();
    this.setData({code});
    return code;
  },
  onName(e){this.setData({name:e.detail.value})},
  onHonoree(e){this.setData({honoree:e.detail.value})},

  joinRoom(){
    if(this.data.loading)return;
    const code=this.data.code.trim().toUpperCase();
    const name=this.data.name.trim()||'朋友';
    if(code.length!==6)return wx.showToast({title:'请输入6位邀请码',icon:'none'});
    this.setData({loading:true});
    wx.request({
      url:app.globalData.serverUrl+'/api/rooms/'+code,
      timeout:8000,
      success:r=>{
        if(!ok(r.statusCode))return wx.showToast({title:'没找到这个房间',icon:'none'});
        wx.navigateTo({url:'/pages/room/room?code='+code+'&name='+encodeURIComponent(name)});
      },
      fail:()=>wx.showToast({title:'暂时连不上房间服务器',icon:'none'}),
      complete:()=>this.setData({loading:false})
    });
  },

  createRoom(){
    if(this.data.loading)return;
    const code=randomCode();
    const name=this.data.name.trim()||'房主';
    const honoree=this.data.honoree.trim()||'重要的人';
    this.setData({loading:true});
    wx.request({
      url:app.globalData.serverUrl+'/api/rooms',
      method:'POST',
      timeout:8000,
      data:{
        code,
        world:{occasion:'生日',honoree,invite:'今晚，我们在这里等你。',theme:'cream'},
        memory:{mementos:[],notes:[],photos:[],activity:[]}
      },
      success:r=>{
        if(!ok(r.statusCode))return wx.showToast({title:'创建失败，请重试',icon:'none'});
        wx.navigateTo({url:'/pages/room/room?code='+code+'&name='+encodeURIComponent(name)+'&host=1'});
      },
      fail:()=>wx.showToast({title:'暂时连不上房间服务器',icon:'none'}),
      complete:()=>this.setData({loading:false})
    });
  }
});