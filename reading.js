'use strict';
// оқыSAY: independent reading list and PDF module; Supabase publishable key only.
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { db:null, session:null, profile:null, books:new Map(), rows:[], grade:'6', query:'' };
let toastTimer;
function toast(message){const el=$('#toast'); el.textContent=String(message);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4000);}
function modal(content){$('#modalBody').innerHTML=content;$('#modal').hidden=false;document.body.style.overflow='hidden';}
function closeModal(){$('#modal').hidden=true;$('#modalBody').replaceChildren();document.body.style.overflow='';}
const teacher = () => state.profile?.role === 'teacher';
const bookById = id => state.books.get(Number(id));
function safeHref(url){try{const parsed=new URL(url);return parsed.protocol==='https:'?parsed.href:null}catch{return null}}
function render(){
 $$('#gradebar button').forEach(b=>b.classList.toggle('active',b.dataset.grade===state.grade));
 const q=state.query.toLocaleLowerCase('kk-KZ').trim();
 const rows=state.rows.filter(r=>(state.grade==='all'||String(r.grade)===state.grade)&&(!q||(r.title_display+' '+(bookById(r.book_id)?.author||'')).toLocaleLowerCase('kk-KZ').includes(q)));
 $('#counter').textContent=`${rows.length} кітап · ${rows.filter(r=>!!bookById(r.book_id)?.pdf_path).length} PDF`;
 $('#bookgrid').innerHTML=rows.length?rows.map(r=>{const b=bookById(r.book_id),ready=!!b?.pdf_path,author=b?.author&&b.author!=='—'?b.author:'Автор көрсетілмеген';return `<article class="bookcard"><div class="cover"><small>📖 ${r.grade}-СЫНЫП · №${r.position}</small><span>${esc(r.title_display)}</span></div><h3>${esc(r.title_display)}</h3><p>${esc(author)}</p><div class="bottom"><span class="status ${ready?'ok':''}">● ${ready?'PDF дайын':'PDF күтілуде'}</span><button class="button ${ready?'':'outline'}" data-open="${r.book_id}">${ready?'📖 Кітапты оқу':'Толығырақ ↗'}</button></div></article>`}).join(''):'<div class="loader">Бұл санат бойынша кітап табылмады.</div>';
}
function header(b){return `<span class="eyebrow">«КІТАП ОҚИТЫН ҰЛТ»</span><h2 id="modalTitle">${esc(b.title)}</h2><p>${esc(b.author&&b.author!=='—'?b.author:'Автор көрсетілмеген')}</p>`}
function teacherUploadForm(id){return `<form id="pdfUpload" data-book="${id}" class="formfile"><label>👩‍🏫 Мұғалімге: PDF енгізу/жаңарту</label><small>Тек жариялауға рұқсат етілген PDF. Көлемі 50 МБ-тан аспауы тиіс.</small><input type="file" name="pdf" accept="application/pdf,.pdf" required><button type="submit" class="button upload">☁️ PDF-ті жүктеу</button><small>Кітап тек жүйеге кірген қатысушыларға қолжетімді болады.</small></form>`}
async function openBook(id){
 const b=bookById(id);if(!b){toast('Кітап табылмады');return;}
 const link=safeHref(b.external_url);
 const sources=`<div class="modal-actions">${link?`<a class="button pale" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Мәтінді дереккөзден оқу ↗</a>`:''}<a class="button outline" href="https://reading-nation.kz/book-links" target="_blank" rel="noopener noreferrer">Ресми кітап навигаторы ↗</a></div>`;
 if(!b.pdf_path){modal(header(b)+'<p>Кітап оқу тізімінде бар, бірақ PDF файлы мектептің кітап қоймасына әлі жүктелмеген. Қазір ресми электронды кітапханалардан іздей аласыз.</p>'+sources+(teacher()?teacherUploadForm(id):'<p>PDF жүктелгеннен кейін «Кітапты оқу» батырмасы ашылады.</p>'));return;}
 if(!state.session){modal(header(b)+'<p>Толық PDF-ті оқу үшін оқушы, мұғалім немесе ата-ана аккаунтымен кіру қажет.</p><div class="modal-actions"><a class="button" href="cloud.html">🔐 Жүйеге кіру</a></div>'+sources);return;}
 modal(header(b)+'<p>PDF ашылуда…</p>');
 try{
  const signed=await state.db.storage.from('oqysay-library').createSignedUrl(b.pdf_path,3600);
  if(signed.error)throw signed.error;
  const url=safeHref(signed.data?.signedUrl);if(!url)throw new Error('PDF-ке қауіпсіз сілтеме алынбады');
  const progress=await state.db.from('reading_progress').select('last_page').eq('user_id',state.session.user.id).eq('book_id',id).maybeSingle();
  const page=Math.max(1,Number(progress.data?.last_page)||1);
  modal(header(b)+`<div class="modal-actions"><a class="button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">📖 Толық экранда ашу ↗</a><button class="button outline" data-reload="${id}">🔄 Қайта ашу</button></div><form id="saveProgress" data-book="${id}" class="read-progress"><label for="readPage">Оқыған бетің:</label><input name="page" id="readPage" type="number" min="1" max="100000" value="${page}" required><button class="button pale" type="submit">💾 Сақтау</button><small>Әр қатысушының оқу беті жеке сақталады.</small></form><iframe class="readerframe" title="${esc(b.title)}" src="${esc(url+'#page='+page)}"></iframe><p>Телефонда PDF ашылмаса, «Толық экранда ашу» батырмасын таңдаңыз.</p>`+(teacher()?teacherUploadForm(id):''));
 }catch(e){modal(header(b)+`<p>PDF ашу қатесі: ${esc(e.message)}</p>`+sources+(teacher()?teacherUploadForm(id):''));}
}
async function saveProgress(form){
 if(!state.session){toast('Алдымен жүйеге кіріңіз');return;}
 const page=Number(form.elements.page.value),id=Number(form.dataset.book);
 if(!Number.isInteger(page)||page<1||page>100000){toast('Дұрыс бет нөмірін жазыңыз');return;}
 const res=await state.db.from('reading_progress').upsert({user_id:state.session.user.id,book_id:id,last_page:page,updated_at:new Date().toISOString()},{onConflict:'user_id,book_id'});
 toast(res.error?'Сақтау қатесі: '+res.error.message:page+'-бет сақталды ✓');
}
async function uploadBook(form){
 if(!state.session||!teacher()){toast('PDF-ті тек мұғалім енгізе алады');return;}
 const id=Number(form.dataset.book),file=form.elements.pdf.files?.[0],b=bookById(id);
 if(!file||!b)return;
 if(!file.name.toLowerCase().endsWith('.pdf')||file.size>50*1024*1024){toast('50 МБ-қа дейінгі PDF файлын таңдаңыз');return;}
 const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='Жүктелуде…';
 try{
  const path=`books/${id}.pdf`;
  const up=await state.db.storage.from('oqysay-library').upload(path,file,{contentType:'application/pdf',upsert:true});if(up.error)throw up.error;
  const save=await state.db.from('books').update({pdf_path:path}).eq('id',id).select('id,pdf_path').single();if(save.error)throw save.error;
  b.pdf_path=path;render();toast('PDF енгізілді. Енді кітапты оқуға болады.');await openBook(id);
 }catch(e){toast('Жүктеу қатесі: '+e.message);button.disabled=false;button.textContent='☁️ PDF-ті жүктеу';}
}
document.addEventListener('click',e=>{
 const grade=e.target.closest('[data-grade]');if(grade){state.grade=grade.dataset.grade;history.replaceState({},'',`?grade=${encodeURIComponent(state.grade)}`);render();}
 const b=e.target.closest('[data-open]');if(b)openBook(Number(b.dataset.open));
 const r=e.target.closest('[data-reload]');if(r)openBook(Number(r.dataset.reload));
 if(e.target.id==='close'||e.target.id==='modal')closeModal();
});
document.addEventListener('submit',e=>{if(e.target.id==='pdfUpload'){e.preventDefault();uploadBook(e.target)}if(e.target.id==='saveProgress'){e.preventDefault();saveProgress(e.target)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
$('#search').addEventListener('input',e=>{state.query=e.target.value;render()});
async function init(){
 try{
  const cfg=window.OQYSAY_SUPABASE;if(!cfg?.url||!cfg?.publishableKey||!window.supabase)throw new Error('Supabase баптауы табылмады');
  state.db=window.supabase.createClient(cfg.url,cfg.publishableKey);
  const auth=await state.db.auth.getSession();if(auth.error)throw auth.error;state.session=auth.data.session;
  if(state.session){const profile=await state.db.from('profiles').select('id,role,full_name').eq('id',state.session.user.id).maybeSingle();if(!profile.error)state.profile=profile.data;}
  $('#loginStatus').textContent=state.session?`${teacher()?'👩‍🏫':state.profile?.role==='parent'?'👪':'🎒'} ${state.profile?.full_name||'Кіру орындалды'}`:'🔓 Каталог ашық';
  const params=new URLSearchParams(location.search),g=params.get('grade');if(['6','7','8','9','10','all'].includes(g))state.grade=g;
  const [r,b]=await Promise.all([state.db.from('reading_list').select('grade,position,title_display,book_id').order('grade').order('position'),state.db.from('books').select('id,title,author,pdf_path,external_url')]);
  if(r.error)throw r.error;if(b.error)throw b.error;
  state.rows=r.data||[];state.books=new Map((b.data||[]).map(x=>[x.id,x]));render();
  const book=params.get('book');if(book&&bookById(book))openBook(Number(book));
  state.db.auth.onAuthStateChange((_,s)=>{state.session=s;});
 }catch(e){const n=$('#notice');n.textContent='Кітапхана жүктелмеді: '+e.message;n.hidden=false;$('#bookgrid').innerHTML='<div class="loader">Қосылымды тексеріп, бетті жаңартып көріңіз.</div>';$('#loginStatus').textContent='Қосылым қатесі';}
}
init();