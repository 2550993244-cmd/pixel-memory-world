/* Pixel Memory World · Memory Quest
   Adds the "想去看看外面？" door, playable memory trail, photo→pixel clues,
   map placement, voice recording, discovery, and room↔outside transitions.
*/
(() => {
  const questState = {
    x: 9,
    y: 82,
    keys: new Set(),
    walking: false,
    nearby: null,
    items: [],
    found: new Set(),
    editorOpen: false,
    placing: false,
    selectedAsset: null,
    generated: [],
    sourcePhoto: '',
    pendingVoiceKey: '',
    pendingVoiceBlob: null,
    pendingVoiceUrl: '',
    recorder: null,
    recordStream: null,
    recordChunks: [],
    recordTimer: null,
    recordStartedAt: 0,
    recordObjectUrl: '',
    channel: null,
    players: new Map(),
    stepTick: 0,
    lastMoveSent: 0,
    completedShown: false,
    fishing: { casts: 0, catches: 0, waiting: false, biting: false }
  };

  // Historical localStorage key is intentionally retained for backward compatibility.
  const questKey = () => `pixel-memory-v9-quest-${state.roomCode || 'draft'}`;
  const questLiveKey = () => `pixel-memory-quest-live-${state.roomCode || 'draft'}`;

  // The door is a real object in the original room rather than a menu item.
  if (!fixedObjects.some(o => o.id === 'quest')) {
    fixedObjects.push({ id: 'quest', x: 92, y: 41, r: 10.5, label: '想去看看外面？' });
  }

  const baseUpdateNear = updateNear;
  updateNear = function () {
    baseUpdateNear();
    const door = $('#questDoor');
    if (door) door.classList.toggle('near', state.near?.id === 'quest');
  };

  const baseInteractNear = interactNear;
  interactNear = function () {
    if (state.near?.id === 'quest') return openQuestFromRoom();
    return baseInteractNear();
  };

  $('#questDoor')?.addEventListener('click', e => {
    e.preventDefault();
    openQuestFromRoom();
  });

  function transition(copy, midpoint) {
    const overlay = $('#doorTransition');
    if (!overlay) return midpoint?.();
    $('.door-transition-copy p', overlay).textContent = copy;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => midpoint?.(), 380);
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }, 850);
  }

  function openQuestFromRoom() {
    if (state.screen !== 'world') return;
    const door = $('#questDoor');
    door?.classList.add('opening');
    reaction(state.player.id, '✦');
    addActivity(`${state.player.name} 推开门，去外面的回忆地图了`);
    clickSound(330, .06);
    transition('想去看看外面？', () => {
      loadQuest();
      setupQuestChannel();
      questState.x = 9;
      questState.y = 82;
      renderQuest();
      showScreen('quest');
      setTimeout(() => $('#questStage')?.focus(), 80);
    });
    setTimeout(() => door?.classList.remove('opening'), 900);
  }

  function returnToRoom() {
    questBroadcast('quest-leave', { playerId: state.player.id });
    closeQuestEditor();
    stopRecording(true);
    transition('沿着灯光，回到小屋。', () => {
      showScreen('world');
      setTimeout(() => $('#worldStage')?.focus(), 80);
      updateNear();
    });
  }

  $('#returnRoomBtn')?.addEventListener('click', returnToRoom);
  $('#questReturnDoor')?.addEventListener('click', returnToRoom);

  // ---------- persistence + cross-tab sync ----------
  function saveQuest() {
    if (!state.roomCode) return;
    localStorage.setItem(questKey(), JSON.stringify({ items: questState.items }));
  }

  function applyQuestOp(op) {
    if (!op?.kind) return;
    if (op.kind === 'add' && op.item && !questState.items.some(x => x.id === op.item.id)) questState.items.push(op.item);
    if (op.kind === 'move') { const item = questState.items.find(x => x.id === op.id); if (item) { item.x = op.x; item.y = op.y; } }
    if (op.kind === 'clear') { questState.items = []; questState.found.clear(); }
    if (op.kind === 'set' && Array.isArray(op.items)) questState.items = op.items;
    saveQuest();
  }

  function questOp(op) {
    applyQuestOp(op);
    questBroadcast('quest-op', { op });
    PixelNet?.applyOp?.(state.roomCode,'quest',op).catch(()=>{});
  }

  function loadQuest() {
    questState.items = [];
    try {
      const data = JSON.parse(localStorage.getItem(questKey()));
      if (data?.items) questState.items = data.items;
    } catch (_) {}
    questState.found = new Set();
    questState.completedShown = false;
  }

  function setupQuestChannel() {
    if (questState.channel) questState.channel.close();
    if (!state.roomCode) return;
    questState.players.clear();
    questState.players.set(state.player.id, { ...state.player, qx: questState.x, qy: questState.y, lastSeen: Date.now() });
    questState.channel = window.PixelNet ? PixelNet.createChannel(questLiveKey(), state.roomCode, state.player.id) : (('BroadcastChannel' in window) ? new BroadcastChannel(questLiveKey()) : null);
    if (!questState.channel) return;
    questState.channel.onmessage = e => {
      const m = e.data;
      if (!m || m.sender === state.player.id) return;
      if (m.type === 'quest-update' && Array.isArray(m.items)) { questState.items = m.items; saveQuest(); renderQuestItems(); }
      if (m.type === 'quest-op' && m.op) { applyQuestOp(m.op); renderQuestItems(); }
      if (m.type === 'quest-hello') { questBroadcast('quest-player', { player: questPlayerSnapshot() }); }
      if (m.type === 'quest-player' && m.player) { questState.players.set(m.player.id, { ...m.player, lastSeen: Date.now() }); renderQuestPlayer(); }
      if (m.type === 'quest-leave' && m.playerId) { questState.players.delete(m.playerId); renderQuestPlayer(); }
      if (m.type === 'quest-discovered') {
        const item = questState.items.find(x => x.id === m.id);
        if (item && state.screen === 'quest') pulseDiscovery(item.x, item.y);
      }
    };
    questBroadcast('quest-hello');
    setTimeout(() => questBroadcast('quest-player', { player: questPlayerSnapshot() }), 180);
  }

  function questPlayerSnapshot() { return { id: state.player.id, name: state.player.name, hair: state.player.hair, outfit: state.player.outfit, item: state.player.item, qx: questState.x, qy: questState.y }; }

  function questBroadcast(type, extra = {}) {
    questState.channel?.postMessage({ type, sender: state.player.id, ...extra });
  }

  // ---------- map rendering ----------
  function renderQuest() {
    renderQuestPlayer();
    renderQuestItems();
    renderQuestProgress();
  }

  function renderQuestPlayer() {
    const layer = $('#questPlayerLayer');
    if (!layer) return;
    questState.players.set(state.player.id, { ...questPlayerSnapshot(), lastSeen: Date.now() });
    const now = Date.now();
    for (const [id,p] of questState.players) if (id !== state.player.id && now - (p.lastSeen || 0) > 16000) questState.players.delete(id);
    layer.innerHTML = '';
    $('#questOnlineCount') && ($('#questOnlineCount').textContent=questState.players.size);
    for (const [id,p] of questState.players) {
      const el = document.createElement('div');
      el.className = `quest-player hair-${p.hair}${id===state.player.id&&questState.walking ? ' walking' : ''}${id===state.player.id?' me':''}`;
      el.style.left = `${id===state.player.id?questState.x:p.qx}%`;
      el.style.top = `${id===state.player.id?questState.y:p.qy}%`;
      el.style.setProperty('--shirt', colors[p.outfit] || colors.coral);
      el.innerHTML = `<span class="quest-player-name">${escapeHTML(p.name)}</span><span class="player-item">${p.item||'✦'}</span>`;
      layer.appendChild(el);
    }
  }

  function renderQuestItems() {
    const layer = $('#questAssetLayer');
    if (!layer) return;
    layer.innerHTML = '';
    const ordered = questState.items.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const next = ordered.find(item => !questState.found.has(item.id));
    ordered.forEach((item, idx) => {
      const found = questState.found.has(item.id);
      const revealed = questState.editorOpen || found || item.id === next?.id;
      if (!revealed) return;
      const near = questState.nearby?.id === item.id;
      const el = document.createElement('div');
      el.className = `quest-memory${found ? ' found' : ' mystery'}${near ? ' near' : ''}`;
      el.dataset.id = item.id;
      el.style.left = `${item.x}%`;
      el.style.top = `${item.y}%`;
      const visual = found || questState.editorOpen ? (item.image ? `<img src="${item.image}" alt="">` : `<span>${item.icon || '✦'}</span>`) : '<span class="mystery-glint">✦</span>';
      const label = found || questState.editorOpen ? item.title : '前方有一点微光';
      el.innerHTML = `<div class="treasure-sprite">${visual}</div><i class="treasure-order">${idx + 1}</i><span class="treasure-tag">${escapeHTML(label)}</span>`;
      layer.appendChild(el);
    });
    renderQuestRoute(ordered, next);
    renderQuestProgress();
    updateQuestNear();
  }

  function renderQuestRoute(ordered = questState.items.slice().sort((a,b)=>(a.order||0)-(b.order||0)), next = ordered.find(item=>!questState.found.has(item.id))) {
    const path = $('#questRoutePath');
    if (!path) return;
    const revealed = questState.editorOpen ? ordered : ordered.filter(i => questState.found.has(i.id) || i.id === next?.id);
    const pts = [{ x: 9, y: 82 }, ...revealed.map(i => ({ x: i.x, y: i.y }))];
    if (pts.length < 2) { path.setAttribute('d', ''); path.classList.remove('route-alive'); return; }
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a.x + b.x) / 2; d += ` Q ${mx} ${a.y - 3 + (i % 2 ? -2 : 2)} ${b.x} ${b.y}`; }
    path.setAttribute('d', d);
    path.classList.toggle('route-alive', revealed.length > 0);
  }

  function renderQuestProgress() {
    $('#questFoundCount').textContent = questState.found.size;
    $('#questTotalCount').textContent = questState.items.length;
    if (questState.found.size < questState.items.length) questState.completedShown = false;
    if (questState.items.length && questState.found.size === questState.items.length && !questState.completedShown) {
      questState.completedShown = true;
      const st = $('#questStage');
      st.classList.remove('quest-complete');
      void st.offsetWidth;
      st.classList.add('quest-complete');
      setTimeout(() => st.classList.remove('quest-complete'), 2600);
      addActivity(`${state.player.name} 走完了一整条回忆路线`);
    }
  }

  // ---------- movement, bounce, collision ----------
  const questStage = $('#questStage');
  questStage?.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e'].includes(k)) e.preventDefault();
    if (k === 'e') return interactQuestNear();
    questState.keys.add(k);
  });
  questStage?.addEventListener('keyup', e => questState.keys.delete(e.key.toLowerCase()));
  questStage?.addEventListener('blur', () => questState.keys.clear());

  function questObstacle(nx, ny) {
    // pond + two hills; intentionally soft so the map feels playful, not punishing.
    const blocks = [
      {x:19,y:32,rx:12,ry:13},
      {x:41,y:29,rx:9,ry:9},
      {x:83,y:26,rx:10,ry:10}
    ];
    return blocks.some(o => (((nx-o.x)/o.rx)**2 + ((ny-o.y)/o.ry)**2) < 1);
  }

  function questLoop() {
    if (state.screen === 'quest' && !questState.editorOpen) {
      let dx = 0, dy = 0;
      const sp = .38;
      if (questState.keys.has('a') || questState.keys.has('arrowleft')) dx -= sp;
      if (questState.keys.has('d') || questState.keys.has('arrowright')) dx += sp;
      if (questState.keys.has('w') || questState.keys.has('arrowup')) dy -= sp;
      if (questState.keys.has('s') || questState.keys.has('arrowdown')) dy += sp;
      const moving = !!(dx || dy);
      if (moving) {
        let nx = Math.max(3.5, Math.min(96.5, questState.x + dx));
        let ny = Math.max(8, Math.min(93, questState.y + dy));
        if (!questObstacle(nx, ny)) {
          questState.x = nx;
          questState.y = ny;
        } else {
          bumpSound();
        }
        questState.stepTick++;
        if (questState.stepTick % 18 === 0) dropFootstep();
        questState.walking = true;
        renderQuestPlayer();
        const now=performance.now();if(now-questState.lastMoveSent>75){questState.lastMoveSent=now;questBroadcast('quest-player',{player:questPlayerSnapshot()})}
        updateQuestNear();
      } else if (questState.walking) {
        questState.walking = false;
        renderQuestPlayer();
      }
    }
    requestAnimationFrame(questLoop);
  }
  requestAnimationFrame(questLoop);

  function dropFootstep() {
    const f = document.createElement('i');
    f.className = 'quest-footstep';
    f.style.left = `${questState.x}%`;
    f.style.top = `${questState.y + 3}%`;
    $('#questStage')?.appendChild(f);
    setTimeout(() => f.remove(), 700);
  }

  const fishingSpot = { id:'fishing', type:'fishing', x:30, y:44, r:8, title:'湖边钓一会儿' };

  function updateQuestNear() {
    let best = null, dist = 999;
    const ordered = questState.items.slice().sort((a,b)=>(a.order||0)-(b.order||0));
    const next = ordered.find(item => !questState.found.has(item.id));
    for (const item of ordered) {
      if (!questState.editorOpen && !questState.found.has(item.id) && item.id !== next?.id) continue;
      const d = Math.hypot(questState.x - item.x, questState.y - item.y);
      if (d < 7.5 && d < dist) { best = item; dist = d; }
    }
    const fishDist = Math.hypot(questState.x - fishingSpot.x, questState.y - fishingSpot.y);
    if (!questState.editorOpen && fishDist < fishingSpot.r && fishDist < dist) {
      best = fishingSpot;
      dist = fishDist;
    }
    questState.nearby = best;
    const prompt = $('#questPrompt');
    if (best) {
      prompt.classList.remove('hidden');
      $('span', prompt).textContent = best.type === 'fishing'
        ? '坐在湖边钓一会儿'
        : (questState.found.has(best.id) ? `再看看「${best.title}」` : '这里好像藏着一段回忆');
    } else prompt.classList.add('hidden');
    $$('.quest-memory').forEach(el => el.classList.toggle('near', best?.type !== 'fishing' && el.dataset.id === best?.id));
    $('#questFishingSpot')?.classList.toggle('near', best?.type === 'fishing');
  }

  function interactQuestNear() {
    if (!questState.nearby) return toast('沿着小路再走走看。');
    if (questState.nearby.type === 'fishing') return openFishing();
    discoverQuestItem(questState.nearby);
  }

  function fishingSound(kind='cast') {
    if (kind === 'cast') { clickSound(330,.055); setTimeout(()=>clickSound(440,.045),65); }
    if (kind === 'bite') { clickSound(660,.05); setTimeout(()=>clickSound(880,.07),72); }
    if (kind === 'catch') { clickSound(523,.07); setTimeout(()=>clickSound(659,.07),70); setTimeout(()=>clickSound(784,.09),140); }
    if (kind === 'miss') { clickSound(260,.06); setTimeout(()=>clickSound(220,.08),75); }
  }

  function openFishing() {
    if (questState.editorOpen) return;
    const f = questState.fishing;
    openModal('LAKESIDE FISHING · 湖边', '要不要坐下来钓一会儿？', `
      <div class="fishing-game">
        <div class="fishing-scene-mini" aria-hidden="true">
          <span class="mini-water"><i></i><i></i><i></i></span>
          <span class="mini-rod"></span>
          <span class="mini-line"></span>
          <span class="mini-float"></span>
          <span class="mini-fish">><))°></span>
        </div>
        <div class="fishing-copy">
          <b id="fishingStatus">湖面很安静。先甩一杆，等浮漂动起来。</b>
          <small>不用赶进度，这里就是给人停一下的。</small>
        </div>
        <div class="fishing-stats"><span>甩杆 <b id="fishCasts">${f.casts}</b></span><i></i><span>钓到 <b id="fishCatches">${f.catches}</b></span></div>
        <button id="fishingAction" class="button primary full press">甩一杆 <span>↗</span></button>
        <button id="fishingLeave" class="button secondary full press">今天先坐到这里</button>
      </div>`);
    setTimeout(() => {
      const action = $('#fishingAction');
      const status = $('#fishingStatus');
      const scene = $('.fishing-scene-mini');
      if (!action || !status) return;
      let biteTimer = 0, missTimer = 0;
      const reset = (copy='湖面又安静下来了。还想再试一杆吗？') => {
        clearTimeout(biteTimer); clearTimeout(missTimer);
        f.waiting = false; f.biting = false;
        scene?.classList.remove('waiting','bite','caught');
        status.textContent = copy;
        action.disabled = false;
        action.innerHTML = '再甩一杆 <span>↗</span>';
      };
      action.onclick = () => {
        if (f.biting) {
          clearTimeout(missTimer);
          f.biting = false; f.waiting = false; f.catches++;
          const catches = ['一条小鲫鱼','一条亮闪闪的小鱼','一条很有精神的小白条','一条慢吞吞的小鱼'];
          const fish = catches[Math.floor(Math.random()*catches.length)];
          scene?.classList.remove('waiting','bite'); scene?.classList.add('caught');
          status.textContent = `钓到了${fish}。拍了张“精神小鱼照”，又把它放回湖里。`;
          $('#fishCatches').textContent = f.catches;
          action.disabled = true;
          fishingSound('catch');
          reaction(state.player.id,'🐟');
          addActivity(`${state.player.name} 在回忆路的湖边钓到了一条小鱼，又把它放回去了`);
          setTimeout(() => reset('水面晃了两下。还想再坐一会儿吗？'), 1500);
          return;
        }
        if (f.waiting) return;
        f.casts++;
        $('#fishCasts').textContent = f.casts;
        f.waiting = true;
        scene?.classList.remove('caught','bite'); scene?.classList.add('waiting');
        status.textContent = '浮漂轻轻晃着……先别急。';
        action.disabled = true;
        action.textContent = '等一等…';
        fishingSound('cast');
        biteTimer = setTimeout(() => {
          f.waiting = false; f.biting = true;
          scene?.classList.remove('waiting'); scene?.classList.add('bite');
          status.textContent = '咬钩了！现在收杆！';
          action.disabled = false;
          action.innerHTML = '收杆！ <span>!</span>';
          fishingSound('bite');
          missTimer = setTimeout(() => {
            if (!f.biting) return;
            f.biting = false;
            scene?.classList.remove('bite');
            status.textContent = '慢了一点，它把饵偷走了。';
            fishingSound('miss');
            setTimeout(() => reset('没关系，湖边不讲输赢。再试一杆？'), 850);
          }, 1450);
        }, 1200 + Math.random()*1500);
      };
      $('#fishingLeave').onclick = () => {
        clearTimeout(biteTimer); clearTimeout(missTimer);
        f.waiting = false; f.biting = false;
        closeModal();
        setTimeout(()=>$('#questStage')?.focus(),50);
      };
    },0);
  }

  $('#questFishingSpot')?.addEventListener('click', e => {
    e.preventDefault();
    const d = Math.hypot(questState.x - fishingSpot.x, questState.y - fishingSpot.y);
    if (d >= fishingSpot.r) return toast('先走到湖边，靠近浮漂一点。');
    openFishing();
  });

  async function discoverQuestItem(item) {
    const fresh = !questState.found.has(item.id);
    questState.found.add(item.id);
    renderQuestItems();
    if (fresh) {
      pulseDiscovery(item.x, item.y);
      questBroadcast('quest-discovered', { id: item.id });
      clickSound(470, .08);
      addActivity(`${state.player.name} 找到了「${item.title}」`);
    }
    const voiceHtml = (item.voiceKey||item.voiceUrl) ? `<div class="memory-voice"><button id="questPlayVoice" class="press">▶</button><div><b>有人把声音留在这里</b><small>点一下，听听当时想说的话</small></div></div>` : '';
    openModal('MEMORY FOUND', escapeHTML(item.title), `<div class="memory-found-card"><div class="memory-found-visual">${item.image ? `<img src="${item.image}" alt="">` : `<span>${item.icon || '✦'}</span>`}</div><div class="memory-found-copy">${escapeHTML(item.text || '有人觉得这一刻值得被留下。')}</div>${voiceHtml}<div class="memory-detail-meta">${escapeHTML(item.by || '朋友')} 把它藏在这条路上 · 第 ${item.order || 1} 站</div></div>`);
    if (item.voiceKey || item.voiceUrl) {
      setTimeout(() => {
        const btn = $('#questPlayVoice');
        if (!btn) return;
        let audio = null;
        btn.onclick = async () => {
          if (audio && !audio.paused) { audio.pause(); btn.textContent = '▶'; return; }
          if (item.voiceUrl) {
            audio = new Audio(item.voiceUrl);
            audio.onended = () => { btn.textContent = '▶'; };
            audio.play().then(() => btn.textContent = 'Ⅱ').catch(() => toast('浏览器暂时没有允许播放录音'));
            return;
          }
          const blob = await voiceDBGet(item.voiceKey);
          if (!blob) return toast('这段录音在当前浏览器里找不到了。');
          const url = URL.createObjectURL(blob);
          audio = new Audio(url);
          audio.onended = () => { btn.textContent = '▶'; URL.revokeObjectURL(url); };
          audio.play().then(() => btn.textContent = 'Ⅱ').catch(() => toast('浏览器暂时没有允许播放录音'));
        };
      }, 0);
    }
  }

  function pulseDiscovery(x, y) {
    const ring = document.createElement('i');
    ring.className = 'quest-discovery-ring';
    ring.style.left = `${x}%`;
    ring.style.top = `${y}%`;
    $('#questStage')?.appendChild(ring);
    setTimeout(() => ring.remove(), 760);
  }

  // ---------- editor ----------
  function openQuestEditor() {
    questState.editorOpen = true;
    questState.keys.clear();
    $('#questEditor').classList.remove('hidden');
    $('#questEditor').setAttribute('aria-hidden', 'false');
    $('#questStage').classList.add('edit-mode');
    $('#questModeBtn b').textContent = '继续探索';
    $('#questModeBtn span').textContent = '↗';
  }

  function closeQuestEditor() {
    questState.editorOpen = false;
    $('#questEditor')?.classList.add('hidden');
    $('#questEditor')?.setAttribute('aria-hidden', 'true');
    $('#questStage')?.classList.remove('edit-mode');
    $('#questModeBtn b').textContent = '布置地图';
    $('#questModeBtn span').textContent = '✎';
    if (state.screen === 'quest') setTimeout(() => $('#questStage')?.focus(), 50);
  }

  $('#questModeBtn')?.addEventListener('click', () => questState.editorOpen ? closeQuestEditor() : openQuestEditor());
  $('#closeQuestEditor')?.addEventListener('click', closeQuestEditor);
  $('#questUploadBtn')?.addEventListener('click', () => $('#questPhotoInput').click());

  $('#questPhotoInput')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) toast('演示版建议上传 5MB 以内的照片。');
    const url = await fileToDataURL(file);
    questState.sourcePhoto = url;
    $('#questSourcePreview').classList.remove('empty');
    $('#questSourcePreview').innerHTML = `<img src="${url}" alt="source">`;
    const img = await loadImage(url);
    questState.generated = generatePixelClues(img);
    renderGeneratedAssets();
    toast('照片被拆成了 3 个像素线索。');
  });

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function generatePixelClues(img) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const square = Math.min(w, h);
    const center = { sx:(w-square)/2, sy:(h-square)/2, sw:square, sh:square, label:'人物 / 主体' };
    const sceneH = Math.min(h, w * .72);
    const scene = { sx:0, sy:Math.max(0,(h-sceneH)*.32), sw:w, sh:sceneH, label:'建筑 / 场景' };
    const detail = findDetailCrop(img);
    return [center, scene, {...detail,label:'标志性细节'}].map((crop, i) => ({ id:uid(), label:crop.label, image:pixelCrop(img,crop, i) }));
  }

  function findDetailCrop(img) {
    const sample = document.createElement('canvas');
    sample.width = 48; sample.height = 48;
    const c = sample.getContext('2d', { willReadFrequently:true });
    c.drawImage(img,0,0,48,48);
    const data = c.getImageData(0,0,48,48).data;
    let best = {score:-1,gx:1,gy:1};
    for (let gy=0;gy<3;gy++) for (let gx=0;gx<3;gx++) {
      let vals=[];
      for (let y=gy*16;y<(gy+1)*16;y+=2) for (let x=gx*16;x<(gx+1)*16;x+=2) {
        const k=(y*48+x)*4; vals.push(.2126*data[k]+.7152*data[k+1]+.0722*data[k+2]);
      }
      const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
      const variance=vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length;
      if (variance>best.score) best={score:variance,gx,gy};
    }
    const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
    const size=Math.min(w,h)*.58;
    const cx=(best.gx+.5)/3*w, cy=(best.gy+.5)/3*h;
    return {sx:Math.max(0,Math.min(w-size,cx-size/2)),sy:Math.max(0,Math.min(h-size,cy-size/2)),sw:size,sh:size};
  }

  function pixelCrop(img, crop, variant=0) {
    const tiny = document.createElement('canvas');
    const px = variant===1 ? 18 : 16;
    tiny.width=px;tiny.height=px;
    const t=tiny.getContext('2d',{willReadFrequently:true});
    t.imageSmoothingEnabled=true;
    t.drawImage(img,crop.sx,crop.sy,crop.sw,crop.sh,0,0,px,px);
    const id=t.getImageData(0,0,px,px);
    for(let i=0;i<id.data.length;i+=4){
      id.data[i]=Math.round(id.data[i]/42.5)*42.5;
      id.data[i+1]=Math.round(id.data[i+1]/42.5)*42.5;
      id.data[i+2]=Math.round(id.data[i+2]/42.5)*42.5;
    }
    t.putImageData(id,0,0);
    const out=document.createElement('canvas');out.width=72;out.height=72;
    const o=out.getContext('2d');o.imageSmoothingEnabled=false;o.drawImage(tiny,0,0,72,72);
    return out.toDataURL('image/png');
  }

  function renderGeneratedAssets() {
    const host = $('#questGeneratedAssets');
    if (!questState.generated.length) {
      host.innerHTML='<div class="quest-empty-copy">上传照片后，这里会出现 3 个可以放进地图的像素线索。</div>';
      return;
    }
    host.innerHTML='';
    questState.generated.forEach(a => {
      const b=document.createElement('button');
      b.className=`generated-asset press${questState.selectedAsset?.id===a.id?' selected':''}`;
      b.innerHTML=`<img src="${a.image}" alt="" style="width:100%;aspect-ratio:1;display:block;image-rendering:pixelated;border:1px solid #b8a58c;background:#eadfc9"><small>${escapeHTML(a.label)}</small>`;
      b.onclick=()=>{
        questState.selectedAsset=a;
        $('#questSelectedAsset').innerHTML=`已选：<b>${escapeHTML(a.label)}</b> · 再给它一句话或一段声音。`;
        renderGeneratedAssets();
        clickSound(300,.035);
      };
      host.appendChild(b);
    });
  }

  // Existing memories stay editable: in edit mode, drag a treasure and the route redraws live.
  let dragItem=null;
  questStage?.addEventListener('pointerdown', e => {
    if (!questState.editorOpen || questState.placing) return;
    const node=e.target.closest('.quest-memory');
    if(!node)return;
    dragItem=questState.items.find(x=>x.id===node.dataset.id)||null;
    if(!dragItem)return;
    e.preventDefault();
    questStage.setPointerCapture?.(e.pointerId);
    node.style.cursor='grabbing';
  });
  questStage?.addEventListener('pointermove', e => {
    if(!dragItem)return;
    const r=questStage.getBoundingClientRect();
    const x=Math.max(7,Math.min(95,(e.clientX-r.left)/r.width*100));
    const y=Math.max(11,Math.min(91,(e.clientY-r.top)/r.height*100));
    if(questObstacle(x,y))return;
    dragItem.x=x;dragItem.y=y;
    renderQuestItems();
  });
  const endDrag=()=>{if(!dragItem)return;saveQuest();questBroadcast('quest-op',{op:{kind:'move',id:dragItem.id,x:dragItem.x,y:dragItem.y}});toast(`「${dragItem.title}」换了一个藏宝位置。`);dragItem=null};
  questStage?.addEventListener('pointerup',endDrag);
  questStage?.addEventListener('pointercancel',endDrag);

  // ---------- voice recording ----------
  // Keep the historical IndexedDB name so existing local recordings remain readable.
  const DB_NAME='pixel-memory-v8-voices', STORE='voices';
  function openVoiceDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  async function voiceDBPut(key,blob){const db=await openVoiceDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(blob,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
  async function voiceDBGet(key){const db=await openVoiceDB();return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  function voiceExt(type=''){if(type.includes('mp4'))return 'm4a';if(type.includes('ogg'))return 'ogg';if(type.includes('mpeg'))return 'mp3';if(type.includes('wav'))return 'wav';return 'webm'}
  async function uploadPendingVoice(){if(!questState.pendingVoiceBlob||!window.PixelNet?.enabled)return !!questState.pendingVoiceUrl;try{$('#questRecordState').textContent='正在把录音上传到房间…';const ext=voiceExt(questState.pendingVoiceBlob.type);const up=await PixelNet.uploadBlob(questState.pendingVoiceBlob,`memory-${Date.now()}.${ext}`);questState.pendingVoiceUrl=up.url;$('#questRecordState').textContent='云端已保存 · 其他人也可以听到';return true}catch(_){$('#questRecordState').textContent='云端上传失败 · 再点“放进地图”会重试';toast('录音已保存在本机，但还没传到房间');return false}}

  $('#questRecordBtn')?.addEventListener('click', () => {
    if (questState.recorder?.state === 'recording') stopRecording(false); else startRecording();
  });

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('当前浏览器不支持网页录音。');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      questState.recordStream=stream;questState.recordChunks=[];
      const rec=new MediaRecorder(stream);questState.recorder=rec;questState.recordStartedAt=Date.now();
      rec.ondataavailable=e=>{if(e.data.size)questState.recordChunks.push(e.data)};
      rec.onstop=async()=>{
        clearInterval(questState.recordTimer);
        questState.recordTimer=null;
        questState.recordStream?.getTracks().forEach(t=>t.stop());
        const blob=new Blob(questState.recordChunks,{type:rec.mimeType||'audio/webm'});
        const key=`voice-${uid()}`;
        if(!blob.size)return toast('没有录到声音，请重新试一次。');
        try{await voiceDBPut(key,blob);questState.pendingVoiceKey=key;questState.pendingVoiceBlob=blob;questState.pendingVoiceUrl='';if(window.PixelNet?.enabled)await uploadPendingVoice()}catch(_){return toast('录音保存失败，请再试一次。')}
        if(questState.recordObjectUrl)URL.revokeObjectURL(questState.recordObjectUrl);
        questState.recordObjectUrl=URL.createObjectURL(blob);
        const prev=$('#questRecordPreview');prev.src=questState.recordObjectUrl;prev.classList.remove('hidden');
        $('#questRecordBtn').classList.remove('recording');$('#questRecordBtn span').textContent='重新录一段';
        if(!questState.pendingVoiceUrl)$('#questRecordState').textContent=window.PixelNet?.enabled?'录好了 · 云端上传待重试':'录好了 · 当前仅保存在本机';
        clickSound(520,.055);
      };
      rec.start();
      $('#questRecordBtn').classList.add('recording');$('#questRecordBtn span').textContent='正在录音 · 点一下停止';
      $('#questRecordState').textContent='说一句只属于这个地方的话。';
      updateRecordClock();questState.recordTimer=setInterval(updateRecordClock,250);
      setTimeout(()=>{if(questState.recorder?.state==='recording')stopRecording(false)},15000);
    }catch(e){toast('没有获得麦克风权限，录音没有开始。')}
  }

  function updateRecordClock(){const s=Math.min(15,Math.floor((Date.now()-questState.recordStartedAt)/1000));$('#questRecordTime').textContent=`00:${String(s).padStart(2,'0')}`}
  function stopRecording(silent=false){if(questState.recorder?.state==='recording')questState.recorder.stop();else if(!silent)toast('还没有开始录音。')}

  // ---------- placement ----------
  $('#questPlaceHintBtn')?.addEventListener('click', async () => {
    if (!questState.selectedAsset) return toast('先从照片里选一个像素线索。');
    if (questState.recorder?.state === 'recording') return toast('先点一下停止录音，再把它放进地图。');
    if (questState.pendingVoiceBlob && window.PixelNet?.enabled && !questState.pendingVoiceUrl) {
      const ok = await uploadPendingVoice();
      if (!ok) return toast('这段录音还没有上传成功，先别把回忆放下。');
    }
    questState.placing=true;
    $('#questStage').classList.add('placing');
    closeQuestEditor();
    toast('现在点一下地图空地，把这段回忆藏在那里。');
  });

  questStage?.addEventListener('click', e => {
    if (!questState.placing) return;
    if (e.target.closest('#questReturnDoor')) return;
    const r=questStage.getBoundingClientRect();
    const x=Math.max(7,Math.min(95,(e.clientX-r.left)/r.width*100));
    const y=Math.max(11,Math.min(91,(e.clientY-r.top)/r.height*100));
    if (questObstacle(x,y)) return toast('那里被水塘或小山挡住了，换个位置藏。');
    const title=$('#questMemoryTitle').value.trim()||questState.selectedAsset.label;
    const text=$('#questMemoryText').value.trim()||'看到它的时候，希望你会想起那一天。';
    const item={id:uid(),order:questState.items.length+1,title,text,by:state.player.name,image:questState.selectedAsset.image,voiceKey:questState.pendingVoiceKey||'',voiceUrl:questState.pendingVoiceUrl||'',x,y,time:Date.now()};
    questState.placing=false;$('#questStage').classList.remove('placing');
    questOp({kind:'add',item});renderQuestItems();pulseDiscovery(x,y);addActivity(`${state.player.name} 在门外藏下了「${title}」`);toast('藏好了。其他人现在也能在这条路上找到它。');
    resetEditorDraft();
  });

  function resetEditorDraft(){questState.selectedAsset=null;questState.pendingVoiceKey='';questState.pendingVoiceBlob=null;questState.pendingVoiceUrl='';$('#questMemoryTitle').value='';$('#questMemoryText').value='';$('#questSelectedAsset').textContent=questState.generated.length?'还可以继续从这张照片里选另一个线索':'还没有选中素材';if(questState.generated.length)renderGeneratedAssets();const p=$('#questRecordPreview');p.pause();p.removeAttribute('src');p.classList.add('hidden');$('#questRecordBtn span').textContent='按一下开始录音';$('#questRecordBtn').classList.remove('recording');$('#questRecordTime').textContent='00:00';$('#questRecordState').textContent='可以录一段 15 秒以内的话'}

  $('#questAddDemoBtn')?.addEventListener('click', () => {
    if (questState.items.length && !confirm('地图里已经有回忆了，还要再加入示例吗？')) return;
    const demo=[
      {x:31,y:72,title:'第一次并肩走的路',text:'其实那天没有发生什么大事，只是后来想起时，总觉得那段路很亮。',icon:'🌿'},
      {x:55,y:56,title:'一张没有拍好的照片',text:'有人闭眼，有人笑场，但后来它反而成了最舍不得删的一张。',icon:'📷'},
      {x:77,y:38,title:'最后一个小秘密',text:'如果你真的走到了这里——谢谢你出现在这段故事里。',icon:'✦'}
    ];
    const items=questState.items.slice();demo.forEach((d,i)=>items.push({id:uid(),order:items.length+1,by:state.player.name,time:Date.now(),voiceKey:'',image:'',...d}));
    questOp({kind:'set',items});renderQuestItems();toast('三段示例回忆已经散落在路上。');
  });

  $('#questClearBtn')?.addEventListener('click',()=>{
    if(!questState.items.length)return toast('地图现在就是空的。');
    if(!confirm('确定清空这张回忆地图吗？'))return;
    questOp({kind:'clear'});renderQuestItems();toast('回忆地图已经清空。');
  });

  // Friendly default: if the map is empty, editor opens only when asked. The empty road remains explorable.
  window.addEventListener('beforeunload',()=>{try{questBroadcast('quest-leave',{playerId:state.player.id});questState.channel?.close()}catch(_){}});
})();
