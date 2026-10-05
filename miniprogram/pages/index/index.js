const app=getApp();
const roomApi=require('../../utils/room-api');
const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode=()=>Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
const ok=status=>status>=200&&status<300;
const accessKey=code=>'pixel-room-access:'+code;

Page({
  data:{mode:'join',code:'',name:'',honoree:'',loading:false},
  pendingInvite:'',

  onLoad(q){
    if(q.code){
      const code=String(q.code).replace(/[^A-Z0-9]/gi,'').slice(0,6).toUpperCase();
      this.pendingInvite=String(q.invite||'');
      if(this.pendingInvite){
        const cached=wx.getStorageSync(accessKey(code))||{};
        wx.setStorageSync(accessKey(code),{...cached,inviteToken:this.pendingInvite});
      }
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
    roomApi.saveAvatar({...roomApi.getAvatar(),name});
    roomApi.ensureActor();
    if(code.length!==6)return wx.showToast({title:'请输入6位房间码',icon:'none'});

    const cached=wx.getStorageSync(accessKey(code))||{};
    const invite=this.pendingInvite||cached.inviteToken||'';

    if(!invite){
      return wx.showModal({
        title:'还缺邀请凭证',
        content:'6位房间码只是房间门牌号。请从房主分享的小程序卡片进入，邀请凭证会自动带上。',
        showCancel:false,
        confirmText:'知道了'
      });
    }

    this.setData({loading:true});
    wx.request({
      url:app.globalData.serverUrl+'/api/rooms/'+code,
      header:{'X-Room-Invite':invite},
      timeout:12000,
      success:r=>{
        if(!ok(r.statusCode))return wx.showToast({title:'邀请已失效或房间不存在',icon:'none'});
        wx.setStorageSync(accessKey(code),{...cached,inviteToken:invite});
        wx.navigateTo({
          url:'/pages/room/room?code='+code+
            '&name='+encodeURIComponent(name)+
            '&invite='+encodeURIComponent(invite)
        });
      },
      fail:()=>wx.showToast({title:'暂时连不上房间服务器',icon:'none'}),
      complete:()=>this.setData({loading:false})
    });
  },

  createRoom(){
    if(this.data.loading)return;
    const code=randomCode();
    const name=this.data.name.trim()||'房主';
    roomApi.saveAvatar({...roomApi.getAvatar(),name});
    roomApi.ensureActor();
    const honoree=this.data.honoree.trim()||'重要的人';
    this.setData({loading:true});

    wx.request({
      url:app.globalData.serverUrl+'/api/rooms',
      method:'POST',
      timeout:12000,
      data:{
        code,
        world:{occasion:'生日',honoree,invite:'今晚，我们在这里等你。',theme:'cream'},
        memory:{mementos:[],notes:[],photos:[],activity:[]}
      },
      success:r=>{
        if(!ok(r.statusCode))return wx.showToast({title:'创建失败，请重试',icon:'none'});

        const inviteToken=String(r.data&&r.data.inviteToken||'');
        const ownerToken=String(r.data&&r.data.ownerToken||'');
        wx.setStorageSync(accessKey(code),{inviteToken,ownerToken,honoree});

        wx.navigateTo({
          url:'/pages/room/room?code='+code+
            '&name='+encodeURIComponent(name)+
            '&host=1'+
            '&invite='+encodeURIComponent(inviteToken)
        });
      },
      fail:()=>wx.showToast({title:'暂时连不上房间服务器',icon:'none'}),
      complete:()=>this.setData({loading:false})
    });
  }
});