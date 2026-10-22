'use strict';
(() => {
 const button = document.getElementById('parcel-login');
 const secret = document.getElementById('parcel-secret') || document.getElementById('secret');
 const status = document.getElementById('parcel-login-status');
 const editor = document.getElementById('parcel-editor');
 if (!button || !secret || !editor) return;
 secret.addEventListener('input', () => { editor.disabled = true; });
 document.getElementById('admin-logout').addEventListener('click', async () => {
  const response = await fetch('/api/admin-auth', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'logout'})});
  if (response.ok) location.reload();
 });
 button.addEventListener('click', async () => {
  editor.disabled = true;
  button.disabled = true;
  const credential = secret.value;
  try {
   const response = await fetch('/api/admin-auth', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:document.getElementById('admin-username').value, password:credential})});
   if (!response.ok || secret.value !== credential) throw new Error();
   secret.value = '';
   editor.disabled = false;
   status.textContent = 'Đã xác thực.';
  } catch { status.textContent = 'Không thể xác thực.'; }
  finally { button.disabled = false; }
 });
})();
