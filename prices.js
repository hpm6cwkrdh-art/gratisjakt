(function(){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kr=v=>v==null?'–':Number(v).toLocaleString('sv-SE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const kr0=v=>v==null?'–':Math.round(v).toLocaleString('sv-SE');
  const STORE_COLORS={willys:'#ef4444',hemkop:'#f97316',ica_mobilia:'#e11d48',ica_maxi:'#fb7185',coop:'#22c55e',mathem:'#a78bfa'};
  const col=(id,i)=>STORE_COLORS[id]||['#60a5fa','#fbbf24','#4ade80','#f472b6','#a1a1aa'][i%5];
  let loaded=false,data=null,hist=[];

  // ---------- tabs ----------
  function show(name){
    if(!['erbjudanden','matpriser'].includes(name))name='erbjudanden';
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===name));
    document.querySelectorAll('.tabpanel').forEach(p=>p.hidden=p.id!=='tab-'+name);
    if(name==='matpriser'&&!loaded){loaded=true;load()}
  }
  const fromHash=()=>show((location.hash||'#erbjudanden').slice(1));
  window.addEventListener('hashchange',fromHash);

  async function load(){
    const bust='?t='+Date.now();
    try{const r=await fetch('data/prices-latest.json'+bust);if(!r.ok)throw 0;data=await r.json()}
    catch(e){$('#pVerdictText').textContent='Kunde inte läsa prisdata (data/prices-latest.json).';return}
    try{const r=await fetch('data/prices-history.json'+bust);hist=r.ok?await r.json():[]}catch(e){hist=[]}
    if(!Array.isArray(hist))hist=[];
    header();verdict();table();kits();notes();charts();
  }

  function header(){
    const d=new Date(data.generated||data.date);
    $('#pUpdated').textContent=isNaN(d)?data.date:d.toLocaleString('sv-SE',{timeZone:'Europe/Stockholm',dateStyle:'medium',timeStyle:'short'});
    $('#pLocation').textContent=data.location?'Nära '+data.location:'';
  }

  function sname(id){const s=data.stores.find(x=>x.id===id);return s?s.name:id}
  function short(id){return ({willys:'Willys',hemkop:'Hemköp',ica_mobilia:'ICA Kvantum Mobilia',ica_maxi:'Maxi ICA',coop:'Coop',mathem:'Mathem'})[id]||sname(id)}

  function verdict(){
    $('#pVerdictText').textContent=data.verdict||'';
    const T=data.totals,ids=Object.keys(T);
    const cg=ids.reduce((a,b)=>T[b].goods<T[a].goods?b:a);
    const withFee=ids.flatMap(id=>[['Hämta',T[id].with_pickup,id],['hemleverans',T[id].with_delivery,id]]).filter(x=>x[1]!=null).sort((a,b)=>a[1]-b[1]);
    const kitsOrd=data.meal_kits.map(k=>k.per_portion_ordinary).filter(v=>v!=null);
    const self=data.cook_yourself.map(c=>c.per_portion).filter(v=>v!=null);
    const box=[
      ['good',kr0(Math.min(...self))+'–'+kr0(Math.max(...self))+' kr','Laga själv per portion'],
      ['bad',kr0(Math.min(...kitsOrd))+'–'+kr0(Math.max(...kitsOrd))+' kr','Matkasse per portion, ordinarie'],
      ['',kr0(T[cg].goods)+' kr','Billigaste korg (varor): '+short(cg)],
      ['',withFee.length?kr0(withFee[0][1])+' kr':'–',withFee.length?'Billigast inkl. avgift: '+short(withFee[0][2])+' '+withFee[0][0]:'']
    ];
    $('#pVerdictStats').innerHTML=box.map(([c,n,l])=>`<div class="vstat ${c}"><span class="num">${esc(n)}</span><span class="lbl">${esc(l)}</span></div>`).join('');
  }

  // footnotes: product notes in cells become numbered footnotes
  let foot=[];
  function fn(text){if(!text)return '';let i=foot.indexOf(text);if(i<0){foot.push(text);i=foot.length-1}return `<sup>${i+1}</sup>`}

  function table(){
    foot=[];
    const ids=data.stores.map(s=>s.id);
    $('#ptbl thead').innerHTML='<tr><th>Vara</th>'+ids.map(id=>`<th class="num" title="${esc(sname(id))}">${esc(short(id))}</th>`).join('')+'</tr>';
    $('#ptbl tbody').innerHTML=data.basket.map(it=>{
      const row=data.prices[it.id]||{};
      const vals=ids.map(id=>row[id]&&row[id].price!=null?row[id].price:null);
      const min=Math.min(...vals.filter(v=>v!=null));
      return `<tr><td>${esc(it.name)}</td>`+ids.map((id,k)=>{
        const c=row[id];if(!c||c.price==null)return `<td class="na" data-l="${esc(short(id))}">–</td>`;
        return `<td class="num${vals[k]===min?' best':''}" data-l="${esc(short(id))}"${c.product?` title="${esc(c.product)}"`:''}>${kr(c.price)}${fn(c.note?short(id)+': '+c.note:'')}</td>`}).join('')+'</tr>'}).join('');
    const T=data.totals;
    const minOf=k=>Math.min(...ids.map(id=>T[id][k]).filter(v=>v!=null));
    const line=(lbl,k,cls)=>{const m=minOf(k);return `<tr class="${cls||''}"><td>${lbl}</td>`+ids.map(id=>{const v=T[id][k];
      return v==null?`<td class="na">–</td>`:`<td class="num${v===m?' best':''}">${kr(v)}</td>`}).join('')+'</tr>'};
    const fee=(lbl,k,nk)=>`<tr class="sub"><td>${lbl}</td>`+data.stores.map(s=>{const v=s.fees[k];const n=s.fees[nk];
      return v==null?`<td class="na">–${fn(n?short(s.id)+': '+n:'')}</td>`:`<td class="num">${kr(v)}${fn(n&&k==='home_delivery'?short(s.id)+': '+n:'')}</td>`}).join('')+'</tr>';
    $('#ptbl tfoot').innerHTML=line('Summa varor','goods')+fee('Avgift Hämta','pickup','pickup_note')+line('Summa med Hämta','with_pickup')+fee('Avgift hemleverans','home_delivery','home_delivery_note')+line('Summa med hemleverans','with_delivery');
    const extra=[data.method,data.campaign_note,'– = uppgiften gick inte att se utan inloggning/tidsbokning eller hittades inte; inget pris har gissats.'].filter(Boolean);
    $('#pFoot').innerHTML=foot.map(t=>`<li>${esc(t)}</li>`).join('');
    $('#pFoot').insertAdjacentHTML('afterend',`<p class="note">${extra.map(esc).join('<br>')}</p>`);
  }

  function kits(){
    $('#pkits thead').innerHTML='<tr><th>Alternativ</th><th class="num">Ordinarie</th><th class="num">1:a kassen</th><th class="num">Snitt intro</th><th>Rabatt/villkor</th></tr>';
    $('#pkits tbody').innerHTML=data.meal_kits.map(k=>`<tr><td><b>${esc(k.name)}</b><span class="pn">${esc(k.plan)}${k.weekly_price!=null?` · ${kr0(k.weekly_price)} kr + ${kr0(k.delivery)} kr frakt`:''}</span></td>
      <td class="num">${kr(k.per_portion_ordinary)}</td><td class="num">${kr(k.per_portion_first_box)}</td><td class="num">${kr(k.per_portion_intro_avg)}</td>
      <td class="small">${esc(k.intro_note||'')}<span class="pn">Källa: ${esc(k.source||'')}</span></td></tr>`).join('')+
      data.cook_yourself.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td class="num best">${kr(c.per_portion)}</td><td class="na">–</td><td class="na">–</td><td class="small">${c.range?esc(c.range.join('–')+' kr'):''}</td></tr>`).join('');
  }

  function notes(){
    const n=[...(data.notes||[])];if(data.cook_yourself_basis)n.unshift('Laga själv: '+data.cook_yourself_basis);
    data.stores.forEach(s=>{if(s.first_order)n.push(`${s.chain}: ${s.first_order}`)});
    $('#pNotes').innerHTML=n.map(t=>`<li>${esc(t)}</li>`).join('');
  }

  function charts(){
    if(!window.Chart){setTimeout(charts,200);return}
    const ids=data.stores.map(s=>s.id),T=data.totals;
    $('#pBasketNote').textContent='Saknad stapel = avgiften syns inte utan tidsbokning (ingen gissning).';
    new Chart($('#chartBasket'),{type:'bar',data:{labels:ids.map(short),datasets:[
      {label:'Varor',data:ids.map(i=>T[i].goods),backgroundColor:'#60a5fa',borderRadius:5},
      {label:'Med Hämta',data:ids.map(i=>T[i].with_pickup),backgroundColor:'#4ade80',borderRadius:5},
      {label:'Med hemleverans',data:ids.map(i=>T[i].with_delivery),backgroundColor:'#fbbf24',borderRadius:5}]},
      options:{maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{beginAtZero:false,suggestedMin:500}},
        plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${kr(c.raw)} kr`}}}}});

    const rows=[];
    data.meal_kits.forEach(k=>{
      if(k.per_portion_ordinary!=null)rows.push([k.name.replace(/ \(.*\)/,'')+' – ordinarie',k.per_portion_ordinary,'#fbbf24']);
      if(k.per_portion_first_box!=null)rows.push([k.name.replace(/ \(.*\)/,'')+' – 1:a kassen',k.per_portion_first_box,'#f97316']);
      if(k.per_portion_intro_avg!=null)rows.push([k.name.replace(/ \(.*\)/,'')+' – snitt intro',k.per_portion_intro_avg,'#fb923c']);
    });
    data.cook_yourself.forEach(c=>rows.push([c.name.replace(/ \(.*\)/,''),c.per_portion,/^Laga/.test(c.name)?'#4ade80':'#a78bfa']));
    rows.sort((a,b)=>b[1]-a[1]);
    $('#chartPortion').parentElement.style.height=Math.max(260,rows.length*26+40)+'px';
    $('#pPortionNote').textContent='Gul/orange = matkassar, grönt = laga själv, lila = engångsrabatt/räkneexempel.';
    new Chart($('#chartPortion'),{type:'bar',data:{labels:rows.map(r=>r[0]),datasets:[{label:'kr/portion',data:rows.map(r=>r[1]),backgroundColor:rows.map(r=>r[2]),borderRadius:5}]},
      options:{indexAxis:'y',maintainAspectRatio:false,scales:{x:{beginAtZero:true},y:{grid:{display:false},ticks:{autoSkip:false,font:{size:11}}}},
        plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${kr(c.raw)} kr/portion`}}}}});

    const H=hist.length?hist:[{date:data.date,totals:Object.fromEntries(ids.map(i=>[i,T[i].goods]))}];
    new Chart($('#chartHistory'),{type:'line',data:{labels:H.map(h=>h.date),datasets:ids.map((id,i)=>({label:short(id),data:H.map(h=>h.totals?h.totals[id]??null:null),
      borderColor:col(id,i),backgroundColor:col(id,i),pointRadius:5,pointHoverRadius:7,tension:.25,spanGaps:true}))},
      options:{maintainAspectRatio:false,scales:{x:{offset:true,grid:{display:false}},y:{beginAtZero:false,suggestedMin:550,suggestedMax:750}},
        plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${kr(c.raw)} kr`}}}}});
  }

  document.addEventListener('DOMContentLoaded',fromHash);
})();
