/* Pixel Memory World · V15.1 character asset runtime
   Defines the spritesheet contract before final artwork is selected.
   Current DOM sprites remain the fallback until atlas.image is provided. */
(() => {
  const URL='./assets/characters/manifest-v1.json?v=15.1';
  let manifest=null,error=null;
  const api={
    version:'15.1',
    get manifest(){return manifest},
    get error(){return error},
    get ready(){return ready},
    get atlasReady(){return !!manifest?.atlas?.image},
    get mode(){return manifest?.mode||'dom-fallback'},
    action(name){return manifest?.actions?.[name]||null},
    async reload(){
      try{
        const r=await fetch(URL,{cache:'no-store'});
        if(!r.ok)throw new Error('CHARACTER_MANIFEST_HTTP_'+r.status);
        const data=await r.json();
        if(!data?.actions||!data?.logicalFrame)throw new Error('INVALID_CHARACTER_MANIFEST');
        manifest=data;error=null;
        window.dispatchEvent(new CustomEvent('pixel-character-manifest-ready',{detail:{atlasReady:!!data.atlas?.image,version:data.runtimeVersion}}));
        return data;
      }catch(e){
        error=e;
        return null;
      }
    }
  };
  const ready=api.reload();
  window.PixelCharacterRuntime=api;
})();