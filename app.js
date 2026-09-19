'use strict';
  const POSITION_DEFS = [
    ["diretoria-executiva","Diretoria Executiva","Conduz a estratégia e representa a organização.",0],
    ["diretoria-area","Diretor(a) de Área","Lidera uma área e desdobra a estratégia.",1],
    ["gerencia","Gerente","Coordena uma frente, metas e entregas.",2],
    ["analista","Analista","Executa e melhora processos da área.",3],
    ["assistente","Assistente","Apoia rotinas e controles operacionais.",4],
    ["estagiario","Estagiário(a)","Atua em desenvolvimento com acompanhamento.",5]
  ];
  const EXAMPLE_PEOPLE = [
    {"id":"example-marina","name":"Marina Costa","email":"marina.costa@example.com","birthday":"10/01","departmentId":"diretoria","positionId":"diretoria-executiva","level":0,"managerId":"","orgGroup":"","layoutOrder":0},
    {"id":"example-rafael","name":"Rafael Lima","email":"rafael.lima@example.com","birthday":"18/03","departmentId":"produto","positionId":"diretoria-area","level":1,"managerId":"example-marina","orgGroup":"","layoutOrder":1},
    {"id":"example-camila","name":"Camila Rocha","email":"camila.rocha@example.com","birthday":"22/05","departmentId":"operacoes","positionId":"diretoria-area","level":1,"managerId":"example-marina","orgGroup":"","layoutOrder":2},
    {"id":"example-bruno","name":"Bruno Alves","email":"bruno.alves@example.com","birthday":"07/08","departmentId":"comercial","positionId":"gerencia","level":2,"managerId":"example-marina","orgGroup":"","layoutOrder":3},
    {"id":"example-luiza","name":"Luiza Martins","email":"luiza.martins@example.com","birthday":"14/09","departmentId":"produto","positionId":"analista","level":3,"managerId":"example-rafael","orgGroup":"","layoutOrder":4},
    {"id":"example-diego","name":"Diego Souza","email":"diego.souza@example.com","birthday":"03/11","departmentId":"operacoes","positionId":"analista","level":3,"managerId":"example-camila","orgGroup":"","layoutOrder":5},
    {"id":"example-helena","name":"Helena Duarte","email":"helena.duarte@example.com","birthday":"29/06","departmentId":"comercial","positionId":"assistente","level":4,"managerId":"example-bruno","orgGroup":"","layoutOrder":6},
    {"id":"example-pedro","name":"Pedro Nunes","email":"pedro.nunes@example.com","birthday":"12/12","departmentId":"produto","positionId":"estagiario","level":5,"managerId":"example-luiza","orgGroup":"","layoutOrder":7}
  ];
  const EXAMPLE_PORTRAITS = {
    'example-marina':'top-left',
    'example-rafael':'top-right',
    'example-camila':'bottom-right',
    'example-bruno':'bottom-left'
  };

  const STORAGE_KEY = 'organograma-editor-v1';
  const LEGACY_STORAGE_KEYS = ['ag-organograma-v13'];
  const THEME_KEY = 'organograma-editor-theme';
  const COLLAPSE_KEY = 'organograma-editor-collapsed-v1';
  const ORIENT_KEY = 'organograma-editor-orientation';
  const LEVELS = [
    {name:'Direção executiva', color:'var(--brand)'},
    {name:'Direção', color:'var(--gold-700)'},
    {name:'Gestão', color:'var(--cat-1)'},
    {name:'Especialistas', color:'var(--cat-3)'},
    {name:'Apoio', color:'var(--cat-4)'},
    {name:'Desenvolvimento', color:'var(--muted)'}
  ];
  const MAX_LEVEL = LEVELS.length - 1;
  const TREE_LEVEL = 2;
  const DEPARTMENT_DEFS = [
    ['diretoria','Diretoria','Estratégia, governança e decisões da organização.','#C9A06A'],
    ['produto','Produto e Tecnologia','Descoberta, desenvolvimento e evolução de produtos.','#4A3AA7'],
    ['operacoes','Operações','Execução, qualidade e melhoria dos processos.','#0E6E78'],
    ['comercial','Comercial','Relacionamento, vendas e desenvolvimento de negócios.','#9A6A3D']
  ];
  const SMALL_WORDS = new Set(['da','das','de','do','dos','e']);
  const ACRONYMS = new Set(['BPO','CS','DP','I','II','III','JR','RH','SC','TI']);
  const $ = (selector, root=document) => root.querySelector(selector);
  const clone = value => JSON.parse(JSON.stringify(value));
  const strip = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const cleanText = (value, max=160) => String(value ?? '').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
  const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
  const cleanEmail = value => cleanText(value,254).toLowerCase();
  const cleanPhoto = value => {
    const photo=String(value??'');
    return photo.length<=700_000&&/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(photo)?photo:'';
  };

  function hydratePersonContact(person){
    const email=cleanEmail(person?.email||'');
    person.email=EMAIL_PATTERN.test(email)?email:'';
    return person;
  }

  function smartCase(value, person=false){
    return cleanText(value, 220).toLocaleLowerCase('pt-BR').split(' ').map((word,index) => {
      const bare = word.replace(/[^a-zà-ÿ0-9]/gi,'');
      if (ACRONYMS.has(bare.toUpperCase())) return word.replace(bare,bare.toUpperCase());
      if (person && index>0 && SMALL_WORDS.has(bare)) return word;
      return word ? word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1) : word;
    }).join(' ');
  }
  function sectorId(value){ return strip(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'sem-area'; }
  function levelOf(person){
    const raw = Number.parseInt(person?.level, 10);
    return Number.isInteger(raw) ? Math.max(0, Math.min(MAX_LEVEL, raw)) : TREE_LEVEL + 1;
  }
  function treeColumn(person){ return Math.max(0, levelOf(person) - TREE_LEVEL); }
  function initials(name){
    const parts = cleanText(name).split(' ').filter(part => !SMALL_WORDS.has(strip(part)));
    return ((parts[0]?.[0] || '') + (parts.at(-1)?.[0] || '')).toLocaleUpperCase('pt-BR');
  }
  function icon(name){
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','icon'); svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href',`#i-${name}`); svg.append(use); return svg;
  }
  function makeButton(label, iconName, className='btn', action=null){
    const button = document.createElement('button'); button.type='button'; button.className=className;
    if (iconName) button.append(icon(iconName)); button.append(document.createTextNode(label));
    if (action) button.addEventListener('click',action); return button;
  }

  function positionById(id){ return state?.positions?.find(item=>item.id===id); }
  function positionFor(person){ return positionById(person?.positionId); }
  function positionNameOf(person){ return positionFor(person)?.name || 'Cargo não informado'; }

  /* Primeiro acesso: organograma em branco, sem nenhum dado fictício. */
  function buildInitialState(){
    return {version:16,departments:[],positions:[],people:[],updatedAt:new Date().toISOString()};
  }
  /* Usado só pela ação opcional "Restaurar exemplos", nunca como estado padrão. */
  function buildExampleState(){
    const departments = DEPARTMENT_DEFS.map(([id,name,description,color],order) => ({id,name,description,color,parentId:'',order,collapsed:false}));
    const positions = POSITION_DEFS.map(([id,name,description,level],order) => ({id,name,description,level,order}));
    const people = EXAMPLE_PEOPLE.map(person => hydratePersonContact({...person,photo:''}));
    return {version:16,departments,positions,people,updatedAt:new Date().toISOString()};
  }

  function normalizeState(candidate){
    if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.departments) || !Array.isArray(candidate.people)) throw new Error('Estrutura de dados inválida.');
    const seenDepartments = new Set();
    const departments = candidate.departments.slice(0,100).map((item,index) => {
      const id = cleanText(item?.id,100); if (!id || seenDepartments.has(id)) throw new Error('Há setores com identificadores inválidos ou repetidos.'); seenDepartments.add(id);
      return {id,name:cleanText(item.name,100)||'Setor sem nome',description:cleanText(item.description,280),color:/^#[0-9a-f]{6}$/i.test(item.color)?item.color:'#6B6863',parentId:cleanText(item.parentId,100),order:Number.isFinite(Number(item.order))?Number(item.order):index,collapsed:Boolean(item.collapsed)};
    });
    const sourcePositions=Array.isArray(candidate.positions)&&candidate.positions.length
      ? candidate.positions
      : POSITION_DEFS.map(([id,name,description,level],order)=>({id,name,description,level,order}));
    const seenPositions=new Set();
    const positions=sourcePositions.slice(0,300).map((item,index)=>{
      const id=cleanText(item?.id,100);if(!id||seenPositions.has(id))throw new Error('Há cargos com identificadores inválidos ou repetidos.');seenPositions.add(id);
      const rawLevel=Number.parseInt(item.level,10);
      return {id,name:cleanText(item.name,120)||'Cargo sem nome',description:cleanText(item.description,280),level:Number.isInteger(rawLevel)?Math.max(0,Math.min(MAX_LEVEL,rawLevel)):TREE_LEVEL+1,order:Number.isFinite(Number(item.order))?Number(item.order):index};
    });
    const seenPeople = new Set();
    const people = candidate.people.slice(0,5000).map((item,index) => {
      const id=cleanText(item?.id,100); if(!id || seenPeople.has(id)) throw new Error('Há pessoas com identificadores inválidos ou repetidos.'); seenPeople.add(id);
      const departmentId=cleanText(item.departmentId,100);
      const rawLevel=Number.parseInt(item.level,10);
      const level=Number.isInteger(rawLevel)?Math.max(0,Math.min(MAX_LEVEL,rawLevel)):TREE_LEVEL+1;
      let positionId=cleanText(item.positionId,100);
      if(!seenPositions.has(positionId))positionId=positions.find(position=>position.level===level)?.id||'';
      if(!seenDepartments.has(departmentId)) throw new Error('Uma pessoa aponta para um setor inexistente.');
      return hydratePersonContact({id,name:cleanText(item.name,220)||'Pessoa sem nome',email:cleanEmail(item.email),photo:cleanPhoto(item.photo),birthday:cleanText(item.birthday,10),departmentId,positionId,level,managerId:cleanText(item.managerId,100),orgGroup:cleanText(item.orgGroup,120),layoutOrder:Number.isFinite(Number(item.layoutOrder))?Number(item.layoutOrder):index});
    });
    people.forEach(person=>{if(person.managerId&&!seenPeople.has(person.managerId))person.managerId='';});
    return {version:16,departments,positions,people,updatedAt:new Date().toISOString()};
  }

  let storageWarning = '';
  let state;
  try {
    LEGACY_STORAGE_KEYS.forEach(key=>localStorage.removeItem(key));
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved ? normalizeState(JSON.parse(saved)) : buildInitialState();
  } catch (error) {
    state = buildInitialState(); storageWarning = 'Os dados salvos não puderam ser lidos e a estrutura foi reiniciada em branco.';
  }
  let historyPast = [], historyFuture = [], activeDepartment='all', viewMode='people', searchTerm='', editorContext=null, pendingConfirm=null, lastFocused=null, toastTimer=null, pendingEditorPhoto='';
  let collapsedLeaders=new Set();
  let orientation='vertical';
  try{if(localStorage.getItem(ORIENT_KEY)==='horizontal')orientation='horizontal';}catch(error){}
  try{
    const savedCollapsed=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||'[]');
    if(Array.isArray(savedCollapsed))collapsedLeaders=new Set(savedCollapsed.filter(id=>state.people.some(person=>person.id===id)));
  }catch(error){}
  const placedDirectors = new Set();
  let panSuppressesClick = false;

  function persist(){
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
    catch (error) { showToast('Não foi possível salvar automaticamente neste navegador. Exporte uma planilha.'); }
  }
  function persistCollapsed(){
    try{localStorage.setItem(COLLAPSE_KEY,JSON.stringify([...collapsedLeaders]));}catch(error){}
  }
  /* ===== Movimento: expandir, recolher e trocar a orientação com animação fluida =====
     Técnica FLIP: mede onde cada elemento estava, redesenha, mede onde ficou e anima
     a diferença. As linhas douradas são redesenhadas a cada quadro para acompanhar. */
  const MOTION={exit:260,move:520,enter:480,stagger:26,maxStagger:360,reach:280};
  const EASE_OUT='cubic-bezier(.22,1,.36,1)',EASE_IN='cubic-bezier(.4,0,.9,.45)';
  const MOTION_SELECTOR='.person-card[data-id],.org-branch[data-id],.director-division[data-key],.collapsed-branch,.collapsed-overview';
  let motionRun=0,motionAnimations=[],motionGhosts=[],wireLoop=0,pendingExit=null,hoveredPersonId='';
  const canAnimate=()=>typeof Element!=='undefined'&&typeof Element.prototype.animate==='function'&&!(typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function motionKey(element){
    if(element.matches('.person-card'))return `p:${element.dataset.id}`;
    if(element.matches('.org-branch'))return `b:${element.dataset.id}`;
    if(element.matches('.director-division'))return `d:${element.dataset.key}`;
    if(element.matches('.collapsed-branch'))return `c:${element.closest('.director-division')?.dataset.key||''}`;
    if(element.matches('.collapsed-overview'))return 'o';
    return '';
  }
  function motionSnapshot(){
    const map=new Map();
    $('#chartCanvas').querySelectorAll(MOTION_SELECTOR).forEach(element=>{const key=motionKey(element);if(key&&!map.has(key))map.set(key,{element,rect:element.getBoundingClientRect()});});
    return map;
  }
  function flowScale(){const flow=$('#chartFlow');return flow&&flow.offsetWidth?(flow.getBoundingClientRect().width/flow.offsetWidth)||1:1;}
  function stopMotion(){
    motionAnimations.forEach(animation=>{try{animation.cancel();}catch(error){}});motionAnimations=[];
    motionGhosts.forEach(({ghost,host})=>{ghost.remove();host.classList.remove('is-morphing');});motionGhosts=[];
    cancelAnimationFrame(wireLoop);
  }
  function track(animation){motionAnimations.push(animation);return animation;}
  const center=rect=>({x:rect.left+rect.width/2,y:rect.top+rect.height/2});
  /* Vetor até o líder, limitado para que ramos distantes não atravessem a tela. */
  function towards(fromRect,toRect,scale){
    if(!fromRect||!toRect)return {x:0,y:-12};
    const a=center(fromRect),b=center(toRect);let x=b.x-a.x,y=b.y-a.y;const size=Math.hypot(x,y);
    if(size>MOTION.reach){x=x/size*MOTION.reach;y=y/size*MOTION.reach;}
    return {x:x/scale,y:y/scale};
  }
  /* As linhas de quem entra ou sai acompanham a opacidade do próprio card. */
  function fadeWires(fades){
    if(!fades||!fades.size)return;
    const svg=$('#chartCanvas')?.querySelector('.org-wires');if(!svg)return;
    svg.querySelectorAll('[data-key]').forEach(node=>{
      const fade=fades.get(node.dataset.key);if(!fade)return;
      let progress=null;try{progress=fade.animation.effect.getComputedTiming().progress;}catch(error){}
      if(progress===null||progress===undefined)progress=1;
      /* Entrando: a linha só aparece quando o card já saiu de cima do líder.
         Saindo: some logo no começo, antes do card encostar no líder. */
      const opacity=fade.mode==='in'?(progress-0.4)/0.6:1-progress/0.55;
      node.style.opacity=String(Math.max(0,Math.min(1,opacity)));
    });
  }
  function wiresDuring(run,duration,fades=null){
    cancelAnimationFrame(wireLoop);
    const until=performance.now()+duration+40;
    const tick=()=>{
      if(run!==motionRun)return;
      drawWires();fadeWires(fades);
      if(performance.now()<until)wireLoop=requestAnimationFrame(tick);
      else if(hoveredPersonId)highlightWires(hoveredPersonId);
    };
    wireLoop=requestAnimationFrame(tick);
  }
  /* Caixas (diretoria e setor) mudam de tamanho: um "fantasma" com o mesmo visual
     encolhe ou cresce enquanto o conteúdo se reposiciona. */
  function morphBox(host,dw,dh,duration){
    const styles=getComputedStyle(host);
    const widths=['Top','Right','Bottom','Left'].map(side=>Number.parseFloat(styles[`border${side}Width`])||0);
    const ghost=document.createElement('span');ghost.className='motion-ghost';ghost.setAttribute('aria-hidden','true');
    ['backgroundColor','backgroundImage','borderTop','borderRight','borderBottom','borderLeft','borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius','boxShadow'].forEach(property=>{ghost.style[property]=styles[property];});
    ghost.style.top=`${-widths[0]}px`;ghost.style.left=`${-widths[3]}px`;
    host.classList.add('is-morphing');host.append(ghost);motionGhosts.push({ghost,host});
    const animation=track(ghost.animate([
      {right:`${-widths[1]-dw}px`,bottom:`${-widths[2]-dh}px`},
      {right:`${-widths[1]}px`,bottom:`${-widths[2]}px`}
    ],{duration,easing:EASE_OUT,fill:'both'}));
    animation.finished.then(()=>{ghost.remove();host.classList.remove('is-morphing');motionGhosts=motionGhosts.filter(item=>item.ghost!==ghost);}).catch(()=>{});
  }
  /* Redesenha e anima cada elemento da posição antiga para a nova. */
  function flipRender({mutate,anchorId='',afterLayout=null,duration=MOTION.move}={}){
    const run=++motionRun;
    const canvas=$('#chartCanvas');
    const before=motionSnapshot();
    const anchorBefore=anchorId?before.get(`p:${anchorId}`)?.rect:null;
    stopMotion();
    mutate?.();
    render();applyZoom();
    if(anchorBefore){
      const anchor=canvas.querySelector(`.person-card[data-id="${CSS.escape(anchorId)}"]`);
      if(anchor){
        const now=anchor.getBoundingClientRect();
        canvas.scrollLeft+=now.left-anchorBefore.left;canvas.scrollTop+=now.top-anchorBefore.top;
        const rest=anchor.getBoundingClientRect();
        const dy=rest.top-anchorBefore.top;
        if(Math.abs(dy)>1&&document.scrollingElement)document.scrollingElement.scrollTop+=dy;
      }
    }
    afterLayout?.();
    if(!canAnimate()){drawWires();return;}
    const scale=flowScale();
    const after=motionSnapshot();
    const leaderRect=anchorId?after.get(`p:${anchorId}`)?.rect:null;
    const moved=new Map(),entering=new Set();
    after.forEach((item,key)=>{const previous=before.get(key);if(previous)moved.set(item.element,{dx:previous.rect.left-item.rect.left,dy:previous.rect.top-item.rect.top,previous:previous.rect,rect:item.rect});else entering.add(item.element);});
    const trackedAncestor=element=>{for(let parent=element.parentElement;parent&&parent!==canvas;parent=parent.parentElement){if(moved.has(parent)||entering.has(parent))return parent;}return null;};
    let order=0,nested=0;const fades=new Map();
    after.forEach(item=>{
      const element=item.element,ancestor=trackedAncestor(element);
      const carried=ancestor&&moved.get(ancestor);
      const offsetX=carried?carried.dx:0,offsetY=carried?carried.dy:0;
      const change=moved.get(element);
      if(change){
        const dx=(change.dx-offsetX)/scale,dy=(change.dy-offsetY)/scale;
        if(Math.abs(dx)>0.5||Math.abs(dy)>0.5)track(element.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration,easing:EASE_OUT}));
        if(element.matches('.org-branch,.director-division')){
          const dw=(change.previous.width-change.rect.width)/scale,dh=(change.previous.height-change.rect.height)/scale;
          if(Math.abs(dw)>1||Math.abs(dh)>1)morphBox(element,dw,dh,duration);
        }
        return;
      }
      if(!entering.has(element))return;
      const nestedEntry=Boolean(ancestor&&entering.has(ancestor));
      let delay,from='translateY(14px) scale(.96)';
      if(nestedEntry){delay=Math.min(180,nested*6);nested+=1;}
      else{delay=Math.min(MOTION.maxStagger,order*MOTION.stagger);order+=1;}
      if(!nestedEntry){
        const vector=towards(item.rect,leaderRect,scale);
        from=`translate(${vector.x-offsetX/scale}px,${vector.y-offsetY/scale}px) scale(.82)`;
      }
      const entrance=track(element.animate([{opacity:0,transform:from},{opacity:1,transform:'translate(0,0) scale(1)'}],{duration:MOTION.enter,delay,easing:EASE_OUT,fill:'backwards'}));
      if(element.matches('.person-card'))fades.set(element.dataset.id,{animation:entrance,mode:'in'});
    });
    const knob=anchorId?canvas.querySelector(`.team-toggle[data-person-id="${CSS.escape(anchorId)}"] .team-knob`):null;
    if(knob){
      track(knob.animate([{transform:'rotate(-180deg) scale(.85)'},{transform:'rotate(0) scale(1)'}],{duration:MOTION.enter,easing:EASE_OUT}));
    }
    drawWires();fadeWires(fades);
    wiresDuring(run,Math.max(duration,MOTION.enter+Math.min(MOTION.maxStagger,order*MOTION.stagger)),fades);
  }
  /* Quem vai sumir ao recolher: os cards da equipe ou os ramos inteiros da diretoria. */
  function leavingElements(personId){
    const person=state.people.find(item=>item.id===personId);if(!person)return [];
    const canvas=$('#chartCanvas');
    if(levelOf(person)===0)return [...canvas.querySelectorAll('#departmentGrid>*,#leadershipTree .director-grid')];
    const team=document.getElementById(`team-${personId}`);if(!team)return [];
    if(team.classList.contains('branch-grid'))return [...team.children].filter(element=>element.matches('.org-branch'));
    return [...team.querySelectorAll('.person-card[data-id]')];
  }
  function animateExit(personId,elements,run){
    const canvas=$('#chartCanvas');
    const leader=canvas.querySelector(`.person-card[data-id="${CSS.escape(personId)}"]`)?.getBoundingClientRect();
    const scale=flowScale();
    const total=elements.length;
    const knob=canvas.querySelector(`.team-toggle[data-person-id="${CSS.escape(personId)}"] .team-knob`);
    if(knob)track(knob.animate([{transform:'rotate(0)'},{transform:'rotate(180deg)'}],{duration:MOTION.exit,easing:EASE_IN,fill:'forwards'}));
    const fades=new Map();
    const animations=elements.map((element,index)=>{
      const vector=towards(element.getBoundingClientRect(),leader,scale);
      const delay=Math.min(160,(total-1-index)*14);
      const cards=element.matches('.person-card')?[element]:[...element.querySelectorAll('.person-card[data-id]')];
      const animation=track(element.animate([{opacity:1,transform:'translate(0,0) scale(1)'},{opacity:0,transform:`translate(${vector.x}px,${vector.y}px) scale(.8)`}],{duration:MOTION.exit,delay,easing:EASE_IN,fill:'forwards'}));
      cards.forEach(card=>fades.set(card.dataset.id,{animation,mode:'out'}));
      return animation;
    });
    wiresDuring(run,MOTION.exit+Math.min(160,(total-1)*14),fades);
    return Promise.all(animations.map(animation=>animation.finished));
  }
  function refocusToggle(personId){
    requestAnimationFrame(()=>document.querySelector(`.team-toggle[data-person-id="${CSS.escape(personId)}"]`)?.focus({preventScroll:true}));
  }
  function toggleLeader(personId){
    if(pendingExit){const flush=pendingExit;pendingExit=null;flush();}
    const collapsing=!collapsedLeaders.has(personId);
    hoveredPersonId=personId;
    const apply=()=>{if(collapsing)collapsedLeaders.add(personId);else collapsedLeaders.delete(personId);persistCollapsed();};
    if(!canAnimate()||normalizedQuery()){apply();render();refocusToggle(personId);return;}
    const leaving=collapsing?leavingElements(personId):[];
    if(!leaving.length){flipRender({mutate:apply,anchorId:personId});refocusToggle(personId);return;}
    const run=++motionRun;
    let settled=false;
    const finish=animate=>{
      if(settled)return;settled=true;
      if(pendingExit===flushNow)pendingExit=null;
      if(animate){flipRender({mutate:apply,anchorId:personId});}
      else{stopMotion();apply();render();}
      refocusToggle(personId);
    };
    const flushNow=()=>finish(false);
    pendingExit=flushNow;
    animateExit(personId,leaving,run).then(()=>{if(run===motionRun)finish(true);}).catch(()=>{});
  }
  function setOrientation(value){
    if(value!==orientation&&(value==='horizontal'||value==='vertical')){
      if(pendingExit){const flush=pendingExit;pendingExit=null;flush();}
      flipRender({mutate:()=>{orientation=value;try{localStorage.setItem(ORIENT_KEY,value);}catch(error){}},afterLayout:()=>scrollToStart(false),duration:640});
      showToast(value==='vertical'?'Organograma na vertical: de cima para baixo.':'Organograma na horizontal: da esquerda para a direita.');
    }
  }
  /* Início do quadro: na vertical, a fundação fica centralizada no topo. */
  function scrollToStart(smooth=true){
    const canvas=$('#chartCanvas');
    const founder=isVerticalLayout()?canvas.querySelector('.founder-node>.person-card'):null;
    let left=0;
    if(founder){
      const base=canvas.getBoundingClientRect(),rect=founder.getBoundingClientRect();
      left=Math.max(0,rect.left-base.left+canvas.scrollLeft-(canvas.clientWidth-rect.width)/2);
    }
    if(smooth)scrollCanvas(left,0);else{canvas.scrollLeft=left;canvas.scrollTop=0;}
  }

  function commit(mutator,message){
    historyPast.push(clone(state)); if(historyPast.length>40) historyPast.shift(); historyFuture=[];
    mutator(); persist(); render(); if(message) showToast(message);
  }
  function undo(){ if(!historyPast.length) return; historyFuture.push(clone(state)); state=historyPast.pop(); persist(); render(); showToast('Alteração desfeita.'); }
  function redo(){ if(!historyFuture.length) return; historyPast.push(clone(state)); state=historyFuture.pop(); persist(); render(); showToast('Alteração refeita.'); }
  function showToast(message){
    const toast=$('#toast'); toast.textContent=message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),3200);
  }
  function departmentById(id){ return state.departments.find(item=>item.id===id); }

  function isLeadership(person){ return person.departmentId==='diretoria' || levelOf(person)<=1; }
  function normalizedQuery(){ return strip(searchTerm); }

  /* ===== Linhas douradas: desenha cada ligação de responsabilidade sobre o canvas ===== */
  const SVG_NS='http://www.w3.org/2000/svg';
  const round=value=>Math.round(value*10)/10;
  let wireFrame=0;
  function wireSurface(){
    const canvas=$('#chartCanvas');if(!canvas)return null;
    let svg=canvas.querySelector('.org-wires');
    if(!svg){svg=document.createElementNS(SVG_NS,'svg');svg.setAttribute('class','org-wires');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');canvas.prepend(svg);}
    return svg;
  }
  function scheduleWires(){cancelAnimationFrame(wireFrame);wireFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{applyZoom();drawWires();}));}
  const ZOOM_MIN=0.5,ZOOM_MAX=1.4,ZOOM_FIT_FLOOR=0.85,ZOOM_FIT_FLOOR_VERTICAL=0.7;
  const stackedViewport=()=>typeof window.matchMedia==='function'&&window.matchMedia('(max-width:760px)').matches;
  const isVerticalLayout=()=>orientation==='vertical'&&!stackedViewport();
  let zoomLevel=1,zoomMode='fit';
  function applyZoom(){
    const canvas=$('#chartCanvas'),stage=$('#chartStage'),flow=$('#chartFlow');
    if(!canvas||!stage||!flow)return;
    flow.style.transform='none';stage.style.width='';stage.style.height='';
    const width=flow.offsetWidth,height=flow.offsetHeight;
    const empilhado=stackedViewport();
    if(empilhado){zoomLevel=1;}
    else if(zoomMode==='fit'&&width>0){
      const styles=getComputedStyle(canvas);
      const available=canvas.clientWidth-(Number.parseFloat(styles.paddingLeft)||0)-(Number.parseFloat(styles.paddingRight)||0);
      zoomLevel=Math.min(1,Math.max(isVerticalLayout()?ZOOM_FIT_FLOOR_VERTICAL:ZOOM_FIT_FLOOR,available/width));
    }
    zoomLevel=Math.min(ZOOM_MAX,Math.max(ZOOM_MIN,zoomLevel));
    if(Math.abs(zoomLevel-1)>0.005){
      flow.style.transform=`scale(${zoomLevel})`;
      stage.style.width=`${Math.ceil(width*zoomLevel)}px`;
      stage.style.height=`${Math.ceil(height*zoomLevel)}px`;
    }
    const label=$('#zoomLabel');if(label)label.textContent=`${Math.round(zoomLevel*100)}%`;
    const fit=$('#zoomFitButton');if(fit)fit.setAttribute('aria-pressed',String(zoomMode==='fit'));
  }
  function setZoom(value){zoomMode='manual';zoomLevel=Math.min(ZOOM_MAX,Math.max(ZOOM_MIN,Math.round(value*100)/100));scheduleWires();}
  function toggleFit(){zoomMode=zoomMode==='fit'?'manual':'fit';if(zoomMode==='manual')zoomLevel=1;scheduleWires();}
  function drawWires(){
    const canvas=$('#chartCanvas');const svg=wireSurface();if(!canvas||!svg)return;
    const base=canvas.getBoundingClientRect();
    const offsetX=canvas.scrollLeft-base.left,offsetY=canvas.scrollTop-base.top;
    const width=Math.max(canvas.scrollWidth,canvas.clientWidth),height=Math.max(canvas.scrollHeight,canvas.clientHeight);
    const flow=canvas.querySelector('.chart-flow');
    const scale=flow&&flow.offsetWidth?flow.getBoundingClientRect().width/flow.offsetWidth:1;
    const canvasStyles=getComputedStyle(canvas);
    const fan=(Number.parseFloat(canvasStyles.getPropertyValue('--fan'))||52)*scale;
    const vertical=isVerticalLayout();
    const stacked=stackedViewport();
    /* Na vertical a linha entra pela foto, que sobe acima da borda do card. */
    const rise=canvas.classList.contains('compact-view')?0:(Number.parseFloat(canvasStyles.getPropertyValue('--avatar-rise'))||0)*scale;
    const segments=[],caps=[];
    const box=(element,key='')=>{const rect=element.getBoundingClientRect();return {element,key,l:rect.left+offsetX,t:rect.top+offsetY,r:rect.right+offsetX,b:rect.bottom+offsetY,cx:rect.left+rect.width/2+offsetX,cy:rect.top+rect.height/2+offsetY,w:rect.width,h:rect.height};};
    const line=(d,kind,key='')=>{if(d)segments.push({d,kind,key});};
    const cap=(x,y,key='')=>caps.push({x:round(x),y:round(y),key});
    /* Traça uma polilinha ortogonal com os cantos arredondados. */
    const CURVE=11;
    function path(points){
      const brutos=points.filter((point,index)=>index===0||Math.abs(point.x-points[index-1].x)>0.5||Math.abs(point.y-points[index-1].y)>0.5);
      if(brutos.length<2)return '';
      /* descarta vértices que não mudam de direção, para não curvar em linha reta */
      const pts=[brutos[0]];
      for(let index=1;index<brutos.length-1;index+=1){
        const anterior=pts[pts.length-1],atual=brutos[index],proximo=brutos[index+1];
        const reto=(Math.abs(anterior.y-atual.y)<0.5&&Math.abs(atual.y-proximo.y)<0.5)||(Math.abs(anterior.x-atual.x)<0.5&&Math.abs(atual.x-proximo.x)<0.5);
        if(!reto)pts.push(atual);
      }
      pts.push(brutos[brutos.length-1]);
      let d=`M${round(pts[0].x)} ${round(pts[0].y)}`;
      for(let index=1;index<pts.length-1;index+=1){
        const prev=pts[index-1],corner=pts[index],next=pts[index+1];
        const entrada=Math.hypot(corner.x-prev.x,corner.y-prev.y);
        const saida=Math.hypot(next.x-corner.x,next.y-corner.y);
        const raio=Math.min(CURVE,entrada/2,saida/2);
        if(raio<1.5){d+=`L${round(corner.x)} ${round(corner.y)}`;continue;}
        const ax=corner.x+(prev.x-corner.x)/entrada*raio,ay=corner.y+(prev.y-corner.y)/entrada*raio;
        const bx=corner.x+(next.x-corner.x)/saida*raio,by=corner.y+(next.y-corner.y)/saida*raio;
        d+=`L${round(ax)} ${round(ay)}Q${round(corner.x)} ${round(corner.y)} ${round(bx)} ${round(by)}`;
      }
      const fim=pts[pts.length-1];
      return `${d}L${round(fim.x)} ${round(fim.y)}`;
    }
    /* Fluxo lateral: o traço sai pela direita do responsável, desce pela calha e entra
       pela borda esquerda de cada liderado, na altura do centro dele. */
    function connect(parent,children,kind,scopeKey,busHint){
      const kids=children.filter(Boolean);if(!parent||!kids.length)return;
      const minLeft=Math.min(...kids.map(item=>item.l));
      let busX=Number.isFinite(busHint)?busHint:parent.r+Math.min(fan/2,(minLeft-parent.r)/2);
      if(!(busX>parent.r+4))busX=parent.r+8;
      if(busX>minLeft-5)busX=minLeft-5;
      kids.forEach(item=>{
        if(item.l>=parent.r+6){
          line(path([{x:parent.r,y:parent.cy},{x:busX,y:parent.cy},{x:busX,y:item.cy},{x:item.l,y:item.cy}]),kind,item.key);
        } else {
          const guia=Math.min(parent.l+14,item.l-8);
          line(path([{x:guia,y:parent.b},{x:guia,y:item.cy},{x:item.l,y:item.cy}]),kind,item.key);
        }
        cap(item.l,item.cy,item.key);
      });
    }
    /* Vínculo que nasce em outro ramo: sai pela lateral e desce pela calha da coluna. */
    function connectAcross(managerCard,target,key){
      let startX;
      let endX;
      let corridor;

      if(target.l>=managerCard.r){
        startX=managerCard.r;
        endX=target.l;
        corridor=(startX+endX)/2;
      }else if(target.r<=managerCard.l){
        startX=managerCard.l;
        endX=target.r;
        corridor=(startX+endX)/2;
      }else{
        const routeRight=target.cx>=managerCard.cx;
        startX=routeRight?managerCard.r:managerCard.l;
        endX=routeRight?target.r:target.l;
        corridor=routeRight
          ?Math.max(managerCard.r,target.r)+Math.max(14,fan/3)
          :Math.min(managerCard.l,target.l)-Math.max(14,fan/3);
      }

      line(path([{x:startX,y:managerCard.cy},{x:corridor,y:managerCard.cy},{x:corridor,y:target.cy},{x:endX,y:target.cy}]),'wire-link',key);
      cap(endX,target.cy,key);
    }
    /* Fluxo vertical: sai pela base do responsável, corre pela barra e desce até a foto
       de cada liderado. Pilhas de liderados usam uma guia lateral. */
    /* Rótulos no caminho (setor, diretoria, contagem): a linha passa "por trás" deles. */
    /* Cards de diretores soltos na faixa de liderança (nível 2 sem ramo próprio) também
       entram como obstáculo: o tronco da fundação para "Áreas e equipes" não pode
       atravessá-los, senão parece que o vínculo é direto com a fundação. */
    const obstacles=vertical?[...canvas.querySelectorAll('.branch-head,.division-lead>.division-tag,.division-lead>.division-meta,.leadership-stack>.division-meta,.leadership-stack>.division-tag,.director-node')].map(element=>box(element)):[];
    function lineAround(points,kind,key){
      if(!obstacles.length){line(path(points),kind,key);return;}
      const pieces=[];let current=[points[0]];
      for(let index=1;index<points.length;index+=1){
        const a=points[index-1],b=points[index];
        if(Math.abs(a.x-b.x)<0.5&&Math.abs(a.y-b.y)>0.5){
          const down=b.y>a.y,top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
          const hits=obstacles.filter(item=>a.x>=item.l-3&&a.x<=item.r+3&&item.b>top&&item.t<bottom).sort((p,q)=>down?p.t-q.t:q.t-p.t);
          hits.forEach(item=>{
            const last=current[current.length-1].y;
            const enter=down?Math.max(last,item.t-4):Math.min(last,item.b+4);
            const exit=down?Math.min(b.y,item.b+4):Math.max(b.y,item.t-4);
            current.push({x:a.x,y:enter});pieces.push(current);current=[{x:a.x,y:exit}];
          });
        } else if(Math.abs(a.y-b.y)<0.5&&Math.abs(a.x-b.x)>0.5){
          /* Mesmo desvio, agora para trechos horizontais do fio (barra de divisão sobre os cabeçalhos). */
          const right=b.x>a.x,left=Math.min(a.x,b.x),rightEdge=Math.max(a.x,b.x);
          const hits=obstacles.filter(item=>a.y>=item.t-3&&a.y<=item.b+3&&item.r>left&&item.l<rightEdge).sort((p,q)=>right?p.l-q.l:q.l-p.l);
          hits.forEach(item=>{
            const last=current[current.length-1].x;
            const enter=right?Math.max(last,item.l-4):Math.min(last,item.r+4);
            const exit=right?Math.min(b.x,item.r+4):Math.max(b.x,item.l-4);
            current.push({x:enter,y:a.y});pieces.push(current);current=[{x:exit,y:a.y}];
          });
        }
        current.push(b);
      }
      pieces.push(current);
      pieces.forEach(piece=>line(path(piece),kind,key));
    }
    function connectDown(parent,children,kind,busHint,stacked=false){
      const kids=children.filter(Boolean);if(!parent||!kids.length)return;
      if(stacked==='split'){
        /* Pilha em duas colunas: uma espinha desce pelo centro e abre para os lados. */
        const spine=parent.cx;
        kids.forEach(item=>{const leftSide=item.cx<spine;const edge=leftSide?item.r:item.l;line(path([{x:spine,y:parent.b},{x:spine,y:item.cy},{x:edge,y:item.cy}]),kind,item.key);cap(edge,item.cy,item.key);});
        return;
      }
      if(stacked){
        const guia=Math.max(parent.l+10,Math.min(...kids.map(item=>item.l))-16*scale);
        kids.forEach(item=>{line(path([{x:guia,y:parent.b},{x:guia,y:item.cy},{x:item.l,y:item.cy}]),kind,item.key);cap(item.l,item.cy,item.key);});
        return;
      }
      const top=Math.min(...kids.map(item=>item.t-rise));
      let busY=Number.isFinite(busHint)?busHint:parent.b+Math.min(fan*0.8,(top-parent.b)/2);
      if(!(busY>parent.b+4))busY=parent.b+Math.max(4,(top-parent.b)/2);
      if(busY>top-5)busY=top-5;
      kids.forEach(item=>{
        const entryY=item.t-rise;
        if(entryY>=parent.b+6){
          lineAround([{x:parent.cx,y:parent.b},{x:parent.cx,y:busY},{x:item.cx,y:busY},{x:item.cx,y:entryY}],kind,item.key);
          cap(item.cx,entryY,item.key);
        } else {
          const guia=Math.min(parent.l+14,item.l-8);
          line(path([{x:guia,y:parent.b},{x:guia,y:item.cy},{x:item.l,y:item.cy}]),kind,item.key);
          cap(item.l,item.cy,item.key);
        }
      });
    }
    function connectAcrossDown(managerCard,target,key){
      const entryY=target.t-rise;
      const branch=target.element?.closest?.('.org-branch');
      const branchTop=branch?box(branch).t:entryY;
      /* Mantém o trecho horizontal acima do cabeçalho do setor. O trecho vertical
         continua usando lineAround para desaparecer atrás de títulos e chips. */
      const preferredCorridor=Math.min(entryY-Math.max(12,fan/2),branchTop-10*scale);
      const corridor=Math.max(managerCard.b+8,preferredCorridor);
      lineAround([{x:managerCard.cx,y:managerCard.b},{x:managerCard.cx,y:corridor},{x:target.cx,y:corridor},{x:target.cx,y:entryY}],'wire-link',key);
      cap(target.cx,entryY,key);
    }
    const cardOf=id=>id?canvas.querySelector(`.person-card[data-id="${CSS.escape(id)}"]`):null;

    const leads=[],leadPanels=[];
    canvas.querySelectorAll('.director-division').forEach((division,index)=>{
      const key=`division:${division.dataset.key||index}`;
      const directorCard=division.querySelector(':scope>.division-lead>.person-card');
      const anchorElement=directorCard||division.querySelector(':scope>.division-lead');
      if(!anchorElement)return;
      const anchor=box(anchorElement,directorCard?directorCard.dataset.id:key);
      const divisionRect=division.getBoundingClientRect();
      leads.push(anchor);leadPanels.push(vertical?divisionRect.top+offsetY:divisionRect.left+offsetX);
      /* O diretor se liga a cada pessoa que abre um ramo, não à caixa do setor. */
      const rootCards=[...division.querySelectorAll('.reporting-root>.reporting-node>.person-card')];
      if(!rootCards.length)return;
      const paineis=[...division.querySelectorAll(':scope>.branch-grid>.org-branch')].map(branch=>{const rect=branch.getBoundingClientRect();return vertical?rect.top+offsetY:rect.left+offsetX;});
      const painelEsquerda=paineis.length?Math.min(...paineis):Infinity;
      const limite=vertical?anchor.b:anchor.r;
      const busDivisao=painelEsquerda>limite&&Number.isFinite(painelEsquerda)?(limite+painelEsquerda)/2:undefined;
      const direct=[],elsewhere=new Map();
      rootCards.forEach(card=>{
        const person=state.people.find(item=>item.id===card.dataset.id);
        const managerId=person?.managerId||'';
        const managerCard=managerId?cardOf(managerId):null;
        if(!managerCard||managerCard===directorCard||(!directorCard&&managerCard.closest('.founder-node'))){direct.push(box(card,card.dataset.id));return;}
        if(!elsewhere.has(managerId))elsewhere.set(managerId,[]);
        elsewhere.get(managerId).push(box(card,card.dataset.id));
      });
      /* Na lista empilhada do celular os blocos ficam um sobre o outro: os fios entre blocos só
         atravessariam bordas e títulos. Quem responde a quem já aparece no chip "Reporta-se a". */
      if(stacked)return;
      if(vertical)connectDown(anchor,direct,'wire-branch',busDivisao);else connect(anchor,direct,'wire-branch',key,busDivisao);
      elsewhere.forEach((targets,managerId)=>{
        const managerCard=cardOf(managerId);if(!managerCard)return;
        const managerBox=box(managerCard);
        targets.forEach(target=>vertical?connectAcrossDown(managerBox,target,target.key):connectAcross(managerBox,target,target.key));
      });
    });
    const orphans=[...canvas.querySelectorAll('.director-node>.person-card')].map(card=>box(card,card.dataset.id));
    const founders=[...canvas.querySelectorAll('.founder-node>.person-card')];
    if(!stacked)founders.forEach(founder=>{
      const base=box(founder);
      const divisaoEsquerda=leadPanels.length?Math.min(...leadPanels):Infinity;
      const limite=vertical?base.b:base.r;
      const busFundacao=divisaoEsquerda>limite&&Number.isFinite(divisaoEsquerda)?(limite+divisaoEsquerda)/2:undefined;
      if(vertical)connectDown(base,[...leads,...orphans],'wire-trunk',busFundacao);else connect(base,[...leads,...orphans],'wire-trunk','',busFundacao);
    });

    canvas.querySelectorAll('.reporting-node').forEach(node=>{
      const card=node.querySelector(':scope>.person-card');if(!card)return;
      const children=[...node.querySelectorAll(':scope>.reporting-children>.reporting-node>.person-card')];
      if(!children.length)return;
      const kids=children.map(child=>box(child,child.dataset.id));
      if(vertical)connectDown(box(card),kids,'wire-branch',undefined,node.classList.contains('has-split')?'split':node.classList.contains('has-stack'));
      else connect(box(card),kids,'wire-branch',card.dataset.id||'');
    });

    svg.replaceChildren();
    svg.setAttribute('viewBox',`0 0 ${round(width)} ${round(height)}`);
    svg.setAttribute('width',round(width));svg.setAttribute('height',round(height));
    svg.style.width=`${round(width)}px`;svg.style.height=`${round(height)}px`;
    const fragment=document.createDocumentFragment();
    segments.forEach(segment=>{
      const path=document.createElementNS(SVG_NS,'path');path.setAttribute('d',segment.d);path.setAttribute('class',`wire ${segment.kind}`);if(segment.key)path.dataset.key=segment.key;fragment.append(path);
    });
    caps.forEach(item=>{
      const dot=document.createElementNS(SVG_NS,'circle');dot.setAttribute('cx',item.x);dot.setAttribute('cy',item.y);dot.setAttribute('r','2.8');dot.setAttribute('class','wire-cap');if(item.key)dot.dataset.key=item.key;fragment.append(dot);
    });
    svg.append(fragment);
    if(searchLit)highlightWires(searchLit);
  }
  function highlightWires(personId){
    const canvas=$('#chartCanvas');const svg=canvas?.querySelector('.org-wires');if(!svg)return;
    svg.querySelectorAll('.is-lit').forEach(node=>node.classList.remove('is-lit'));
    if(!personId)return;
    const keys=new Set();let current=state.people.find(person=>person.id===personId),guard=0;
    while(current&&guard<40){
      guard+=1;keys.add(current.id);
      const card=canvas.querySelector(`.person-card[data-id="${CSS.escape(current.id)}"]`);
      const branch=card?.closest('.org-branch');if(branch)keys.add(`branch:${branch.dataset.id}`);
      const division=card?.closest('.director-division');if(division)keys.add(`division:${division.dataset.key}`);
      current=current.managerId?state.people.find(person=>person.id===current.managerId):null;
    }
    const acesos=[...svg.querySelectorAll('[data-key]')].filter(node=>keys.has(node.dataset.key));
    acesos.forEach(node=>node.classList.add('is-lit'));
    acesos.forEach(node=>svg.append(node));
  }

  function render(){
    buildOrgCodes(); renderStats(); renderOrgBranches(); renderLeadership();
    $('#undoButton').disabled=!historyPast.length; $('#redoButton').disabled=!historyFuture.length;
    $('#chartCanvas').classList.toggle('compact-view',viewMode==='roles');
    $('#chartCanvas').classList.toggle('searching',Boolean(normalizedQuery()));
    $('#detailViewButton').classList.toggle('active',viewMode==='people'); $('#roleViewButton').classList.toggle('active',viewMode==='roles');
    $('#chartCanvas').classList.toggle('is-vertical',orientation==='vertical');
    [['#horizontalViewButton','horizontal'],['#verticalViewButton','vertical']].forEach(([selector,value])=>{const button=$(selector);if(!button)return;button.classList.toggle('active',orientation===value);button.setAttribute('aria-pressed',String(orientation===value));});
    scheduleWires();
  }
  /* A busca marca os resultados, conta quantos são e leva a vista até cada um. */
  let searchMatches=[],searchIndex=-1,searchTimer=null,searchLit='';
  function collectMatches(){
    const canvas=$('#chartCanvas');
    searchMatches=normalizedQuery()?[...canvas.querySelectorAll('.person-card.match[data-id]')]:[];
    const nav=$('#searchNav');
    nav.hidden=!normalizedQuery();
    const count=$('#searchCount');
    count.textContent=searchMatches.length?`1/${searchMatches.length}`:'0';
    count.dataset.empty=String(!searchMatches.length);
    $('#searchPrev').disabled=searchMatches.length<2;
    $('#searchNext').disabled=searchMatches.length<2;
    searchIndex=-1;searchLit='';
    if(searchMatches.length)goToMatch(0,false);else highlightWires('');
  }
  function goToMatch(index,mover=true){
    if(!searchMatches.length)return;
    const total=searchMatches.length;
    searchIndex=((index%total)+total)%total;
    const card=searchMatches[searchIndex];
    searchMatches.forEach(item=>item.classList.remove('is-current'));
    card.classList.add('is-current');
    $('#searchCount').textContent=`${searchIndex+1}/${total}`;
    searchLit=card.dataset.id;highlightWires(searchLit);
    if(mover)centerCard(card);
  }
  function scrollCanvas(left,top){
    const canvas=$('#chartCanvas');
    if(typeof canvas.scrollTo==='function'){canvas.scrollTo({left,top,behavior:'smooth'});return;}
    canvas.scrollLeft=left;canvas.scrollTop=top;
  }
  function centerCard(card){
    const canvas=$('#chartCanvas');
    const base=canvas.getBoundingClientRect(),rect=card.getBoundingClientRect();
    const left=rect.left-base.left+canvas.scrollLeft-(canvas.clientWidth-rect.width)/2;
    const top=rect.top-base.top+canvas.scrollTop-(canvas.clientHeight-rect.height)/2;
    scrollCanvas(Math.max(0,left),Math.max(0,top));
  }
  function runSearch(value){
    searchTerm=value;
    render();
    collectMatches();
    if(searchMatches.length)centerCard(searchMatches[0]);
  }
  function clearSearch(){
    const input=$('#searchInput');
    input.value='';
    runSearch('');
    input.focus();
  }
  function renderLevelLegend(){
    const root=$('#chartLegend');if(!root)return;root.replaceChildren();
    LEVELS.forEach((level,index)=>{
      const item=document.createElement('span');const mark=document.createElement('i');mark.style.setProperty('--level-color',level.color);
      item.append(mark,document.createTextNode(`${index+1}. ${level.name}`));root.append(item);
    });
  }
  /* Numeração hierárquica: a fundação é 1, quem responde a ela é 1.1, 1.2, e assim por diante.
     O código sai da própria linha de reporte, na mesma ordem em que os cartões aparecem. */
  let orgCodes=new Map();
  function buildOrgCodes(){
    const byManager=new Map();
    state.people.forEach(person=>{
      const key=person.managerId||'';
      if(!byManager.has(key))byManager.set(key,[]);
      byManager.get(key).push(person);
    });
    byManager.forEach(list=>list.sort((a,b)=>levelOf(a)-levelOf(b)||a.layoutOrder-b.layoutOrder));
    const codes=new Map();
    const walk=(managerId,prefix)=>{
      (byManager.get(managerId)||[]).forEach((person,index)=>{
        if(codes.has(person.id))return;
        const code=prefix?`${prefix}.${index+1}`:String(index+1);
        codes.set(person.id,code);
        walk(person.id,code);
      });
    };
    walk('','');
    state.people.forEach(person=>{if(!codes.has(person.id))codes.set(person.id,'—');});
    orgCodes=codes;
  }
  function codeOf(person){ return orgCodes.get(person?.id)||'—'; }
  function renderStats(){
    $('#peopleStat').textContent=state.people.length.toLocaleString('pt-BR');
    $('#positionsStat').textContent=state.positions.length.toLocaleString('pt-BR');
    $('#departmentsStat').textContent=state.departments.filter(item=>item.id!=='diretoria').length.toLocaleString('pt-BR');
    $('#leadersStat').textContent=state.people.filter(person=>levelOf(person)<=2).length.toLocaleString('pt-BR');
  }
  function renderDepartmentCatalog(){
    const root=$('#departmentsList');if(!root)return;root.replaceChildren();
    const departments=state.departments.filter(item=>item.id!=='diretoria').slice().sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name,'pt-BR'));
    if(!departments.length){const empty=document.createElement('p');empty.className='catalog-empty';empty.textContent='Nenhum setor cadastrado. Inclua o primeiro setor para vincular pessoas.';root.append(empty);return;}
    departments.forEach(department=>{
      const row=document.createElement('article');row.className='catalog-item';row.style.setProperty('--dept',department.color);
      const copy=document.createElement('div');copy.className='catalog-item-copy';
      const title=document.createElement('strong');const dot=document.createElement('span');dot.className='branch-dot';title.append(dot,document.createTextNode(department.name));title.style.display='flex';title.style.alignItems='center';title.style.gap='6px';
      const meta=document.createElement('span');const count=state.people.filter(person=>person.departmentId===department.id).length;meta.textContent=`${count} ${count===1?'pessoa':'pessoas'}${count?'':' · ainda não aparece no organograma'}`;
      copy.append(title,meta);if(department.description){const description=document.createElement('p');description.textContent=department.description;copy.append(description);}
      const actions=document.createElement('div');actions.className='catalog-item-actions';const edit=makeButton('Editar','edit','btn btn-ghost',()=>{$('#departmentsDialog').close();openEditor('department',department.id);});const remove=makeButton('Excluir','trash','btn btn-ghost',()=>{$('#departmentsDialog').close();requestDeleteOf('department',department.id);});actions.append(edit,remove);row.append(copy,actions);root.append(row);
    });
  }
  function openDepartmentCatalog(){lastFocused=document.activeElement;renderDepartmentCatalog();$('#departmentsDialog').showModal();requestAnimationFrame(()=>$('#addDepartmentInnerButton')?.focus());}
  function renderPositionCatalog(){
    const root=$('#positionsList');if(!root)return;root.replaceChildren();
    const positions=state.positions.slice().sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name,'pt-BR'));
    if(!positions.length){const empty=document.createElement('p');empty.className='catalog-empty';empty.textContent='Nenhum cargo cadastrado. Inclua o primeiro cargo para vincular pessoas.';root.append(empty);return;}
    positions.forEach(position=>{
      const row=document.createElement('article');row.className='catalog-item';
      const copy=document.createElement('div');copy.className='catalog-item-copy';const title=document.createElement('strong');title.textContent=position.name;const meta=document.createElement('span');const count=state.people.filter(person=>person.positionId===position.id).length;meta.textContent=`${LEVELS[position.level]?.name||`Nível ${position.level+1}`} · ${count} ${count===1?'pessoa':'pessoas'}`;copy.append(title,meta);if(position.description){const description=document.createElement('p');description.textContent=position.description;copy.append(description);}
      const actions=document.createElement('div');actions.className='catalog-item-actions';const edit=makeButton('Editar','edit','btn btn-ghost',()=>{$('#positionsDialog').close();openEditor('position',position.id);});const remove=makeButton('Excluir','trash','btn btn-ghost',()=>{$('#positionsDialog').close();requestDeleteOf('position',position.id);});actions.append(edit,remove);row.append(copy,actions);root.append(row);
    });
  }
  function openPositionCatalog(){lastFocused=document.activeElement;renderPositionCatalog();$('#positionsDialog').showModal();requestAnimationFrame(()=>$('#addPositionButton')?.focus());}
  function renderLeadership(){
    const root=$('#leadershipTree'); root.replaceChildren();
    const leaders=state.people.filter(isLeadership).sort((a,b)=>levelOf(a)-levelOf(b)||a.layoutOrder-b.layoutOrder);
    const founders=leaders.filter(person=>levelOf(person)===0);
    const topCollapsed=founders.some(person=>collapsedLeaders.has(person.id))&&!normalizedQuery();
    const directors=topCollapsed?[]:leaders.filter(person=>levelOf(person)===1&&!placedDirectors.has(person.id));
    if(founders.length||directors.length){const tag=document.createElement('span');tag.className='division-tag';tag.textContent='Fundação';root.append(tag);}
    founders.forEach(person=>{const wrap=document.createElement('div');wrap.className='founder-node';wrap.append(renderIndividualCard(person,departmentById(person.departmentId),true));root.append(wrap);});
    if(founders.length){const meta=document.createElement('p');meta.className='division-meta';const dot=document.createElement('span');dot.className='division-dot';meta.append(dot,document.createTextNode(`${state.people.length} ${state.people.length===1?'pessoa':'pessoas'} no total`));root.append(meta);}
    if(directors.length){const grid=document.createElement('div');grid.className='director-grid';directors.forEach(person=>{const wrap=document.createElement('div');wrap.className='director-node';wrap.append(renderIndividualCard(person,departmentById(person.departmentId),true));grid.append(wrap);});root.append(grid);}
    $('.division-line').hidden=!founders.length&&!directors.length;
  }
  function individualMatches(person,department){
    const query=normalizedQuery(); if(!query)return true;
    const position=positionFor(person);
    return [person?.name,person?.email,person?.birthday,person?.orgGroup,department?.name,position?.name,position?.description,LEVELS[levelOf(person)]?.name,codeOf(person)].some(value=>strip(value).includes(query));
  }
  function personByAlias(alias){
    const tokens=strip(alias).split(' ').filter(Boolean);if(!tokens.length)return null;
    return state.people.find(person=>tokens.every(token=>strip(person.name).includes(token)))||null;
  }
  function divisionGroups(){
    const departments=state.departments.filter(department=>department.id!=='diretoria').sort((a,b)=>a.order-b.order);
    return departments.length?[{key:'estrutura-organizacional',title:'Áreas e equipes',alias:'',departments:departments.map(department=>department.id)}]:[];
  }
  /* Um setor cujo time todo se reporta a alguém de outro setor é absorvido pelo ramo de quem o gerencia. */
  function branchHosts(){
    const hosts=new Map();
    state.departments.forEach(department=>{
      if(department.id==='diretoria')return;
      const people=state.people.filter(person=>person.departmentId===department.id);
      if(!people.length)return;
      const ids=new Set(people.map(person=>person.id));
      const roots=people.filter(person=>!person.managerId||!ids.has(person.managerId));
      if(!roots.length)return;
      const owners=new Set(roots.map(person=>{
        const manager=person.managerId?state.people.find(item=>item.id===person.managerId):null;
        return manager?manager.departmentId:'';
      }));
      if(owners.size!==1)return;
      const owner=[...owners][0];
      if(!owner||owner===department.id||owner==='diretoria')return;
      hosts.set(department.id,owner);
    });
    hosts.forEach((owner,id)=>{if(hosts.get(owner))hosts.delete(id);});
    return hosts;
  }
  function renderOrgBranches(){
    const root=$('#departmentGrid');root.replaceChildren();let visible=0;placedDirectors.clear();
    const topLeader=state.people.find(person=>levelOf(person)===0);
    if(topLeader&&collapsedLeaders.has(topLeader.id)&&!normalizedQuery()){
      const notice=document.createElement('div');notice.className='collapsed-overview';notice.append(icon('users'));
      const copy=document.createElement('div');const title=document.createElement('strong');title.textContent='Estrutura recolhida';const text=document.createElement('span');text.textContent=`${state.people.length-1} pessoas estão ocultas. Expanda o card da fundação para visualizar a organização.`;copy.append(title,text);notice.append(copy);root.append(notice);return;
    }
    const hosts=branchHosts();
    divisionGroups().forEach(group=>{
      const departments=group.departments.map(id=>departmentById(id)).filter(Boolean);
      const director=group.alias?personByAlias(group.alias):null;
      const owned=departments.filter(department=>{
        const host=hosts.get(department.id);
        return !host||!departments.some(item=>item.id===host);
      });
      const branches=owned.map(department=>renderOrgBranch(
        department,
        director?director.id:'',
        departments.filter(item=>hosts.get(item.id)===department.id)
      )).filter(Boolean);
      if(!branches.length)return;
      visible+=branches.length;
      const division=document.createElement('section');division.className='director-division';division.dataset.key=group.key;if(director)division.dataset.managerId=director.id;
      const lead=document.createElement('div');lead.className='division-lead';
      const tag=document.createElement('span');tag.className='division-tag';tag.textContent=group.title;
      lead.append(tag);
      if(director){
        lead.append(renderIndividualCard(director,departmentById(director.departmentId),true));
        placedDirectors.add(director.id);
      }
      const departmentIds=new Set(departments.map(department=>department.id));
      const headcount=state.people.filter(person=>departmentIds.has(person.departmentId)).length;
      const meta=document.createElement('p');meta.className='division-meta';const dot=document.createElement('span');dot.className='division-dot';meta.append(dot,document.createTextNode(`${branches.length} ${branches.length===1?'ramo':'ramos'} · ${headcount} ${headcount===1?'pessoa':'pessoas'}`));
      lead.append(meta);
      const grid=document.createElement('div');grid.className='branch-grid';if(director)grid.id=`team-${director.id}`;
      const divisionCollapsed=Boolean(director&&collapsedLeaders.has(director.id)&&!normalizedQuery());
      if(divisionCollapsed){division.classList.add('is-collapsed');const notice=document.createElement('div');notice.className='collapsed-branch';notice.append(icon('users'),document.createTextNode(`${headcount} pessoas recolhidas`));grid.append(notice);}else branches.forEach(branch=>grid.append(branch));
      division.append(lead,grid);root.append(division);
    });
    if(!visible&&(normalizedQuery()||!state.people.length)){
      const empty=document.createElement('div');empty.className='empty-state';
      if(normalizedQuery()){
        empty.append(icon('search'));
        const title=document.createElement('h3');title.textContent='Nenhuma pessoa encontrada';
        const text=document.createElement('p');text.textContent='Tente outro nome, código ou setor.';
        empty.append(title,text);
      }else{
        /* Primeiro acesso: ninguém foi cadastrado ainda. Guia de três passos em vez da mensagem de busca sem resultado.
           Assim que existir ao menos uma pessoa (mesmo só a fundação), este painel some — não fica pedindo pra sempre. */
        empty.classList.add('onboarding-state');
        empty.append(icon('layout'));
        const title=document.createElement('h3');title.textContent='Comece a montar o organograma';
        const text=document.createElement('p');text.textContent='Cadastre os setores e os cargos da empresa e depois inclua as pessoas.';
        empty.append(title,text);
        const steps=document.createElement('div');steps.className='onboarding-steps';
        const hasDept=state.departments.length>0,hasPos=state.positions.length>0;
        const step=(label,iconName,done,action)=>{
          const button=makeButton(label,iconName,`btn ${done?'btn-ghost':'btn-primary'}`,action);
          if(done){const badge=document.createElement('span');badge.className='onboarding-done';badge.textContent='Concluído';button.append(badge);}
          return button;
        };
        steps.append(
          step('Cadastrar setor','building',hasDept,openDepartmentCatalog),
          step('Cadastrar cargo','briefcase',hasPos,openPositionCatalog),
          step('Cadastrar pessoa','user-plus',false,quickAddPerson)
        );
        empty.append(steps);
      }
      root.append(empty);
    }
  }
  function renderOrgBranch(department,directorId='',merged=[]){
    const query=normalizedQuery();const family=[department,...merged];
    const departmentMatch=family.some(item=>strip(item.name).includes(query)||strip(item.description).includes(query));
    const familyIds=new Set(family.map(item=>item.id));
    /* Fundador (nível 1) já tem card fixo na faixa de liderança: nunca duplicar dentro do próprio setor. */
    const people=state.people.filter(person=>familyIds.has(person.departmentId)&&levelOf(person)!==0);
    /* Setor sem ninguém alocado não tem a quem se ligar: exibi-lo criaria um card solto, sem fio. */
    if(!people.length)return null;
    const hasMatch=!query||departmentMatch||people.some(person=>individualMatches(person,departmentById(person.departmentId)));
    if(!hasMatch)return null;
    /* Lideranças exibidas neste ramo não podem reaparecer na faixa superior. */
    people.filter(isLeadership).forEach(person=>placedDirectors.add(person.id));
    const branch=document.createElement('section');branch.className='org-branch';branch.style.setProperty('--dept',department.color);branch.dataset.id=department.id;
    const head=document.createElement('header');head.className='branch-head';
    const titleButton=document.createElement('button');titleButton.type='button';titleButton.className='branch-title';titleButton.title=department.description||'';titleButton.setAttribute('aria-label',`Editar setor ${department.name}`);
    const dot=document.createElement('span');dot.className='branch-dot';
    const title=document.createElement('h3');title.textContent=department.name;
    titleButton.append(dot,title);
    if(merged.length){const extra=document.createElement('p');extra.textContent=`+ ${merged.map(item=>item.name).join(' + ')}`;titleButton.append(extra);}
    titleButton.addEventListener('click',()=>openEditor('department',department.id));
    const summary=document.createElement('span');summary.className='branch-summary';summary.textContent=`${people.length} ${people.length===1?'pessoa':'pessoas'}`;
    const info=document.createElement('div');info.className='branch-info';info.append(titleButton);
    head.append(info,summary);branch.append(head);
    const tree=document.createElement('div');tree.className='branch-tree';
    const peopleIds=new Set(people.map(person=>person.id));
    const roots=people.filter(person=>!person.managerId||!peopleIds.has(person.managerId)).sort((a,b)=>levelOf(a)-levelOf(b)||a.layoutOrder-b.layoutOrder);
    const externalManagers=[...new Set(roots.map(person=>person.managerId).filter(Boolean))].map(id=>state.people.find(person=>person.id===id)).filter(Boolean);
    branch.dataset.managers=externalManagers.map(person=>person.id).join(',');
    const outsideManagers=externalManagers.filter(person=>person.id!==directorId);
    if(outsideManagers.length){const link=document.createElement('div');link.className='external-manager';const chip=document.createElement('span');chip.className='division-dot';link.append(chip,document.createTextNode('Reporta-se a '));const strong=document.createElement('strong');strong.textContent=outsideManagers.map(person=>smartCase(person.name,true)).join(' e ');link.append(strong);info.append(link);}
    const reportingRoot=document.createElement('div');reportingRoot.className='reporting-root';const visited=new Set();
    /* Uma raiz cujo responsável é de fora do setor some quando esse responsável está recolhido em outro lugar. */
    const foldedManagers=new Map();
    roots.forEach(person=>{
      const managerId=person.managerId;
      const foldedElsewhere=managerId&&!peopleIds.has(managerId)&&collapsedLeaders.has(managerId)&&!query;
      if(foldedElsewhere){
        let count=0;const stack=[person.id];visited.add(person.id);count+=1;
        while(stack.length){const current=stack.pop();people.filter(item=>item.managerId===current&&!visited.has(item.id)).forEach(item=>{visited.add(item.id);count+=1;stack.push(item.id);});}
        foldedManagers.set(managerId,(foldedManagers.get(managerId)||0)+count);
        return;
      }
      reportingRoot.append(...renderReportingNodes(person,people,department,visited));
    });
    people.filter(person=>!visited.has(person.id)).forEach(person=>reportingRoot.append(...renderReportingNodes(person,people,department,visited)));
    foldedManagers.forEach((count,managerId)=>{
      const manager=state.people.find(item=>item.id===managerId);
      const notice=document.createElement('div');notice.className='collapsed-branch';
      notice.append(icon('users'),document.createTextNode(`${count} ${count===1?'pessoa recolhida':'pessoas recolhidas'}${manager?` · ${smartCase(manager.name,true)}`:''}`));
      reportingRoot.append(notice);
    });
    tree.append(reportingRoot);
    branch.append(tree);return branch;
  }
  function renderReportingNodes(person,departmentPeople,department,visited,parentColumn=null){
    if(visited.has(person.id))return [];
    visited.add(person.id);
    const node=document.createElement('div');node.className='reporting-node';
    /* A coluna é a do nível da pessoa, mas nunca a mesma do responsável: quem
       lidera fica sempre um passo atrás na leitura. */
    const column=parentColumn===null?treeColumn(person):Math.max(parentColumn+1,treeColumn(person));
    if(parentColumn===null)node.style.setProperty('--col',String(column));
    else node.style.setProperty('--delta',String(column-parentColumn));
    node.append(renderIndividualCard(person,departmentById(person.departmentId)||department));
    const team=departmentPeople.filter(item=>item.managerId===person.id&&!visited.has(item.id)).sort((a,b)=>levelOf(a)-levelOf(b)||a.layoutOrder-b.layoutOrder);
    if(team.length){
      const isCollapsed=collapsedLeaders.has(person.id)&&!normalizedQuery();
      node.classList.toggle('is-collapsed',isCollapsed);
      if(isCollapsed){markDescendantsVisited(person.id,departmentPeople,visited);return [node];}
      const grid=document.createElement('div');grid.className='reporting-children';
      grid.id=`team-${person.id}`;
      /* Liderados sem equipe própria formam uma pilha: na vista vertical eles descem
         em coluna sob o líder, em vez de alargar a linha. */
      if(team.length>1&&team.every(child=>!departmentPeople.some(item=>item.managerId===child.id))){grid.classList.add('is-stack');node.classList.add('has-stack');if(team.length>=4){grid.classList.add('is-split');node.classList.add('has-split');}}
      team.forEach(child=>grid.append(...renderReportingNodes(child,departmentPeople,department,visited,column)));
      node.append(grid);
    }
    return [node];
  }
  function markDescendantsVisited(managerId,people,visited){
    people.filter(person=>person.managerId===managerId).forEach(person=>{if(visited.has(person.id))return;visited.add(person.id);markDescendantsVisited(person.id,people,visited);});
  }
  function renderIndividualCard(person,department,leader=false){
    const level=levelOf(person);
    const position=positionFor(person);
    const teamSize=state.people.filter(item=>item.managerId===person.id).length;
    const card=document.createElement('article');card.className=`person-card${leader?' leadership-person':''}`;card.style.setProperty('--dept',department?.color||'#C9A06A');card.style.setProperty('--level',LEVELS[level]?.color||'#6B6863');card.dataset.id=person.id;card.dataset.level=String(level);card.title=`${codeOf(person)} · ${position?.name||'Sem cargo'} · ${department?.name||'Sem setor'} · Nível ${level+1}`;
    /* O espaço superior ancora a foto; códigos e níveis seguem apenas como dados
       internos e não competem visualmente com o cargo exibido abaixo do nome. */
    const head=document.createElement('div');head.className='person-card-head';head.setAttribute('aria-hidden','true');
    const body=document.createElement('div');body.className='person-card-body';
    const examplePortrait=!person.photo?(EXAMPLE_PORTRAITS[person.id]||''):'';
    const photoSource=person.photo||(examplePortrait?'./assets/equipe-ficticia.png':'');
    const avatar=document.createElement('span');avatar.className=`person-avatar${photoSource?' has-photo':''}`;
    if(photoSource){const photo=document.createElement('img');photo.src=photoSource;photo.alt='';photo.loading='lazy';if(examplePortrait)photo.className=`example-portrait portrait-${examplePortrait}`;avatar.append(photo);}else avatar.append(document.createTextNode(initials(person.name)));
    const avatarMark=document.createElement('i');avatarMark.className='person-avatar-mark';avatar.append(avatarMark);
    const main=document.createElement('div');main.className='person-main';
    const nameButton=document.createElement('button');nameButton.type='button';nameButton.className='person-name-button';nameButton.title='Editar pessoa';const name=document.createElement('strong');name.textContent=smartCase(person.name,true);nameButton.append(name);nameButton.addEventListener('click',()=>openEditor('person',person.id));
    const role=document.createElement('span');role.className='person-role';role.textContent=positionNameOf(person);
    const email=person.email&&EMAIL_PATTERN.test(person.email)?person.email:'';
    const contact=document.createElement(email?'a':'span');contact.className=`person-email${email?'':' is-missing'}`;const contactText=document.createElement('span');contactText.textContent=email||'E-mail não informado';contact.append(icon('mail'),contactText);
    if(email){contact.href=`mailto:${email}`;contact.title=`Enviar e-mail para ${smartCase(person.name,true)}`;}
    main.append(nameButton,role,contact);
    const actions=document.createElement('div');actions.className='person-actions';
    const nextLevel=Math.min(MAX_LEVEL,level+1);const suggestedPosition=state.positions.find(item=>item.level===nextLevel)?.id||'';
    const add=makeButton('','user-plus','person-action',()=>openEditor('person',null,{managerId:person.id,departmentId:person.departmentId,positionId:suggestedPosition,level:nextLevel}));add.setAttribute('aria-label',`Incluir liderado de ${smartCase(person.name,true)}`);add.title='Incluir liderado';
    const remove=makeButton('','trash','person-action person-action-danger',()=>requestDeleteOf('person',person.id));remove.setAttribute('aria-label',`Excluir ${smartCase(person.name,true)}`);remove.title='Excluir pessoa';
    actions.append(add,remove);body.append(avatar,main,actions);
    const footer=document.createElement('div');footer.className='person-card-footer';
    const birthday=document.createElement('span');birthday.className='person-birthday';birthday.append(icon('cake'),document.createTextNode(person.birthday||'Não informado'));
    const isCollapsed=collapsedLeaders.has(person.id)&&!normalizedQuery();
    const team=document.createElement(teamSize?'button':'span');team.className=`person-team${teamSize?' team-toggle':''}`;
    if(teamSize){team.type='button';team.dataset.personId=person.id;team.dataset.count=String(teamSize);card.classList.add('has-team');team.setAttribute('aria-expanded',String(!isCollapsed));team.setAttribute('aria-controls',level===0?'departmentGrid':`team-${person.id}`);team.title=isCollapsed?'Expandir liderados':'Recolher liderados';team.setAttribute('aria-label',`${isCollapsed?'Expandir':'Recolher'} ${teamSize} ${teamSize===1?'liderado':'liderados'} de ${smartCase(person.name,true)}`);const teamLabel=document.createElement('span');teamLabel.className='team-label';teamLabel.textContent=`${teamSize} ${teamSize===1?'liderado':'liderados'}`;const knob=document.createElement('span');knob.className='team-knob';knob.setAttribute('aria-hidden','true');knob.append(document.createElement('i'),document.createElement('i'));team.append(icon('users'),teamLabel,knob);team.addEventListener('click',event=>{event.stopPropagation();toggleLeader(person.id);});}
    else team.append(icon('users'),document.createTextNode('Sem liderados'));
    footer.append(birthday,team);card.append(head,body,footer);
    if(normalizedQuery()&&individualMatches(person,department))card.classList.add('match');return card;
  }

  function makeField(labelText,control,helpText=''){
    const field=document.createElement('div'); field.className='field'; const label=document.createElement('label'); const id=`field-${control.name}`; control.id=id; label.htmlFor=id; label.textContent=labelText; field.append(label,control); if(helpText){const help=document.createElement('small');help.textContent=helpText;field.append(help);} return field;
  }
  function textInput(name,value='',required=true,maxLength=160){const input=document.createElement('input');input.name=name;input.value=value;input.required=required;input.maxLength=maxLength;return input;}
  function selectInput(name,options,value=''){const select=document.createElement('select');select.name=name;options.forEach(([optionValue,label])=>{const option=document.createElement('option');option.value=optionValue;option.textContent=label;option.selected=String(optionValue)===String(value);select.append(option);});return select;}
  async function resizePhoto(file){
    if(!/^image\/(?:jpeg|png|webp)$/i.test(file?.type||''))throw new Error('Use uma imagem JPG, PNG ou WebP.');
    if(file.size>5_000_000)throw new Error('A foto deve ter no máximo 5 MB.');
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();image.decoding='async';image.src=url;await image.decode();
      const size=320,source=Math.min(image.naturalWidth,image.naturalHeight),sx=(image.naturalWidth-source)/2,sy=(image.naturalHeight-source)/2;
      const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
      canvas.getContext('2d',{alpha:false}).drawImage(image,sx,sy,source,source,0,0,size,size);
      const photo=canvas.toDataURL('image/jpeg',.82);
      if(!cleanPhoto(photo))throw new Error('Não foi possível preparar esta foto.');
      return photo;
    }finally{URL.revokeObjectURL(url);}
  }
  function photoEditor(person){
    pendingEditorPhoto=cleanPhoto(person.photo);
    const field=document.createElement('div');field.className='field photo-field';
    const title=document.createElement('span');title.className='field-label';title.textContent='Foto do colaborador';
    const row=document.createElement('div');row.className='photo-editor';
    const preview=document.createElement('span');preview.className='photo-preview';
    const renderPreview=()=>{preview.replaceChildren();if(pendingEditorPhoto){const image=document.createElement('img');image.src=pendingEditorPhoto;image.alt='Prévia da foto';preview.append(image);}else preview.textContent=initials(person.name||'Nova pessoa');};renderPreview();
    const controls=document.createElement('div');controls.className='photo-controls';
    const input=document.createElement('input');input.type='file';input.id='field-photo';input.name='photo';input.accept='image/jpeg,image/png,image/webp';input.className='sr-only';
    const choose=document.createElement('label');choose.className='btn btn-ghost';choose.htmlFor=input.id;choose.textContent='Selecionar foto';
    const remove=document.createElement('button');remove.type='button';remove.className='btn btn-ghost';remove.textContent='Remover';remove.hidden=!pendingEditorPhoto;
    const help=document.createElement('small');help.textContent='JPG, PNG ou WebP de até 5 MB. A imagem é recortada e salva somente neste navegador.';
    input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;const submit=$('#editorForm button[type="submit"]');submit.disabled=true;choose.textContent='Preparando foto…';try{pendingEditorPhoto=await resizePhoto(file);renderPreview();remove.hidden=false;}catch(error){showToast(error.message);input.value='';}finally{submit.disabled=false;choose.textContent='Selecionar foto';}});
    remove.addEventListener('click',()=>{pendingEditorPhoto='';input.value='';remove.hidden=true;renderPreview();});
    controls.append(input,choose,remove,help);row.append(preview,controls);field.append(title,row);return field;
  }
  function openEditor(type,id=null,seed=null){
    lastFocused=document.activeElement; editorContext={type,id}; const fields=$('#editorFields'); fields.replaceChildren(); const isNew=!id; $('#deleteButton').hidden=isNew; const dialog=$('#editorDialog');
    if(type==='department'){
      const item=id?departmentById(id):{name:'',description:'',color:'#C9A06A'}; $('#editorTitle').textContent=isNew?'Novo setor':'Editar setor'; $('#editorSubtitle').textContent='Defina o nome, a descrição e a cor de identificação.';
      fields.append(makeField('Nome do setor',textInput('name',item.name,true,100)));
      const description=document.createElement('textarea');description.name='description';description.value=item.description;description.maxLength=280;fields.append(makeField('Descrição',description,'Explique em uma frase a responsabilidade principal da área.'));
      const color=document.createElement('input');color.type='color';color.name='color';color.value=item.color;fields.append(makeField('Cor de identificação',color));
    } else if(type==='position'){
      const item=id?positionById(id):{name:'',description:'',level:TREE_LEVEL+1};$('#editorTitle').textContent=isNew?'Novo cargo':'Editar cargo';$('#editorSubtitle').textContent='Cadastre o título, a descrição e o nível padrão do cargo.';
      fields.append(makeField('Nome do cargo',textInput('name',item.name,true,120)));
      const description=document.createElement('textarea');description.name='description';description.value=item.description||'';description.maxLength=280;fields.append(makeField('Descrição',description,'Resuma as responsabilidades ou o escopo deste cargo.'));
      fields.append(makeField('Nível padrão',selectInput('level',LEVELS.map((level,index)=>[String(index),`${index+1}. ${level.name}`]),String(item.level)),'Usado como sugestão ao vincular o cargo a uma pessoa.'));
    } else {
      const fallback=state.departments.find(item=>item.id!=='diretoria')?.id||state.departments[0]?.id||'';
      const defaultPosition=state.positions.find(position=>position.level===TREE_LEVEL+1)?.id||state.positions[0]?.id||'';
      const item=id?hydratePersonContact(state.people.find(person=>person.id===id)):{name:'',email:'',photo:'',birthday:'',departmentId:fallback,positionId:defaultPosition,level:TREE_LEVEL+1,orgGroup:'',managerId:'',...(seed||{})};
      $('#editorTitle').textContent=isNew?'Nova pessoa':'Editar pessoa';
      const seedManager=isNew&&item.managerId?state.people.find(person=>person.id===item.managerId):null;
      $('#editorSubtitle').textContent=seedManager?`Novo liderado de ${smartCase(seedManager.name,true)}.`:'Defina o cargo, o setor, o nível e a quem esta pessoa se reporta.';
      fields.append(makeField('Nome completo',textInput('name',item.name,true,220)));
      fields.append(photoEditor(item));
      const email=textInput('email','',false,254);email.type='email';email.value=item.email||'';email.autocomplete='email';email.placeholder='nome@empresa.com';
      fields.append(makeField('E-mail corporativo',email,'Será exibido no card como atalho para contato.'));
      const row=document.createElement('div');row.className='field-row';
      const birthday=textInput('birthday',item.birthday,false,5);birthday.placeholder='dd/mm';birthday.inputMode='numeric';birthday.pattern='^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])$';
      const departments=state.departments.slice().sort((a,b)=>a.order-b.order).map(department=>[department.id,department.name]);
      row.append(makeField('Aniversário',birthday,'Use o formato dd/mm.'),makeField('Setor',selectInput('departmentId',departments,item.departmentId)));
      fields.append(row);
      const positionOptions=[['','Selecione um cargo'],...state.positions.slice().sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name,'pt-BR')).map(position=>[position.id,position.name])];
      const positionSelect=selectInput('positionId',positionOptions,item.positionId||'');positionSelect.required=true;
      const levelSelect=selectInput('level',LEVELS.map((level,index)=>[String(index),`${index+1}. ${level.name}`]),String(levelOf(item)));
      positionSelect.addEventListener('change',()=>{const selected=positionById(positionSelect.value);if(selected)levelSelect.value=String(selected.level);});
      const roleRow=document.createElement('div');roleRow.className='field-row';roleRow.append(makeField('Cargo',positionSelect,'Escolha um cargo do catálogo.'),makeField('Nível no organograma',levelSelect,'Define a posição visual na hierarquia.'));fields.append(roleRow);
      fields.append(makeField('Núcleo ou equipe',textInput('orgGroup',item.orgGroup||'',false,120),'Campo opcional para identificar uma equipe interna.'));
      const managerOptions=[['','Sem responsável · topo da estrutura'],...state.people.filter(person=>person.id!==id).sort((a,b)=>smartCase(a.name,true).localeCompare(smartCase(b.name,true),'pt-BR')).map(person=>[person.id,smartCase(person.name,true)])];
      fields.append(makeField('Reporta-se a',selectInput('managerId',managerOptions,item.managerId||''),'Quem esta pessoa tem como responsável.'));
    }
    dialog.showModal(); requestAnimationFrame(()=>fields.querySelector('input,select,textarea')?.focus());
  }
  function closeEditor(){ $('#editorDialog').close(); lastFocused?.focus?.(); }
  function saveEditor(event){
    event.preventDefault(); const form=new FormData(event.currentTarget); const {type,id}=editorContext;
    if(type==='department'){
      const name=cleanText(form.get('name'),100),description=cleanText(form.get('description'),280),color=cleanText(form.get('color'),7); if(!name)return;
      commit(()=>{if(id){Object.assign(departmentById(id),{name,description,color});}else{state.departments.push({id:uid('department'),name,description,color,parentId:'',order:state.departments.length,collapsed:false});}},id?'Setor atualizado.':'Setor incluído.');
    } else if(type==='position'){
      const name=cleanText(form.get('name'),120),description=cleanText(form.get('description'),280),chosen=Number.parseInt(cleanText(form.get('level'),2),10);if(!name)return;
      const level=Number.isInteger(chosen)?Math.max(0,Math.min(MAX_LEVEL,chosen)):TREE_LEVEL+1;
      commit(()=>{if(id){Object.assign(positionById(id),{name,description,level});}else{state.positions.push({id:uid('position'),name,description,level,order:state.positions.length});}},id?'Cargo atualizado.':'Cargo incluído.');
    } else {
      const name=cleanText(form.get('name'),220),email=cleanEmail(form.get('email')),birthday=cleanText(form.get('birthday'),5),departmentId=cleanText(form.get('departmentId'),100),positionId=cleanText(form.get('positionId'),100),orgGroup=cleanText(form.get('orgGroup'),120),managerId=cleanText(form.get('managerId'),100);
      const chosen=Number.parseInt(cleanText(form.get('level'),2),10);
      const level=Number.isInteger(chosen)?Math.max(0,Math.min(MAX_LEVEL,chosen)):TREE_LEVEL+1;
      if(!name||!departmentById(departmentId)||!positionById(positionId))return;
      if(email&&!EMAIL_PATTERN.test(email)){showToast('Informe um e-mail válido.');return;}
      if(id&&wouldCreateCycle(id,managerId)){showToast('Esse vínculo criaria um ciclo de subordinação. Escolha outro responsável.');return;}
      const photo=cleanPhoto(pendingEditorPhoto);
      commit(()=>{if(id){Object.assign(state.people.find(person=>person.id===id),{name,email,photo,birthday,departmentId,positionId,level,orgGroup,managerId});}else{state.people.push({id:uid('person'),name,email,photo,birthday,departmentId,positionId,level,orgGroup,managerId,layoutOrder:state.people.length});}},id?'Pessoa atualizada.':'Pessoa incluída.');
    }
    closeEditor();
  }
  function wouldCreateCycle(personId,managerId){let current=managerId;const seen=new Set([personId]);while(current){if(seen.has(current))return true;seen.add(current);current=state.people.find(person=>person.id===current)?.managerId||'';}return false;}
  function deleteMessage(type,id){
    if(type==='department'){const people=state.people.filter(person=>person.departmentId===id);return `Excluir este setor também removerá ${people.length} pessoa(s). Esta ação pode ser desfeita.`;}
    if(type==='position'){const people=state.people.filter(person=>person.positionId===id);return `Excluir este cargo deixará ${people.length} pessoa(s) sem cargo. Esta ação pode ser desfeita.`;}
    const person=state.people.find(item=>item.id===id);
    const team=state.people.filter(item=>item.managerId===id);
    const manager=person?.managerId?state.people.find(item=>item.id===person.managerId):null;
    const destino=team.length?` ${team.length} liderado(s) passam a responder ${manager?`a ${smartCase(manager.name,true)}`:'direto ao topo'}.`:'';
    return `Excluir ${person?smartCase(person.name,true):'esta pessoa'} do organograma?${destino} Esta ação pode ser desfeita.`;
  }
  function requestDeleteOf(type,id,afterwards){
    askConfirm(deleteMessage(type,id),()=>{applyDelete(type,id);if(afterwards)afterwards();});
  }
  function requestDelete(){
    const {type,id}=editorContext;
    requestDeleteOf(type,id,closeEditor);
  }
  function applyDelete(type,id){
    commit(()=>{
      let removedIds=new Set();
      if(type==='department'){removedIds=new Set(state.people.filter(person=>person.departmentId===id).map(person=>person.id));state.departments=state.departments.filter(item=>item.id!==id);if(activeDepartment===id)activeDepartment='all';}
      else if(type==='position'){state.positions=state.positions.filter(item=>item.id!==id);state.people.forEach(person=>{if(person.positionId===id)person.positionId='';});}
      else removedIds.add(id);
      const peopleById=new Map(state.people.map(person=>[person.id,person]));
      state.people.forEach(person=>{if(removedIds.has(person.id)||!removedIds.has(person.managerId))return;let next=peopleById.get(person.managerId)?.managerId||'';const seen=new Set();while(next&&removedIds.has(next)&&!seen.has(next)){seen.add(next);next=peopleById.get(next)?.managerId||'';}person.managerId=next&&!removedIds.has(next)?next:'';});
      state.people=state.people.filter(person=>!removedIds.has(person.id));
    },'Item excluído.');
  }
  function askConfirm(message,action,title='Confirmar ação'){$('#confirmTitle').textContent=title;$('#confirmMessage').textContent=message;pendingConfirm=action;$('#confirmDialog').showModal();}

  const CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n+=1){let value=n;for(let bit=0;bit<8;bit+=1)value=value&1?0xEDB88320^(value>>>1):value>>>1;table[n]=value>>>0;}return table;})();
  function crc32(bytes){let value=0xFFFFFFFF;for(const byte of bytes)value=CRC_TABLE[(value^byte)&0xFF]^(value>>>8);return (value^0xFFFFFFFF)>>>0;}
  function joinBytes(parts){const size=parts.reduce((sum,part)=>sum+part.length,0);const result=new Uint8Array(size);let offset=0;parts.forEach(part=>{result.set(part,offset);offset+=part.length;});return result;}
  function zipStored(entries){
    const encoder=new TextEncoder(),locals=[],centrals=[];let offset=0;
    Object.entries(entries).forEach(([name,content])=>{const nameBytes=encoder.encode(name),data=typeof content==='string'?encoder.encode(content):content,crc=crc32(data);const local=new Uint8Array(30),lv=new DataView(local.buffer);lv.setUint32(0,0x04034B50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);lv.setUint32(14,crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,nameBytes.length,true);const central=new Uint8Array(46),cv=new DataView(central.buffer);cv.setUint32(0,0x02014B50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,nameBytes.length,true);cv.setUint32(42,offset,true);locals.push(local,nameBytes,data);centrals.push(central,nameBytes);offset+=local.length+nameBytes.length+data.length;});
    const centralData=joinBytes(centrals),end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054B50,true);view.setUint16(8,Object.keys(entries).length,true);view.setUint16(10,Object.keys(entries).length,true);view.setUint32(12,centralData.length,true);view.setUint32(16,offset,true);return joinBytes([...locals,centralData,end]);
  }
  function xmlText(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
  function excelColumn(index){let result='';for(let value=index+1;value;value=Math.floor((value-1)/26))result=String.fromCharCode(65+(value-1)%26)+result;return result;}
  function spreadsheetRows(){
    const header=['Código','ID Pessoa','Nome','E-mail','Aniversário','Setor','Cargo','ID Cargo','Nível (1 a 6)','Núcleo ou equipe','Reporta-se a','ID Gestor','Ordem'];
    const rows=state.people.slice().sort((a,b)=>{const departmentA=departmentById(a.departmentId),departmentB=departmentById(b.departmentId);return (departmentA?.order||0)-(departmentB?.order||0)||levelOf(a)-levelOf(b)||a.layoutOrder-b.layoutOrder;}).map(person=>{const department=departmentById(person.departmentId),position=positionFor(person),manager=state.people.find(item=>item.id===person.managerId);return[codeOf(person),person.id,person.name,person.email||'',person.birthday,department?.name||'',position?.name||'',person.positionId||'',levelOf(person)+1,person.orgGroup||'',manager?.name||'',person.managerId||'',person.layoutOrder];});
    return [header,...rows];
  }
  function buildSpreadsheet(){
    const rows=spreadsheetRows(),lastCell=`${excelColumn(rows[0].length-1)}${rows.length}`,widths=[14,38,38,38,14,26,28,38,18,28,38,38,12];const rowXml=rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((value,columnIndex)=>{const ref=`${excelColumn(columnIndex)}${rowIndex+1}`;return typeof value==='number'?`<c r="${ref}"${rowIndex===0?' s="1"':''}><v>${value}</v></c>`:`<c r="${ref}" t="inlineStr"${rowIndex===0?' s="1"':''}><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;}).join('')}</row>`).join('');
    const worksheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((width,index)=>`<col min="${index+1}" max="${index+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rowXml}</sheetData><autoFilter ref="A1:${lastCell}"/></worksheet>`;
    const now=new Date().toISOString();return zipStored({
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
      'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Organograma" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF8A6038"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>',
      'xl/worksheets/sheet1.xml':worksheet,
      'docProps/core.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Organograma editável</dc:title><dc:creator>Editor de organogramas</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`,
      'docProps/app.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Editor de Organogramas</Application></Properties>'
    });
  }
  function downloadFile(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportSpreadsheet(){const bytes=buildSpreadsheet();downloadFile(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`organograma-${new Date().toISOString().slice(0,10)}.xlsx`);showToast('Planilha Excel exportada.');}
  async function unzipSpreadsheet(buffer){
    const bytes=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;for(let index=bytes.length-22;index>=Math.max(0,bytes.length-65557);index-=1){if(view.getUint32(index,true)===0x06054B50){end=index;break;}}if(end<0)throw new Error('O arquivo não é uma planilha XLSX válida.');const count=view.getUint16(end+10,true),centralOffset=view.getUint32(end+16,true);if(count>1000)throw new Error('A planilha possui arquivos internos demais.');let position=centralOffset,total=0;const entries=new Map(),decoder=new TextDecoder();
    for(let entryIndex=0;entryIndex<count;entryIndex+=1){if(view.getUint32(position,true)!==0x02014B50)throw new Error('A estrutura interna da planilha está corrompida.');const flags=view.getUint16(position+8,true),method=view.getUint16(position+10,true),compressedSize=view.getUint32(position+20,true),size=view.getUint32(position+24,true),nameLength=view.getUint16(position+28,true),extraLength=view.getUint16(position+30,true),commentLength=view.getUint16(position+32,true),localOffset=view.getUint32(position+42,true);if(flags&1)throw new Error('Planilhas protegidas por senha não são aceitas.');if(size>20_000_000||total+size>30_000_000)throw new Error('O conteúdo descompactado excede o limite permitido.');const name=decoder.decode(bytes.slice(position+46,position+46+nameLength)).replace(/^\//,'');if(view.getUint32(localOffset,true)!==0x04034B50)throw new Error('A planilha contém uma entrada inválida.');const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true),start=localOffset+30+localNameLength+localExtraLength,compressed=bytes.slice(start,start+compressedSize);let data;if(method===0)data=compressed;else if(method===8){if(typeof DecompressionStream==='undefined')throw new Error('Este navegador não consegue descompactar XLSX.');const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));data=new Uint8Array(await new Response(stream).arrayBuffer());}else throw new Error('A planilha usa uma compactação não suportada.');if(data.length>20_000_000)throw new Error('Uma parte da planilha excede o limite permitido.');total+=data.length;entries.set(name,data);position+=46+nameLength+extraLength+commentLength;}
    return entries;
  }
  function parseSpreadsheet(entries){
    const decoder=new TextDecoder(),parser=new DOMParser(),readXml=name=>{const data=entries.get(name);if(!data)return null;const documentXml=parser.parseFromString(decoder.decode(data),'application/xml');if(documentXml.querySelector('parsererror'))throw new Error('A planilha contém XML inválido.');return documentXml;};const sharedDocument=readXml('xl/sharedStrings.xml'),shared=sharedDocument?[...sharedDocument.querySelectorAll('si')].map(item=>item.textContent):[];let sheetName=[...entries.keys()].find(name=>/^xl\/worksheets\/[^/]+\.xml$/i.test(name));const workbook=readXml('xl/workbook.xml'),relations=readXml('xl/_rels/workbook.xml.rels');if(workbook&&relations){const relationId=workbook.querySelector('sheet')?.getAttribute('r:id'),target=[...relations.querySelectorAll('Relationship')].find(item=>item.getAttribute('Id')===relationId)?.getAttribute('Target');if(target)sheetName=(target.startsWith('/')?target.slice(1):`xl/${target}`).replace(/\/\.\//g,'/');}const sheet=readXml(sheetName);if(!sheet)throw new Error('Nenhuma aba de dados foi encontrada.');const rows=[];sheet.querySelectorAll('sheetData > row').forEach(row=>{const values=[];row.querySelectorAll('c').forEach(cell=>{const reference=cell.getAttribute('r')||'',letters=(reference.match(/[A-Z]+/i)||['A'])[0].toUpperCase();let column=0;for(const letter of letters)column=column*26+letter.charCodeAt(0)-64;column-=1;const type=cell.getAttribute('t'),raw=type==='inlineStr'?cell.querySelector('is')?.textContent??'':cell.querySelector('v')?.textContent??'';values[column]=type==='s'?shared[Number(raw)]??'':raw;});rows.push(values);});if(!rows.length)throw new Error('A aba da planilha está vazia.');return rows;
  }
  function birthdayFromSpreadsheet(value){const text=cleanText(value,30);if(/^\d+(\.\d+)?$/.test(text)&&Number(text)>1000){const date=new Date(Date.UTC(1899,11,30)+Math.floor(Number(text))*86400000);return `${String(date.getUTCDate()).padStart(2,'0')}/${String(date.getUTCMonth()+1).padStart(2,'0')}`;}return cleanText(text,10);}
  function mergeSpreadsheet(rows){
    const headers=rows[0].map(value=>strip(value).replace(/[^a-z0-9]+/g,' ').trim());
    const column=(...names)=>headers.findIndex(header=>names.some(name=>header.startsWith(name)));
    const nameColumn=column('nome','funcionario','colaborador'),emailColumn=column('e mail','email'),birthdayColumn=column('aniversario'),departmentColumn=column('setor','area'),positionColumn=column('cargo','funcao','posicao'),positionIdColumn=column('id cargo'),levelColumn=column('nivel'),groupColumn=column('nucleo','equipe'),managerColumn=column('reporta se a','gestor','responsavel'),managerIdColumn=column('id gestor'),idColumn=column('id pessoa'),orderColumn=column('ordem');
    if(nameColumn<0||departmentColumn<0)throw new Error('A planilha precisa das colunas Nome e Setor.');
    const candidate=normalizeState(JSON.parse(JSON.stringify(state))),pending=[];let processed=0;
    rows.slice(1).forEach((row,rowIndex)=>{
      const name=cleanText(row[nameColumn],220),departmentName=cleanText(row[departmentColumn],100);
      if(!name&&!departmentName)return;
      if(!name||!departmentName)throw new Error(`A linha ${rowIndex+2} está incompleta.`);
      const wantedId=sectorId(departmentName);
      let department=candidate.departments.find(item=>item.id===wantedId||strip(item.name)===strip(departmentName));
      if(!department){let id=wantedId||uid('department');while(candidate.departments.some(item=>item.id===id))id=uid('department');department={id,name:departmentName,description:'Área importada da planilha.',color:['#9A6A3D','#4A3AA7','#1F5185','#A8305F'][candidate.departments.length%4],parentId:'',order:candidate.departments.length,collapsed:false};candidate.departments.push(department);}
      const rawLevel=levelColumn>=0?Number.parseInt(row[levelColumn],10):NaN;
      let level=Number.isInteger(rawLevel)?Math.max(0,Math.min(MAX_LEVEL,rawLevel-1)):TREE_LEVEL+1;
      const suppliedPositionId=positionIdColumn>=0?cleanText(row[positionIdColumn],100):'';
      const positionName=positionColumn>=0?cleanText(row[positionColumn],120):'';
      let position=(suppliedPositionId&&candidate.positions.find(item=>item.id===suppliedPositionId))||(positionName&&candidate.positions.find(item=>strip(item.name)===strip(positionName)));
      if(!position&&positionName){let id=suppliedPositionId||sectorId(`cargo-${positionName}`);while(candidate.positions.some(item=>item.id===id))id=uid('position');position={id,name:positionName,description:'Cargo importado da planilha.',level,order:candidate.positions.length};candidate.positions.push(position);}
      if(!position)position=candidate.positions.find(item=>item.level===level)||candidate.positions[0];
      if(!Number.isInteger(rawLevel)&&position)level=position.level;
      const suppliedId=idColumn>=0?cleanText(row[idColumn],100):'';
      let person=(suppliedId&&candidate.people.find(item=>item.id===suppliedId))||candidate.people.find(item=>strip(item.name)===strip(name));
      if(!person){person={id:suppliedId&&!candidate.people.some(item=>item.id===suppliedId)?suppliedId:uid('person'),name,email:'',photo:'',birthday:'',departmentId:department.id,positionId:position?.id||'',level,managerId:'',orgGroup:'',layoutOrder:candidate.people.length};candidate.people.push(person);}
      person.name=name;person.departmentId=department.id;person.positionId=position?.id||'';person.level=level;
      if(emailColumn>=0){const email=cleanEmail(row[emailColumn]);if(email&&!EMAIL_PATTERN.test(email))throw new Error(`O e-mail de ${name} é inválido.`);person.email=email;}
      if(birthdayColumn>=0)person.birthday=birthdayFromSpreadsheet(row[birthdayColumn]);
      if(groupColumn>=0)person.orgGroup=cleanText(row[groupColumn],120);
      if(orderColumn>=0){const order=Number.parseInt(row[orderColumn],10);if(Number.isInteger(order))person.layoutOrder=order;}
      const managerId=managerIdColumn>=0?cleanText(row[managerIdColumn],100):'';
      const managerName=managerColumn>=0?cleanText(row[managerColumn],220):'';
      pending.push({person,managerId,managerName});
      processed+=1;
    });
    if(!processed)throw new Error('Nenhuma pessoa válida foi encontrada.');
    pending.forEach(item=>{
      if(!item.managerId&&!item.managerName){item.person.managerId='';return;}
      const manager=(item.managerId&&candidate.people.find(person=>person.id===item.managerId))||(item.managerName&&candidate.people.find(person=>strip(person.name)===strip(item.managerName)));
      if(!manager)throw new Error(`Responsável não encontrado para ${item.person.name}.`);
      item.person.managerId=manager.id;
    });
    const peopleById=new Map(candidate.people.map(person=>[person.id,person]));
    candidate.people.forEach(person=>{const seen=new Set([person.id]);let managerId=person.managerId;while(managerId){if(seen.has(managerId))throw new Error(`A planilha cria um ciclo de subordinação envolvendo ${person.name}.`);seen.add(managerId);managerId=peopleById.get(managerId)?.managerId||'';}});
    return {state:normalizeState(candidate),processed};
  }
  async function importSpreadsheet(file){if(!file)return;if(file.size>10_000_000){showToast('A planilha excede o limite de 10 MB.');return;}try{const entries=await unzipSpreadsheet(await file.arrayBuffer()),rows=parseSpreadsheet(entries),result=mergeSpreadsheet(rows);commit(()=>{state=result.state;activeDepartment='all';},`${result.processed} pessoa(s) importada(s) da planilha.`);}catch(error){showToast(`Não foi possível importar a planilha: ${error.message}`);}finally{$('#spreadsheetInput').value='';}}

  function restoreInitial(){askConfirm('Restaurar os exemplos iniciais? As alterações atuais poderão ser recuperadas apenas com “Desfazer” ou por um backup exportado.',()=>{commit(()=>{state=buildExampleState();activeDepartment='all';searchTerm='';$('#searchInput').value='';},'Exemplos iniciais restaurados.');collectMatches();},'Restaurar exemplos');}

  $('#searchInput').addEventListener('input',event=>{
    const value=event.target.value;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>runSearch(value),140);
  });
  $('#searchInput').addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();clearSearch();return;}
    if(event.key==='Enter'){event.preventDefault();goToMatch(searchIndex+(event.shiftKey?-1:1));}
  });
  $('#searchPrev').addEventListener('click',()=>goToMatch(searchIndex-1));
  $('#searchNext').addEventListener('click',()=>goToMatch(searchIndex+1));
  $('#searchClear').addEventListener('click',clearSearch);
  /* Menus que abrem no toque: ações da barra, legenda e busca. */
  function setupToggle(botao,alvo,classe,aoAbrir){
    const gatilho=$(botao),elemento=$(alvo);
    if(!gatilho||!elemento)return;
    gatilho.addEventListener('click',event=>{
      event.stopPropagation();
      const abrindo=!elemento.classList.contains(classe);
      elemento.classList.toggle(classe,abrindo);
      gatilho.setAttribute('aria-expanded',String(abrindo));
      if(abrindo&&aoAbrir)aoAbrir();
    });
    return {gatilho,elemento};
  }
  /* Em telas estreitas o painel abre ancorado ao botão e podia sair da tela: empurra de volta para dentro. */
  function manterNaTela(painel){
    if(!painel)return;
    painel.style.transform='';painel.style.maxHeight='';painel.style.overflowY='';
    if(painel.getBoundingClientRect().bottom>window.innerHeight-12){
      painel.style.maxHeight=`${Math.max(160,Math.floor(window.innerHeight-painel.getBoundingClientRect().top-12))}px`;painel.style.overflowY='auto';
    }
    const caixa=painel.getBoundingClientRect(),margem=12;
    let deslocamento=0;
    if(caixa.left<margem)deslocamento=margem-caixa.left;
    else if(caixa.right>window.innerWidth-margem)deslocamento=window.innerWidth-margem-caixa.right;
    if(deslocamento)painel.style.transform=`translateX(${Math.round(deslocamento)}px)`;
  }
  const menuAcoes=setupToggle('#actionsToggle','#toolbarMenu','is-open',()=>manterNaTela($('#actionsPanel')));
  window.addEventListener('resize',()=>{if($('#toolbarMenu').classList.contains('is-open'))manterNaTela($('#actionsPanel'));});
  setupToggle('#legendToggle','.chart-hint','is-open');
  setupToggle('#searchToggle','#globalSearch','is-open',()=>$('#searchInput').focus());
  /* Clicar fora ou apertar Esc fecha o menu de ações. */
  const fecharMenu=()=>{
    if(!menuAcoes||!menuAcoes.elemento.classList.contains('is-open'))return;
    menuAcoes.elemento.classList.remove('is-open');
    menuAcoes.gatilho.setAttribute('aria-expanded','false');
  };
  document.addEventListener('click',event=>{if(!event.target.closest('#toolbarMenu'))fecharMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')fecharMenu();});
  $('#actionsPanel').addEventListener('click',event=>{if(event.target.closest('button'))fecharMenu();});
  $('#aboutButton').addEventListener('click',()=>$('#aboutDialog').showModal());
  $('#themeButton').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem(THEME_KEY,next);}catch(error){}});
  function quickAddPerson(){if(!state.departments.length){showToast('Inclua um setor antes de adicionar pessoas.');return;}if(!state.positions.length){showToast('Inclua um cargo antes de adicionar pessoas.');return;}openEditor('person');}
  $('#quickAddPerson').addEventListener('click',quickAddPerson);
  $('#addDepartmentButton').addEventListener('click',openDepartmentCatalog);$('#addDepartmentInnerButton').addEventListener('click',()=>{$('#departmentsDialog').close();openEditor('department');});
  $('#positionsButton').addEventListener('click',openPositionCatalog);$('#addPositionButton').addEventListener('click',()=>{$('#positionsDialog').close();openEditor('position');});
  $('#undoButton').addEventListener('click',undo); $('#redoButton').addEventListener('click',redo); $('#detailViewButton').addEventListener('click',()=>{viewMode='people';render();}); $('#roleViewButton').addEventListener('click',()=>{viewMode='roles';render();});
  $('#exportSpreadsheetButton').addEventListener('click',exportSpreadsheet); $('#importSpreadsheetButton').addEventListener('click',()=>$('#spreadsheetInput').click()); $('#spreadsheetInput').addEventListener('change',event=>importSpreadsheet(event.target.files[0]));
  $('#printButton').addEventListener('click',()=>window.print()); $('#resetButton').addEventListener('click',restoreInitial);
  $('#editorForm').addEventListener('submit',saveEditor); $('#closeEditorButton').addEventListener('click',closeEditor); $('#cancelEditorButton').addEventListener('click',closeEditor); $('#deleteButton').addEventListener('click',requestDelete);
  $('#editorDialog').addEventListener('close',()=>lastFocused?.focus?.()); $('#confirmDialog').addEventListener('close',event=>{if(event.target.returnValue==='confirm'&&pendingConfirm)pendingConfirm();pendingConfirm=null;});
  document.addEventListener('keydown',event=>{
    const digitando=/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName);
    if(!digitando&&!$('#editorDialog').open&&(event.key==='/'||((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'))){
      event.preventDefault();$('#searchInput').focus();$('#searchInput').select();
    }
  });
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!$('#editorDialog').open){event.preventDefault();event.shiftKey?redo():undo();}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'&&!$('#editorDialog').open){event.preventDefault();redo();}});
  try{document.documentElement.dataset.theme=localStorage.getItem(THEME_KEY)||'light';}catch(error){}
  (function enablePanning(){
    const canvas=$('#chartCanvas');if(!canvas)return;
    const interactive='button,a,input,select,textarea,summary,label';
    let active=false,moved=false,pointer=null,startX=0,startY=0,originX=0,originY=0;
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.pointerType!=='mouse')return;
      if(event.target.closest?.(interactive))return;
      active=true;moved=false;pointer=event.pointerId;
      startX=event.clientX;startY=event.clientY;originX=canvas.scrollLeft;originY=canvas.scrollTop;
    });
    canvas.addEventListener('pointermove',event=>{
      if(!active||event.pointerId!==pointer)return;
      const deltaX=event.clientX-startX,deltaY=event.clientY-startY;
      if(!moved){
        if(Math.abs(deltaX)<4&&Math.abs(deltaY)<4)return;
        moved=true;canvas.classList.add('is-panning');
        try{canvas.setPointerCapture(pointer);}catch(error){}
      }
      canvas.scrollLeft=originX-deltaX;canvas.scrollTop=originY-deltaY;
      event.preventDefault();
    });
    const release=()=>{
      if(!active)return;
      if(moved){try{canvas.releasePointerCapture(pointer);}catch(error){}panSuppressesClick=true;setTimeout(()=>{panSuppressesClick=false;},0);}
      active=false;moved=false;pointer=null;canvas.classList.remove('is-panning');
    };
    canvas.addEventListener('pointerup',release);
    canvas.addEventListener('pointercancel',release);
    canvas.addEventListener('click',event=>{if(panSuppressesClick){event.stopPropagation();event.preventDefault();}},true);
    canvas.addEventListener('dragstart',event=>{if(moved)event.preventDefault();});
    canvas.addEventListener('keydown',event=>{
      if(event.target!==canvas)return;
      if(event.key==='Home'){event.preventDefault();scrollCanvas(0,0);return;}
      const step=event.shiftKey?320:90;
      const moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
      const move=moves[event.key];if(!move)return;
      event.preventDefault();canvas.scrollBy({left:move[0],top:move[1],behavior:'smooth'});
    });
  })();
  $('#focusStartButton').addEventListener('click',()=>{scrollToStart();$('#chartCanvas').focus({preventScroll:true});});
  $('#horizontalViewButton')?.addEventListener('click',()=>setOrientation('horizontal'));
  $('#verticalViewButton')?.addEventListener('click',()=>setOrientation('vertical'));
  $('#zoomInButton').addEventListener('click',()=>setZoom(zoomLevel+0.1));
  $('#zoomOutButton').addEventListener('click',()=>setZoom(zoomLevel-0.1));
  $('#zoomFitButton').addEventListener('click',toggleFit);
  $('#chartCanvas').addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();setZoom(zoomLevel+(event.deltaY<0?0.1:-0.1));},{passive:false});
  $('#chartCanvas').addEventListener('pointerover',event=>{const card=event.target.closest?.('.person-card[data-id]');if(card){hoveredPersonId=card.dataset.id;highlightWires(card.dataset.id);}});
  $('#chartCanvas').addEventListener('pointerleave',()=>{hoveredPersonId='';highlightWires(searchLit);});
  $('#chartCanvas').addEventListener('focusin',event=>{const card=event.target.closest?.('.person-card[data-id]');if(card)highlightWires(card.dataset.id);});
  window.addEventListener('resize',scheduleWires);
  window.addEventListener('beforeprint',drawWires);
  document.fonts?.ready?.then(scheduleWires).catch(()=>{});
  if(window.ResizeObserver){const observer=new ResizeObserver(scheduleWires);observer.observe($('#chartCanvas'));observer.observe($('#departmentGrid'));observer.observe($('#leadershipTree'));}
  renderLevelLegend(); render(); if(storageWarning)showToast(storageWarning);
