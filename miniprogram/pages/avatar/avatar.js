const api=require('../../utils/room-api');

Page({
  data:{
    code:'',name:'朋友',hair:'1',outfit:'coral',item:'🎁',
    hairOptions:['1','2','3'],
    outfitOptions:[
      {value:'coral',label:'珊瑚'},
      {value:'blue',label:'湖蓝'},
      {value:'sage',label:'鼠尾草'},
      {value:'butter',label:'奶油黄'}
    ],
    itemOptions:['🎁','🌷','✉️','📷','🎫']
  },

  onLoad(q){
    const a=api.getAvatar();
    this.setData({code:String(q.code||'').toUpperCase(),...a});
  },

  onName(e){this.setData({name:e.detail.value})},
  chooseHair(e){this.setData({hair:e.currentTarget.dataset.value})},
  chooseOutfit(e){this.setData({outfit:e.currentTarget.dataset.value})},
  chooseItem(e){this.setData({item:e.currentTarget.dataset.value})},

  saveAvatar(){
    const name=this.data.name.trim()||'朋友';
    api.saveAvatar({
      name,
      hair:this.data.hair,
      outfit:this.data.outfit,
      item:this.data.item
    });
    wx.showToast({title:'形象保存好了'});
    setTimeout(()=>wx.navigateBack({delta:1}),350);
  }
});