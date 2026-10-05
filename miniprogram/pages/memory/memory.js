const api=require('../../utils/room-api');

Page({
  data:{
    code:'',honoree:'重要的人',tab:'notes',saving:false,uploading:false,uploadingMemento:false,
    notes:[],photos:[],mementos:[],
    noteText:'',editingNoteId:'',
    photoCaption:'',
    mementoTypes:['🎁','✉️','🌷','🎫','📷'],
    mType:'🎁',mTitle:'',mMeaning:'',mPhotoUrl:'',editingMementoId:''
  },

  onLoad(q){
    this.setData({
      code:String(q.code||'').toUpperCase(),
      tab:['notes','photos','mementos'].includes(q.tab)?q.tab:'notes'
    });
  },

  onShow(){this.loadRoom()},

  async loadRoom(){
    try{
      const r=await api.getRoom(this.data.code);
      this.setData({
        honoree:r.world&&r.world.honoree||'重要的人',
        notes:(r.memory&&r.memory.notes||[]).slice().reverse(),
        photos:(r.memory&&r.memory.photos||[]).slice().reverse(),
        mementos:(r.memory&&r.memory.mementos||[]).filter(x=>!x.hidden).slice().reverse()
      });
    }catch(e){
      wx.showToast({title:'回忆暂时加载失败',icon:'none'});
    }
  },

  switchTab(e){this.setData({tab:e.currentTarget.dataset.tab})},

  onNoteInput(e){this.setData({noteText:e.detail.value})},

  async saveNote(){
    const text=this.data.noteText.trim();
    if(!text)return wx.showToast({title:'先写一句话',icon:'none'});
    this.setData({saving:true});
    try{
      if(this.data.editingNoteId){
        await api.applyOp(this.data.code,'memory',{kind:'note:update',id:this.data.editingNoteId,text});
      }else{
        const avatar=api.getAvatar();
        await api.applyOp(this.data.code,'memory',{
          kind:'note:add',
          item:{id:api.uid(),authorName:avatar.name,by:avatar.name,text,time:Date.now()}
        });
        await api.addActivity(this.data.code,avatar.name,avatar.name+' 在留言墙贴了一张纸条');
      }
      this.setData({noteText:'',editingNoteId:''});
      await this.loadRoom();
      wx.showToast({title:'已经留在墙上'});
    }catch(e){
      wx.showToast({title:'保存失败，请重试',icon:'none'});
    }finally{this.setData({saving:false})}
  },

  editNote(e){
    const id=e.currentTarget.dataset.id;
    const item=this.data.notes.find(x=>x.id===id);
    if(item)this.setData({noteText:item.text||'',editingNoteId:id});
  },

  cancelNoteEdit(){this.setData({noteText:'',editingNoteId:''})},

  deleteNote(e){
    const id=e.currentTarget.dataset.id;
    wx.showModal({
      title:'删除这张留言？',
      content:'删除后房间里其他人也会同步看不到。',
      success:async r=>{
        if(!r.confirm)return;
        try{
          await api.applyOp(this.data.code,'memory',{kind:'note:remove',id});
          await this.loadRoom();
        }catch(_){wx.showToast({title:'删除失败',icon:'none'})}
      }
    });
  },

  onPhotoCaption(e){this.setData({photoCaption:e.detail.value})},

  pickPhoto(){
    wx.chooseMedia({
      count:1,
      mediaType:['image'],
      sourceType:['album','camera'],
      sizeType:['compressed'],
      success:async r=>{
        const file=r.tempFiles&&r.tempFiles[0];
        if(!file)return;
        this.setData({uploading:true});
        wx.showLoading({title:'上传照片'});
        try{
          const up=await api.uploadFile(this.data.code,file.tempFilePath);
          const avatar=api.getAvatar();
          const item={
            id:api.uid(),authorName:avatar.name,by:avatar.name,
            url:up.url,caption:this.data.photoCaption.trim(),time:Date.now()
          };
          await api.applyOp(this.data.code,'memory',{kind:'photo:add',item});
          await api.addActivity(this.data.code,avatar.name,avatar.name+' 在照片墙留下了一张照片');
          this.setData({photoCaption:''});
          await this.loadRoom();
          wx.showToast({title:'照片留下了'});
        }catch(e){
          wx.showToast({title:'照片上传失败',icon:'none'});
        }finally{
          wx.hideLoading();
          this.setData({uploading:false});
        }
      }
    });
  },

  deletePhoto(e){
    const id=e.currentTarget.dataset.id;
    wx.showModal({
      title:'删除这张照片？',
      success:async r=>{
        if(!r.confirm)return;
        try{
          await api.applyOp(this.data.code,'memory',{kind:'photo:remove',id});
          await this.loadRoom();
        }catch(_){wx.showToast({title:'删除失败',icon:'none'})}
      }
    });
  },

  pickType(e){this.setData({mType:e.currentTarget.dataset.type})},
  onMTitle(e){this.setData({mTitle:e.detail.value})},
  onMMeaning(e){this.setData({mMeaning:e.detail.value})},

  pickMementoPhoto(){
    wx.chooseMedia({
      count:1,
      mediaType:['image'],
      sourceType:['album','camera'],
      sizeType:['compressed'],
      success:async r=>{
        const file=r.tempFiles&&r.tempFiles[0];
        if(!file)return;
        this.setData({uploadingMemento:true});
        try{
          const up=await api.uploadFile(this.data.code,file.tempFilePath);
          this.setData({mPhotoUrl:up.url||''});
        }catch(_){
          wx.showToast({title:'图片上传失败',icon:'none'});
        }finally{this.setData({uploadingMemento:false})}
      }
    });
  },

  async saveMemento(){
    const avatar=api.getAvatar();
    const title=this.data.mTitle.trim()||'一件小东西';
    const meaning=this.data.mMeaning.trim()||'有人觉得它值得被留下。';
    this.setData({saving:true});
    try{
      if(this.data.editingMementoId){
        await api.applyOp(this.data.code,'memory',{
          kind:'memento:update',id:this.data.editingMementoId,
          title,meaning,type:this.data.mType
        });
      }else{
        await api.applyOp(this.data.code,'memory',{
          kind:'memento:add',
          item:{
            id:api.uid(),authorName:avatar.name,by:avatar.name,
            type:this.data.mType,photo:this.data.mPhotoUrl,
            title,meaning,x:50,y:78,time:Date.now()
          }
        });
        await api.addActivity(this.data.code,avatar.name,avatar.name+' 放下了「'+title+'」');
      }
      this.cancelMementoEdit();
      await this.loadRoom();
      wx.showToast({title:'纪念物已经留下'});
    }catch(e){
      wx.showToast({title:'保存失败，请重试',icon:'none'});
    }finally{this.setData({saving:false})}
  },

  editMemento(e){
    const id=e.currentTarget.dataset.id;
    const item=this.data.mementos.find(x=>x.id===id);
    if(!item)return;
    this.setData({
      editingMementoId:id,mType:item.type||'🎁',
      mTitle:item.title||'',mMeaning:item.meaning||'',mPhotoUrl:item.photo||''
    });
  },

  cancelMementoEdit(){
    this.setData({editingMementoId:'',mType:'🎁',mTitle:'',mMeaning:'',mPhotoUrl:''});
  },

  deleteMemento(e){
    const id=e.currentTarget.dataset.id;
    wx.showModal({
      title:'移除这件纪念物？',
      success:async r=>{
        if(!r.confirm)return;
        try{
          await api.applyOp(this.data.code,'memory',{kind:'memento:remove',id});
          await this.loadRoom();
        }catch(_){wx.showToast({title:'删除失败',icon:'none'})}
      }
    });
  }
});