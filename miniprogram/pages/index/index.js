const app=getApp();
const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode=()=>Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
Page({
  data:{mode:'join',code:'',name:'',honoree:''},
  onLoad(q){ if(q.code){this.setData({code:String(q.code).toUpperCase(),mode:'join'});} },
  setJoin(){this.setData({mode:'join'})}, setCreate(){this.setData({mode:'create'})},
  onCode(e){this.setData({code:e.detail.value.toUpperCase()})},
  onName(e){this.setData({name:e.detail.value})}, onHonoree(e){this.setData({honoree:e.detail.value})},
  joinRoom(){
    const code=this.data.code.trim().toUpperCase(),name=this.data.name.trim()||'朋友';
    if(code.length!==6)return wx.showToast({title:'请输入6位邀请码',icon:'none'});
    wx.request({url:`${app.globalData.serverUrl}/api/rooms/${code}`,success:r=>{
      if(r.statusCode!==200)return wx.showToast({title:'没找到这个房间',icon:'none'});
      wx.navigateTo({url:`/pages/room/room?code=${code}&name=${encodeURIComponent(name)}`});
    },fail:()=>wx.showToast({title:'连不上房间服务器',icon:'none'})});
  },
  createRoom(){
    const code=randomCode(),name=this.data.name.trim()||'房主',honoree=this.data.honoree.trim()||'重要的人';
    wx.request({url:`${app.globalData.serverUrl}/api/rooms`,method:'POST',data:{code,world:{occasion:'生日',honoree,invite:'今晚，我们在这里等你。',theme:'cream'},memory:{mementos:[],notes:[],photos:[],activity:[]}},success:r=>{
      if(r.statusCode!==200)return wx.showToast({title:'创建失败，请重试',icon:'none'});
      wx.navigateTo({url:`/pages/room/room?code=${code}&name=${encodeURIComponent(name)}&host=1`});
    },fail:()=>wx.showToast({title:'连不上房间服务器',icon:'none'})});
  }
});
