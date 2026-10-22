'use strict';
const $ = id => document.getElementById(id);
function validate(form) {
 let first;
 form.querySelectorAll('input,select,textarea').forEach(input => {
  const bad = !input.checkValidity();
  input.setAttribute('aria-invalid', String(bad));
  const error = $(input.id + '-error');
  if (error) error.textContent = bad ? 'Vui lòng kiểm tra thông tin này.' : '';
  if (bad && !first) first = input;
 });
 first?.focus(); return !first;
}
if ($('quote')) {
 const form = $('quote');
 const service = new URLSearchParams(location.search).get('service');
 if (['1','2','3','4'].includes(service)) $('service').value = service;
 form.addEventListener('submit', e => {
  e.preventDefault();
  if ($('website').value || !validate(form)) return;
  $('quote-status').textContent = 'Yêu cầu chưa được gửi: biểu mẫu trực tuyến chưa kết nối dịch vụ tiếp nhận. Vui lòng gọi 0966 862 355 hoặc gửi email tới vietson707@gmail.com. Thông tin đã nhập được giữ nguyên.';
 });
}
if ($('parcel')) {
 let selected = null, items = [], busy = false;
 const form = $('parcel');
 function reset() {
  selected = null; form.reset(); $('event-time').value = new Date(Date.now()+7*3600000).toISOString().slice(0,16);
  $('create').disabled = false; $('update').disabled = $('delete').disabled = true;
  $('selected-summary').textContent = 'Chưa chọn sự kiện.';
 }
 async function load() {
  const code = $('read-code').value.trim(); if (!code) return;
  $('read-status').textContent = 'Đang tải…';
  try {
   const response = await fetch('/api/parcel-updates?code='+encodeURIComponent(code));
   if (!response.ok) throw new Error();
   const body = await response.json(); items = body.updates || body.data || [];
   $('events').replaceChildren(); reset(); $('parcel-code').value = code;
   items.forEach(item => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'event secondary';
    button.textContent = `${item.id} · ${item.time || ''} · ${item.event || ''} · ${item.location || ''}`;
    button.onclick = () => {
     if (busy) return; selected = item;
     $('parcel-code').value = code; $('event-text').value = item.event || ''; $('event-location').value = item.location || '';
     $('event-time').value = new Date(new Date(item.time).getTime()+7*3600000).toISOString().slice(0,16);
     $('selected-summary').textContent = button.textContent; $('create').disabled = true; $('update').disabled = $('delete').disabled = false;
    }; $('events').append(button);
   });
   $('read-status').textContent = items.length ? 'Đã tải cập nhật.' : 'Chưa có cập nhật.';
  } catch { $('read-status').textContent = 'Không tải được cập nhật. Vui lòng thử lại.'; }
 }
 $('read-parcels').onsubmit = e => { e.preventDefault(); if (!busy) load(); };
 $('reset-editor').onclick = reset;
 async function write(mode) {
  if (busy || (mode !== 'create' && !selected)) return;
  if (mode !== 'delete' && !validate(form)) return;
  const code = mode === 'create' ? $('parcel-code').value.trim() : $('read-code').value.trim();
  const secret = $('parcel-secret').value;
  const auth = await fetch('/api/parcel-updates', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify',secret})}).catch(() => null);
  if (!auth?.ok) { $('admin-status').textContent = 'Không thể xác thực.'; return; }
  const payload = { secret, mode, parcelCode: code, updateId: selected?.id,
   data: {time: new Date($('event-time').value+'+07:00').toISOString(), event: $('event-text').value.trim(), location: $('event-location').value.trim()} };
  busy = true; document.querySelectorAll('#parcel button,#events button,#delete').forEach(b => b.disabled = true);
  $('admin-status').textContent = 'Đang gửi…';
  try {
   const response = await fetch('/api/parcel-updates', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Thao tác cần xác thực nhân viên. Liên hệ quản trị hệ thống.' : 'Không lưu được. Vui lòng thử lại.');
   $('read-code').value = code; await load(); $('admin-status').textContent = 'Đã lưu cập nhật.';
  } catch (error) { $('admin-status').textContent = error.message; }
  finally { busy = false; $('reset-editor').disabled = false; $('create').disabled = !!selected; $('update').disabled = $('delete').disabled = !selected; }
 }
 form.onsubmit = e => {e.preventDefault(); write(e.submitter?.id === 'update' ? 'update' : 'create');};
 $('delete').onclick = () => { if (!selected || busy) return; $('delete-summary').textContent = $('selected-summary').textContent; $('confirm-delete').showModal(); $('cancel-delete').focus(); };
 $('cancel-delete').onclick = () => $('confirm-delete').close();
 $('confirm-action').onclick = () => { $('confirm-delete').close(); write('delete'); };
 reset();
}
// Motion is progressive: content stays visible without JavaScript or IntersectionObserver.
if(!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window){
 const observer=new IntersectionObserver(items=>items.forEach(item=>{if(item.isIntersecting){item.target.classList.add('visible');observer.unobserve(item.target);}}),{threshold:.08});
 document.querySelectorAll('.about,.section-heading,.photo-service,.stats article,.band-grid').forEach(node=>{node.classList.add('reveal');observer.observe(node);});
 document.body.classList.add('motion-ready');
}
// Preserve the original Vietnamese copy. English marketing labels are a local view preference.
document.body.lang='vi'; // Operational messages retain their source Vietnamese language.
const translated=document.querySelectorAll('[data-en]');
translated.forEach(node=>node.dataset.vi=node.innerHTML);
function setLanguage(lang){
 document.documentElement.lang=lang;
 translated.forEach(node=>{node.innerHTML=node.dataset[lang];node.lang=lang;});
 document.querySelectorAll('[data-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lang===lang)));
 try{localStorage.setItem('hll-language',lang);}catch{}
}
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.lang)));
try{if(localStorage.getItem('hll-language')==='en')setLanguage('en');}catch{}
