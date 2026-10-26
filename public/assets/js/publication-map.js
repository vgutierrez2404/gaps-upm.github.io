// Topic membership map. No citation counts or citation relationships are inferred.
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('publication-map-view');
  const source = document.getElementById('research-map-data');
  if (!root || !source) return;
  const {papers, topics} = JSON.parse(source.textContent);
  const svg = document.getElementById('research-map-svg');
  const list = document.getElementById('publication-list-view');
  const switches = [...document.querySelectorAll('[data-publication-view]')];
  const topicInput = document.getElementById('publication-topic');
  const sidebar = document.getElementById('research-map-detail-content');
  const initialSidebar = sidebar.cloneNode(true);
  const tooltip = document.getElementById('research-map-tooltip');
  const stage = root.querySelector('.research-map-stage');
  const items = new Map(papers.map(p => [p.id, document.getElementById(p.id)]));
  const colors = new Map(topics.map(t => [t.id, t.color]));
  const positions = [[245,190],[720,190],[1195,190],[245,550],[720,550],[1195,550],[245,910],[720,910],[1195,910]];
  const centers = new Map(topics.map((t, i) => [t.id, positions[i] || [720,540]]));
  const ns = 'http://www.w3.org/2000/svg';
  const make = (name, attrs = {}, text) => {
    const el = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, String(v)));
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const linksLayer = make('g', {class: 'map-edges', 'aria-hidden': true});
  const nodesLayer = make('g');
  const topicsLayer = make('g');
  svg.append(linksLayer, nodesLayer, topicsLayer);
  const nodes = new Map();
  const edges = [];
  const hubs = new Map();
  const groups = new Map(topics.map(t => [t.id, papers.filter(p => p.topics[0] === t.id)]));
  const totalTopicCounts = new Map(topics.map(topic => [topic.id, papers.filter(p => p.topics.includes(topic.id)).length]));
  // Fixed scale across filters: areas grow with count; a small base keeps labels readable.
  const largestTopic = Math.max(1, ...totalTopicCounts.values());
  function topicSize(count) {
    const share = count / largestTopic;
    return { core: Math.sqrt(14 ** 2 + share * (60 ** 2 - 14 ** 2)), halo: Math.sqrt(60 ** 2 + share * (150 ** 2 - 60 ** 2)) };
  }
  let selected = null;
  let box = {x: 0, y: 0, w: 1440, h: 1080};
  let gesture = null;
  let dragged = false;
  let pinch = null;
  const pointers = new Map();

  function setView(view) {
    const isMap = view === 'map';
    root.hidden = !isMap;
    list.hidden = isMap;
    switches.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.publicationView === view)));
  }
  switches.forEach(button => button.addEventListener('click', () => setView(button.dataset.publicationView)));
  function resetSidebar() { sidebar.replaceChildren(...[...initialSidebar.childNodes].map(node => node.cloneNode(true))); }
  function selectPaper(paper) {
    selected = paper.id;
    nodes.forEach((node, id) => node.classList.toggle('is-selected', id === selected));
    edges.forEach(edge => edge.element.classList.toggle('is-selected', edge.paper.id === selected));
    const eyebrow = document.createElement('p'); eyebrow.className = 'research-map-eyebrow'; eyebrow.textContent = `${paper.year} · Publication`;
    const heading = document.createElement('h2'); heading.textContent = paper.title;
    const tags = document.createElement('p'); tags.className = 'research-map-paper-topics'; tags.textContent = paper.topics.map(id => topics.find(t => t.id === id).label).join(' · ');
    const citation = items.get(paper.id).querySelector('.publication-citation').cloneNode(true);
    const resources = items.get(paper.id).querySelector('.publication-links')?.cloneNode(true);
    const button = document.createElement('a'); button.href = `#${encodeURIComponent(paper.id)}`; button.className = 'research-map-list-link'; button.textContent = 'View in publication list →';
    button.addEventListener('click', () => setView('list'));
    sidebar.replaceChildren(eyebrow, heading, tags, citation);
    if (paper.research) {
      const facets = document.createElement('dl'); facets.className = 'research-map-facets';
      const area = topics.find(topic => topic.id === paper.research.area)?.label;
      for (const [label, values] of [['Area', area ? [area] : []], ['Tasks', paper.research.tasks], ['Methods', paper.research.methods]]) {
        if (!values.length) continue;
        const term = document.createElement('dt'); term.textContent = label;
        const description = document.createElement('dd'); description.textContent = values.join(' · ');
        facets.append(term, description);
      }
      sidebar.insertBefore(facets, citation);
    }
    if (resources) sidebar.append(resources);
    sidebar.append(button);
  }
  function filterTopic(id) {
    topicInput.value = topicInput.value === id ? '' : id;
    topicInput.dispatchEvent(new Event('change', {bubbles:true}));
  }
  const keyboardActivate = (el, action) => el.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); action(); }
  });
  topics.forEach(topic => {
    const [cx,cy] = centers.get(topic.id);
    const hub = make('g', {class: 'map-topic', role:'button', tabindex:0, 'aria-label': `Explore ${topic.label}`});
    const size = topicSize(totalTopicCounts.get(topic.id));
    const halo = make('circle', {cx,cy,r:size.halo,fill:topic.color,opacity:.045, 'pointer-events':'none'});
    hub.append(halo);
    const core = make('circle', {cx,cy,r:size.core,fill:topic.color});
    hub.append(core);
    const count = make('text',{x:cx,y:cy+6,'text-anchor':'middle',class:'map-topic-count'});
    hub.append(count);
    const label = make('text',{x:cx,y:cy-163,'text-anchor':'middle',class:'map-topic-label',fill:topic.color},topic.label);
    hub.append(label);
    hub.append(make('title',{},topic.label));
    hub.addEventListener('click', () => filterTopic(topic.id));
    keyboardActivate(hub, () => filterTopic(topic.id));
    topicsLayer.append(hub);
    hubs.set(topic.id,{el:hub,count,core,halo});
    groups.get(topic.id).forEach((paper,i) => {
      const angle = i * Math.PI * (3-Math.sqrt(5));
      const inner = size.core + 20;
      const outer = Math.max(inner, size.halo - 14);
      const radius = Math.sqrt(inner ** 2 + (outer ** 2 - inner ** 2) * ((i + .5) / groups.get(topic.id).length));
      const x = cx + Math.cos(angle)*radius;
      const y = cy + Math.sin(angle)*radius;
      paper.topics.forEach((id,j) => {
        const [tx,ty] = centers.get(id);
        const edge = make('line',{x1:x,y1:y,x2:tx,y2:ty,stroke:colors.get(id),class:j?'map-edge map-edge-secondary':'map-edge'});
        linksLayer.append(edge); edges.push({element:edge,paper,topic:id});
      });
      const node = make('g',{class:'map-paper',tabindex:0,role:'button','aria-label':`${paper.title}, ${paper.year}`, 'data-paper-id':paper.id});
      // Generous hit target, with a smaller visible dot. Node size is not a citation metric.
      node.append(make('circle',{cx:x,cy:y,r:14,fill:'transparent'}));
      node.append(make('circle',{cx:x,cy:y,r:7,fill:topic.color,class:'map-paper-dot'}));
      node.append(make('title',{},`${paper.title} (${paper.year})`));
      node.addEventListener('click', () => selectPaper(paper));
      keyboardActivate(node, () => selectPaper(paper));
      const showTooltip = () => { tooltip.textContent = `${paper.year} · ${paper.title}`; tooltip.hidden = false; };
      node.addEventListener('pointerenter', showTooltip);
      node.addEventListener('focus',showTooltip);
      node.addEventListener('pointerleave',() => {tooltip.hidden = true;});
      node.addEventListener('blur',() => {tooltip.hidden = true;});
      nodesLayer.append(node); nodes.set(paper.id,node);
    });
  });
  function update() {
    const visible = papers.filter(paper => !items.get(paper.id).classList.contains('hidden'));
    const ids = new Set(visible.map(p => p.id));
    nodes.forEach((node,id) => {node.style.display = ids.has(id)?'':'none';});
    edges.forEach(edge => {edge.element.style.display = ids.has(edge.paper.id)?'':'none';});
    topics.forEach(topic => {
      const count = visible.filter(p => p.topics.includes(topic.id)).length;
      const hub = hubs.get(topic.id);hub.el.style.display = count?'':'none';hub.count.textContent = count;
      const size = topicSize(count);
      hub.core.setAttribute('r', size.core);
      hub.halo.setAttribute('r', size.halo);
      hub.el.setAttribute('aria-label', `Explore ${topic.label}: ${count} matching papers`);
      hub.el.querySelector('title').textContent = `${topic.label}: ${count} matching papers`;
    });
    document.getElementById('research-map-count').textContent = `${visible.length} papers · ${topics.filter(topic=>visible.some(p=>p.topics.includes(topic.id))).length} topics`;
    root.querySelector('.research-map-empty').hidden = visible.length > 0;
    if (selected && !ids.has(selected)) { selected=null;resetSidebar(); }
    nodes.forEach((node,id)=>node.classList.toggle('is-selected',id===selected));
    edges.forEach(edge=>edge.element.classList.toggle('is-selected',edge.paper.id===selected));
    tooltip.hidden = true;
  }
  document.addEventListener('publications:filtered',update);
  document.addEventListener('publications:reveal',()=>setView('list'));
  function renderBox() {svg.setAttribute('viewBox',`${box.x} ${box.y} ${box.w} ${box.h}`); tooltip.hidden=true;}
  function zoom(factor, x=.5, y=.5) {
    const w = Math.max(240,Math.min(2200,box.w*factor));
    const h = w*.75;
    box = {x:box.x+(box.w-w)*x,y:box.y+(box.h-h)*y,w,h};renderBox();
  }
  root.querySelectorAll('[data-map-action]').forEach(button=>button.addEventListener('click',async()=>{
    const action=button.dataset.mapAction;
    if(action==='in')zoom(.75);
    if(action==='out')zoom(1/.75);
    if(action==='reset'){box={x:0,y:0,w:1440,h:1080};renderBox();}
    if(action==='fullscreen') {
      try {if(document.fullscreenElement) await document.exitFullscreen();else await root.requestFullscreen();}
      catch {button.textContent='Full screen unavailable';}
    }
  }));
  svg.addEventListener('wheel',event=>{
    if(!event.ctrlKey && !event.metaKey)return;
    event.preventDefault();
    const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const local=point.matrixTransform(matrix.inverse());
    zoom(Math.exp(event.deltaY*.003),(local.x-box.x)/box.w,(local.y-box.y)/box.h);
  },{passive:false});
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    dragged=false;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),box:{...box}};gesture=null;}
    else gesture={id:event.pointerId,x:event.clientX,y:event.clientY,box:{...box}};
  });
  svg.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch && pointers.size===2){
      const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);
      if(d>0){box={...pinch.box};zoom(pinch.distance/d);dragged=true;}return;
    }
    if(!gesture)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(Math.hypot(dx,dy)>5 || dragged){
      dragged=true;svg.setPointerCapture(event.pointerId);const r=svg.getBoundingClientRect();
      const scale=Math.min(r.width/gesture.box.w,r.height/gesture.box.h);
      box={...gesture.box,x:gesture.box.x-dx/scale,y:gesture.box.y-dy/scale};renderBox();
    }
  });
  const release=event=>{pointers.delete(event.pointerId);gesture=null;pinch=null;};
  svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);svg.addEventListener('lostpointercapture',release);
  svg.addEventListener('click',event=>{if(dragged){event.preventDefault();event.stopImmediatePropagation();dragged=false;}},true);
  svg.addEventListener('keydown',event=>{
    if(event.key==='+' || event.key==='='){event.preventDefault();zoom(.75);}
    if(event.key==='-'){event.preventDefault();zoom(1/.75);}
    if(event.key==='0'){event.preventDefault();box={x:0,y:0,w:1440,h:1080};renderBox();}
  });
  function showLinkedPaper() {
    try {if(items.has(decodeURIComponent(location.hash.slice(1))))setView('list');}catch{}
  }
  document.querySelector('.publication-view-switch').hidden=false;
  setView('map');showLinkedPaper();
  window.addEventListener('hashchange',showLinkedPaper);
  update();
});
