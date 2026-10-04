/* Pixel Memory World · V15.1 Tiled map runtime
   Loads the external Tiled-compatible JSON map and exposes normalized helpers.
   Runtime always falls back to PixelSceneMap so offline/file-mode rooms still work. */
(() => {
  const MAP_URL='./assets/maps/outdoor-v15.tiled.json?v=15.1';
  let tiled=null;
  let error=null;

  const prop=(obj,name,fallback=null)=>{
    const p=(obj?.properties||[]).find(x=>x.name===name);
    return p ? p.value : fallback;
  };
  const layer=name=>tiled?.layers?.find(l=>l.name===name)||null;
  const dims=()=>{
    if(tiled) return {
      width:(Number(prop(tiled,'worldWidth'))||tiled.width*tiled.tilewidth),
      height:(Number(prop(tiled,'worldHeight'))||tiled.height*tiled.tileheight),
      cols:tiled.width,
      rows:tiled.height,
      tileSize:tiled.tilewidth,
      viewportScale:Number(prop(tiled,'viewportScale'))||1.24
    };
    const w=window.PixelSceneMap?.outdoor?.world||{};
    return {
      width:Number(w.width)||1600,
      height:Number(w.height)||960,
      cols:Number(w.cols)||40,
      rows:Number(w.rows)||24,
      tileSize:Number(w.tileSize)||40,
      viewportScale:Number(w.viewportScale)||1.24
    };
  };
  const xyPct=(x,y)=>{
    const d=dims();
    return {x:x/d.width*100,y:y/d.height*100};
  };

  const api={
    version:'15.1',
    get ready(){return ready},
    get tiled(){return tiled},
    get error(){return error},
    get source(){return tiled?'tiled-json':'scene-map-fallback'},
    dimensions:dims,
    getLayer(name){return layer(name)},
    pathPoints(){
      const l=layer('Path');
      const line=l?.objects?.find(o=>Array.isArray(o.polyline));
      if(line){
        return line.polyline.map(p=>xyPct((line.x||0)+p.x,(line.y||0)+p.y));
      }
      return (window.PixelSceneMap?.outdoor?.layers?.path?.points||[]).map(p=>({x:p[0],y:p[1]}));
    },
    collisionBounds(){
      const l=layer('Collision');
      if(l){
        return {
          left:Number(prop(l,'boundsLeft',3.5)),
          right:Number(prop(l,'boundsRight',96.5)),
          top:Number(prop(l,'boundsTop',8)),
          bottom:Number(prop(l,'boundsBottom',93))
        };
      }
      return window.PixelSceneMap?.outdoor?.layers?.collision?.bounds||{left:3.5,right:96.5,top:8,bottom:93};
    },
    collisionEllipses(){
      const l=layer('Collision');
      if(l){
        const d=dims();
        return (l.objects||[]).filter(o=>o.ellipse).map(o=>({
          id:o.name||String(o.id),
          x:(o.x+o.width/2)/d.width*100,
          y:(o.y+o.height/2)/d.height*100,
          rx:o.width/2/d.width*100,
          ry:o.height/2/d.height*100
        }));
      }
      return window.PixelSceneMap?.outdoor?.layers?.collision?.ellipses||[];
    },
    object(type){
      const l=layer('Objects');
      const o=l?.objects?.find(x=>x.type===type||x.name===type);
      if(o){
        const p=xyPct(o.x||0,o.y||0);
        return {...p,id:o.id,name:o.name,type:o.type};
      }
      return window.PixelSceneMap?.outdoor?.layers?.objects?.[type]||null;
    },
    spawn(){
      const l=layer('Meta');
      const o=l?.objects?.find(x=>x.type==='spawn');
      return o?xyPct(o.x||0,o.y||0):{x:9,y:82};
    },
    async reload(){
      try{
        const res=await fetch(MAP_URL,{cache:'no-store'});
        if(!res.ok) throw new Error('MAP_HTTP_'+res.status);
        const data=await res.json();
        if(data?.type!=='map'||!Array.isArray(data.layers)) throw new Error('INVALID_TILED_MAP');
        tiled=data;error=null;
        window.dispatchEvent(new CustomEvent('pixel-map-ready',{detail:{source:'tiled-json',version:prop(data,'pixelMemoryVersion','15.1')}}));
        return data;
      }catch(e){
        error=e;
        window.dispatchEvent(new CustomEvent('pixel-map-ready',{detail:{source:'scene-map-fallback',error:String(e?.message||e)}}));
        return null;
      }
    }
  };

  const ready=api.reload();
  window.PixelMapRuntime=api;
})();