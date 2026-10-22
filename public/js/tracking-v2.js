'use strict';
(() => {
 const form = document.getElementById('tracking-form');
 if (!form) return;
 const $ = id => document.getElementById(id);
 const number = $('tracking-number'), carrier = $('carrier-input');
 const params = new URLSearchParams(location.search);
 number.value = params.get('number') || params.get('num') || '';
 carrier.value = params.get('carrierText') || params.get('carrier') || '';
 let serial = 0;
 fetch('/api/carriers').then(r => {if (!r.ok) throw Error(); return r.json();}).then(body => {
  const items = Array.isArray(body) ? body : body.data || [];
  items.forEach(item => { const option = document.createElement('option'); option.value = `${item.key} - ${item._name || item.name}`; $('carrier-list').append(option); });
 }).catch(() => { $('carrier-warning').textContent = 'Không tải được danh sách hãng. Bạn có thể nhập mã hãng hoặc dùng tự động.'; });
 function line(node, text) { const p = document.createElement('p'); p.textContent = text; node.append(p); }
 async function source(kind, run, code, carrierText) {
  const node = $(kind === 'internal' ? 'internal-updates' : 'tracking-pretty');
  node.setAttribute('aria-busy','true'); node.textContent = 'Đang tải cập nhật…';
  try {
   const response = kind === 'internal' ? await fetch('/api/parcel-updates?code='+encodeURIComponent(code)) : await fetch('/api/track', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({number:code,carrier:Number(carrierText.match(/^\d+/)?.[0]) || undefined,carrierText})});
   if (!response.ok) throw Error();
   const body = await response.json(); if (run !== serial) return;
   node.replaceChildren();
   if (kind === 'internal') {
    const items = body.updates || body.data || [];
    if (!items.length) line(node,'Chưa có cập nhật nội bộ.');
    [...items].sort((a,b) => new Date(b.time || b.createdAt)-new Date(a.time || a.createdAt)).forEach(item => line(node,`${item.time || item.createdAt || ''} — ${item.event || item.description || ''} ${item.location || ''}`));
   } else {
    const accepted = body.info?.data?.accepted?.[0];
    if (!accepted) line(node,'Không tìm thấy vận đơn tại hãng đã chọn.');
    else {
     const info = accepted.track_info;
     line(node,`${accepted.number} · ${info?.latest_status?.status || ''}`);
     line(node,info?.latest_event?.description || 'Chưa có sự kiện.');
     const providers = info?.tracking?.providers || [];
     providers.forEach(provider => {line(node,provider.provider?.name || ''); (provider.events || []).slice(0,15).forEach(event => line(node,`${event.time_iso || event.time_utc || ''} — ${event.description || ''} ${event.location || ''}`));});
    }
   }
   line(node,'Tra cứu lúc '+new Date().toLocaleString('vi-VN'));
  } catch {
   if (run !== serial) return;
   node.textContent = 'Không thể kết nối nguồn này. ';
   const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Thử lại nguồn này'; retry.onclick = () => source(kind,run,code,carrierText); node.append(retry);
  } finally {if (run === serial) node.setAttribute('aria-busy','false');}
 }
 form.onsubmit = e => {
  e.preventDefault(); if (!number.value.trim()) return;
  const run = ++serial, code = number.value.trim(), carrierText = carrier.value.trim();
  $('tracking-status').textContent = 'Kết quả cho mã '+code;
  source('internal',run,code,carrierText); source('external',run,code,carrierText);
 };
 if (number.value) form.requestSubmit();
})();
