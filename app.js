(function(){
  const CAT_COLORS={Matkassar:'#4ade80',AI:'#60a5fa',Lokalt:'#f472b6','Övrigt':'#a1a1aa'};
  const CAT_ORDER=['Matkassar','AI','Lokalt','Övrigt'];
  const catSort=(a,b)=>{const i=CAT_ORDER.indexOf(a),j=CAT_ORDER.indexOf(b);return (i<0?99:i)-(j<0?99:j)||a.localeCompare(b,'sv')};
  const state={all:[],cat:'Alla',q:'',key:'first_seen',dir:-1};
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=s=>{const d=new Date(s);return isNaN(d)?null:d.toISOString().slice(0,10)};
  const now=Date.now();
  const isNew=o=>{const d=new Date(o.first_seen);return !isNaN(d)&&(now-d)<7*864e5};
  const hasCode=o=>o.code&&String(o.code).trim()&&!/^(-|ingen|none|n\/a|null)$/i.test(String(o.code).trim());

  const CATCH_RULES=[
    ['Kort/betaluppgifter krävs',/kort krävs|ev\.? kort|kortuppgift|betalkort|kreditkort|betaluppgift|card required|payment/i],
    ['Bindningstid',t=>/bindning|binding|bindande/i.test(t)&&!/ingen bindning|utan bindning|no commitment/i.test(t)],
    ['Endast nya kunder',/ny(a)? (kund|medlem)|new (customer|user)|aldrig haft|ej om (tidigare|du haft|provträning)|inte om du haft|tidigare .*provperiod|1 per hushåll/i],
    ['Förnyas automatiskt',/auto-?förny|förnyas|auto-renew|övergår/i],
    ['Begränsad tid',/t\.?o\.?m\.?|gäller \d|kampanj|until|begränsad/i],
    ['Kostar efteråt',/sedan \d|därefter|kr\/mån|kr\/vecka|\/month/i],
    ['Kräver registrering',/registrer|anmälan krävs|teckna|reception/i],
    ['Avboka i tid',/avboka|avsluta|säg upp|ändra senast/i],
  ];
  function catchTypes(o){
    const t=String(o.catch||'');const out=[];
    CATCH_RULES.forEach(([n,re])=>{if(typeof re==='function'?re(t):re.test(t))out.push(n)});
    if(!out.length&&t.trim()&&!/^(ingen|inga|none|-|gratis\.?|fri entré.*)$/i.test(t.trim()))out.push('Annat');
    return out;
  }

  async function load(){
    const bust='?t='+Date.now();
    try{const r=await fetch('data/offers.json'+bust);state.all=r.ok?await r.json():[]}catch(e){state.all=[]}
    if(!Array.isArray(state.all))state.all=[];
    try{const m=await (await fetch('data/meta.json'+bust)).json();
      const d=new Date(m.updated);
      $('#updated').textContent=isNaN(d)?(m.updated||'–'):d.toLocaleString('sv-SE',{timeZone:'Europe/Stockholm',dateStyle:'medium',timeStyle:'short'});
    }catch(e){}
    stats();chips();charts();render();
  }

  function stats(){
    $('#statTotal').textContent=state.all.length;
    $('#statNew').textContent=state.all.filter(isNew).length;
    $('#statCodes').textContent=state.all.filter(hasCode).length;
  }

  function chips(){
    const counts={};state.all.forEach(o=>{const c=o.category||'Övrigt';counts[c]=(counts[c]||0)+1});
    const cats=['Alla',...Object.keys(counts).sort(catSort)];
    const nyCount=state.all.filter(isNew).length;
    cats.splice(1,0,'Nytt');
    $('#chips').innerHTML=cats.map(c=>{
      const n=c==='Alla'?state.all.length:c==='Nytt'?nyCount:counts[c];
      return `<button class="chip${c===state.cat?' on':''}" data-c="${esc(c)}">${esc(c)}<span class="c">${n}</span></button>`}).join('');
    $('#chips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;state.cat=b.dataset.c;chips();render()};
  }

  function charts(){
    if(!window.Chart){setTimeout(charts,200);return}
    Chart.defaults.color='#8b95a8';Chart.defaults.borderColor='#232c3d';
    Chart.defaults.font.family='system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    const counts={};state.all.forEach(o=>{const c=o.category||'Övrigt';counts[c]=(counts[c]||0)+1});
    const cl=Object.keys(counts).sort(catSort);
    new Chart($('#chartCat'),{type:'doughnut',data:{labels:cl,datasets:[{data:cl.map(c=>counts[c]),backgroundColor:cl.map(c=>CAT_COLORS[c]||'#f472b6'),borderColor:'#121826',borderWidth:3}]},
      options:{maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom'}}}});

    // per day, stacked by category, continuous date range
    const days=state.all.map(o=>day(o.first_seen)).filter(Boolean).sort();
    let labels=[];
    if(days.length){let d=new Date(days[0]);const end=new Date(Math.max(new Date(days[days.length-1]),new Date(new Date().toISOString().slice(0,10))));
      while(d<=end){labels.push(d.toISOString().slice(0,10));d=new Date(d.getTime()+864e5)}}
    const ds=cl.map(c=>({label:c,backgroundColor:CAT_COLORS[c]||'#f472b6',borderRadius:4,
      data:labels.map(l=>state.all.filter(o=>(o.category||'Övrigt')===c&&day(o.first_seen)===l).length)}));
    new Chart($('#chartDay'),{type:'bar',data:{labels,datasets:ds},
      options:{maintainAspectRatio:false,scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{position:'bottom'}}}});

    const cc={};state.all.forEach(o=>catchTypes(o).forEach(t=>cc[t]=(cc[t]||0)+1));
    const ce=Object.entries(cc).sort((a,b)=>b[1]-a[1]);
    new Chart($('#chartCatch'),{type:'bar',data:{labels:ce.map(e=>e[0]),datasets:[{label:'Antal erbjudanden',data:ce.map(e=>e[1]),backgroundColor:'#fbbf24',borderRadius:6}]},
      options:{indexAxis:'y',maintainAspectRatio:false,scales:{x:{beginAtZero:true,ticks:{precision:0}},y:{grid:{display:false}}},plugins:{legend:{display:false}}}});
  }

  // Lokalt: pull out address/date (explicit fields or found in offer/catch text)
  const ADDR_RE=/((?:S:t |St\.? |Sankt )?(?:(?!(?:Vid|På|Nära|Mot|Hos|I|Gratis)\s)[A-ZÅÄÖ][a-zåäöé]+\s){0,3}(?:[A-ZÅÄÖ][a-zåäöé]*|[a-zåäöé]*)(?:gatan|vägen|torget|torg|platsen|plats|gränd|allén|stråket|bron|kajen|parken)(?:\s\d+(?:\s?[–-]\s?\d+)?[A-Za-z]?)?)/;
  const DAY='(?:mån|tis|ons|tors|fre|lör|sön)(?:dag(?:en|ar)?)?(?![a-zåäö])';
  const MON='(?:jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)[a-z]*\\.?';
  const TIME='\\d{1,2}(?:[:.]\\d{2})?\\s?[–-]\\s?\\d{1,2}(?:[:.]\\d{2})?|kl\\.?\\s?\\d{1,2}[:.]\\d{2}';
  const DATE_RE=new RegExp(`(?:^|[\\s,(·])(${DAY}(?:\\s?[–-]\\s?${DAY})?(?:\\s\\d{1,2}\\s${MON})?(?:\\s(?:${TIME}))?|(?<!\\d)\\d{1,2}\\s${MON}(?:\\s(?:${TIME}))?|\\d{4}-\\d{2}-\\d{2}(?:\\s(?:${TIME}))?)`,'i');
  // Lokalt: pull out address/date (explicit fields or found in offer/catch text)
  function localInfo(o){
    const t=[o.offer,o.catch].join(' · ');
    let addr=o.address||o.adress||o.location||'';
    if(!addr){const m=t.match(ADDR_RE);if(m)addr=m[1].trim()}
    let when=o.date||o.datum||o.when||'';
    if(!when){const m=String(o.offer||'').match(DATE_RE);if(m)when=m[1].trim()}
    if(!addr&&!when)return '';
    const q=encodeURIComponent(addr+', Malmö');
    return `<div class="loc">${addr?`📍 <a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${esc(addr)}</a>`:''}${when?` <span class="when">🗓 ${esc(when)}</span>`:''}</div>`;
  }

  function render(){
    const q=state.q.toLowerCase();
    let rows=state.all.filter(o=>{
      if(state.cat==='Nytt'&&!isNew(o))return false;
      if(state.cat!=='Alla'&&state.cat!=='Nytt'&&(o.category||'Övrigt')!==state.cat)return false;
      if(q&&!['service','category','offer','code','catch','address','date'].some(k=>String(o[k]||'').toLowerCase().includes(q)))return false;
      return true});
    const k=state.key;
    rows.sort((a,b)=>{let x=a[k]||'',y=b[k]||'';
      if(k==='first_seen'){x=new Date(x).getTime()||0;y=new Date(y).getTime()||0;return (x-y)*state.dir}
      return String(x).localeCompare(String(y),'sv')*state.dir});
    $('#tbl tbody').innerHTML=rows.map(o=>{
      const c=o.category||'Övrigt';
      let code='<span class="muted">–</span>';
      if(hasCode(o)){const raw=String(o.code).trim();const tok=raw.split(/[\s(]/)[0];const note=raw.slice(tok.length).trim().replace(/^\((.*)\)$/,'$1');
        code=`<span class="code">${esc(tok)}</span><button class="copy" data-code="${esc(tok)}" title="Kopiera kod">Kopiera</button>${note?`<div class="muted" style="font-size:12px">${esc(note)}</div>`:''}`}
      const d=day(o.first_seen)||esc(o.first_seen||'');
      const link=o.link?`<a class="go" href="${esc(o.link)}" target="_blank" rel="noopener">Till erbjudandet →</a>`:'';
      return `<tr>
        <td class="svc" data-l="Tjänst">${esc(o.service)}${isNew(o)?'<span class="badge">Nytt</span>':''}</td>
        <td data-l="Kategori"><span class="cat ${esc(c)}">${esc(c)}</span></td>
        <td data-l="Erbjudande">${esc(o.offer)}${c==='Lokalt'?localInfo(o):''}</td>
        <td data-l="Kod">${code}</td>
        <td data-l="Haken" class="catch">${esc(o.catch||'–')}</td>
        <td data-l="Hittad" class="muted">${d}</td>
        <td>${link}</td></tr>`}).join('');
    $('#empty').hidden=rows.length>0;
    if(!rows.length&&state.all.length)$('#empty').textContent='Inga träffar för filtret.';
  }

  document.addEventListener('DOMContentLoaded',()=>{
    $('#search').addEventListener('input',e=>{state.q=e.target.value;render()});
    document.querySelectorAll('th[data-key]').forEach(th=>th.addEventListener('click',()=>{
      const k=th.dataset.key;if(state.key===k)state.dir*=-1;else{state.key=k;state.dir=k==='first_seen'?-1:1}
      document.querySelectorAll('th').forEach(t=>t.classList.remove('sorted','asc','desc'));
      th.classList.add('sorted',state.dir===1?'asc':'desc');render()}));
    $('#tbl').addEventListener('click',async e=>{const b=e.target.closest('.copy');if(!b)return;
      const t=b.dataset.code;
      try{await navigator.clipboard.writeText(t)}catch(_){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}
      const el=$('#toast');el.textContent=`Kopierat: ${t}`;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,1600)});
    load();
  });
})();
