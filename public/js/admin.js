document.addEventListener('DOMContentLoaded',()=>{
  const menu=document.querySelector('.sidebar'),button=document.querySelector('[data-admin-menu]');if(button&&menu)button.addEventListener('click',()=>menu.classList.toggle('open'));
  document.querySelectorAll('[data-confirm]').forEach(el=>el.addEventListener('submit',e=>{if(!window.confirm(el.dataset.confirm)){e.preventDefault()}}));
  document.querySelectorAll('[data-delete-url]').forEach(btn=>btn.addEventListener('click',()=>{if(!window.confirm(btn.dataset.confirm||'Apakah Anda yakin ingin menghapus data ini?'))return;const form=document.createElement('form');form.method='post';form.action=btn.dataset.deleteUrl;document.body.appendChild(form);form.submit()}));
  document.querySelectorAll('input[name="judul"]').forEach(input=>{const slug=input.form?.querySelector('input[name="slug"]');if(!slug)return;let edited=Boolean(slug.value);slug.addEventListener('input',()=>edited=true);input.addEventListener('input',()=>{if(edited)return;slug.value=input.value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,240)})});
});
