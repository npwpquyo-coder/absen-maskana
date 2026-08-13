const $ = s => document.querySelector(s);
const storeKey = 'hadirkita-maskana-v1';
const localBackup = () => JSON.parse(localStorage.getItem(storeKey) || '{"participants":[],"attendance":[]}');
const supabase = window.supabase.createClient(window.MASKANA_SUPABASE_URL, window.MASKANA_SUPABASE_KEY);
let data = {participants:[], attendance:[]};
let activeCardParticipant = null;
let addressBook = JSON.parse(localStorage.getItem('hadirkita-address-book') || '{}');
let realtimeChannel = null;
let loadingData = false;
let initialized = false;
const addressKey = village => village.trim().toLocaleLowerCase('id-ID').replace(/\s+/g,' ');

function rememberAddress(p){
 if(!p.village||!p.district||!p.regency)return;
 addressBook[addressKey(p.village)]={village:p.village,district:p.district,regency:p.regency};
 localStorage.setItem('hadirkita-address-book',JSON.stringify(addressBook));
}
function renderVillageOptions(){
 $('#villageOptions').innerHTML=Object.values(addressBook).sort((a,b)=>a.village.localeCompare(b.village,'id')).map(a=>`<option value="${esc(a.village)}">${esc(a.district)}, ${esc(a.regency)}</option>`).join('');
}
function autoFillAddress(){
 const address=addressBook[addressKey($('#villageInput').value)];
 if(!address)return;
 $('#districtInput').value=address.district;
 $('#regencyInput').value=address.regency;
}
function cacheData(){localStorage.setItem(storeKey,JSON.stringify(data));}
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const initials = name => name.split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase();
const fmtTime = iso => new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
const dateFormat = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()).toUpperCase();
$('#today').textContent=`${dateFormat} H`;
$('#eventDate').textContent=`${dateFormat} H · Pengajian rutin alumni`;

function uniqueVillages(){ return [...new Map(data.participants.map(p=>[`${p.village}|${p.district}|${p.regency}`,p])).values()]; }
function attendees(){ return data.attendance.map(a=>({...a,p:data.participants.find(p=>p.id===a.id)})).filter(a=>a.p); }
function renderDashboard(){
 const present=attendees(), villages=uniqueVillages(), activeVillages=[...new Set(present.map(x=>x.p.village))];
 $('#totalPeserta').textContent=data.participants.length;
 $('#totalHadir').textContent=present.length;
 $('#totalDesa').textContent=activeVillages.length;
 $('#presentRate').textContent=data.participants.length ? `${Math.round(present.length/data.participants.length*100)}% dari peserta`:'0% dari peserta';
 $('#villageRate').textContent=`Dari ${villages.length} desa terdaftar`;
 const last=present[0];
 $('#lastScan').textContent=last?last.p.name:'—';
 $('#lastTime').textContent=last?`Pukul ${fmtTime(last.time)}`:'Belum ada kehadiran';
 $('#recentList').className='recent-list'+(!present.length?' empty':'');
 $('#recentList').innerHTML=present.slice(0,4).map(a=>`<div class="recent"><span class="avatar">${initials(a.p.name)}</span><div><strong>${esc(a.p.name)}</strong><p>${esc(a.p.village)}, ${esc(a.p.district)}</p></div><time>${fmtTime(a.time)}</time></div>`).join('')||'Belum ada peserta yang hadir.';
 const bars=villages.map(v=>{const ps=data.participants.filter(p=>p.village===v.village), h=ps.filter(p=>present.some(a=>a.p.id===p.id)).length, n=ps.length;return `<div class="bar-row"><div class="bar-head"><b>${esc(v.village)}</b><span>${h}/${n} hadir</span></div><div class="bar"><span style="width:${n?h/n*100:0}%"></span></div></div>`}).join('');
 $('#villageBars').className='village-bars'+(!bars?' empty':'');
 $('#villageBars').innerHTML=bars||'Belum ada data kehadiran.';
}
function renderParticipants(){
 const term=$('#participantSearch').value.toLowerCase();
 const ps=data.participants.filter(p=>`${p.name} ${p.village} ${p.phone}`.toLowerCase().includes(term));
 $('#participantCount').textContent=`${data.participants.length} peserta terdaftar`;
 $('#participantRows').innerHTML=ps.map(p=>`<tr><td><strong>${esc(p.name)}</strong><small>ID: ${esc(p.id)}</small></td><td>${esc(p.village)}<small>${esc(p.district)}, ${esc(p.regency)}</small></td><td>${esc(p.phone)}</td><td><button class="qr-action" data-qr="${esc(p.id)}">Lihat QR</button></td><td><button class="delete-action" data-delete="${esc(p.id)}">Hapus</button></td></tr>`).join('')||emptyRow(5,'Belum ada peserta. Tambahkan peserta pertama Anda.');
}
function emptyRow(cols,text){return `<tr><td colspan="${cols}" style="text-align:center;padding:35px;color:#8b9696">${text}</td></tr>`}
function renderAttendance(){
 const term=$('#attendanceSearch').value.toLowerCase();
 const list=attendees().filter(a=>`${a.p.name} ${a.p.village}`.toLowerCase().includes(term));
 $('#attendanceCount').textContent=`${attendees().length} peserta tercatat hadir`;
 $('#attendanceRows').innerHTML=list.map(a=>`<tr><td><strong>${esc(a.p.name)}</strong><small>${esc(a.p.phone)}</small></td><td>${esc(a.p.village)}<small>${esc(a.p.district)}, ${esc(a.p.regency)}</small></td><td>${fmtTime(a.time)}</td><td><span class="status">✓ HADIR</span></td></tr>`).join('')||emptyRow(4,'Belum ada kehadiran yang tercatat.');
}
function renderRecap(){
 const villages=uniqueVillages(), present=attendees();
 const summary=[['Total desa terdaftar',villages.length],['Desa sudah hadir',new Set(present.map(x=>x.p.village)).size],['Total kehadiran',present.length]];
 $('#recapSummary').innerHTML=summary.map(x=>`<div><p>${x[0]}</p><strong>${x[1]}</strong></div>`).join('');
 $('#recapRows').innerHTML=villages.map(v=>{const ps=data.participants.filter(p=>p.village===v.village), h=ps.filter(p=>present.some(a=>a.p.id===p.id)).length,n=ps.length;return `<tr><td><strong>${esc(v.village)}</strong></td><td>${esc(v.district)}</td><td>${esc(v.regency)}</td><td>${n} peserta</td><td><strong>${h} hadir</strong></td><td><span class="percent">${n?Math.round(h/n*100):0}%</span></td></tr>`}).join('')||emptyRow(6,'Belum ada data peserta.');
}
function render(){renderDashboard();renderParticipants();renderAttendance();renderRecap();renderVillageOptions()}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800)}

async function loadRemoteData(){
 if(loadingData)return;
 loadingData=true;
 const localBeforeRemote=localBackup();
 try{
  const [{data:participants,error:pe},{data:attendance,error:ae}]=await Promise.all([
   supabase.from('participants').select('*').order('created_at',{ascending:false}),
   supabase.from('attendance').select('participant_id,time').order('time',{ascending:false})
  ]);
  if(pe)throw pe;
  if(ae)throw ae;
  data.participants=(participants||[]).map(p=>({id:p.id,name:p.name,phone:p.phone||'',village:p.village||'',district:p.district||'',regency:p.regency||''}));
  data.attendance=(attendance||[]).map(a=>({id:a.participant_id,time:a.time}));
  data.participants.forEach(rememberAddress);
  render();

  if(!initialized){
   initialized=true;
   if(data.participants.length===0 && localBeforeRemote.participants.length>0){
    await migrateLocalData(localBeforeRemote);
    return;
   }
  }
  cacheData();
 }catch(error){
  console.error('Supabase load error:',error);
  if(!initialized){
   data=localBeforeRemote;
   data.participants.forEach(rememberAddress);
   render();
   toast('Database online belum siap. Periksa tabel/RLS Supabase.');
   initialized=true;
  }
 }finally{loadingData=false}
}

async function migrateLocalData(local){
 try{
  const {error:pe}=await supabase.from('participants').upsert(local.participants.map(p=>({id:p.id,name:p.name,phone:p.phone||'',village:p.village||'',district:p.district||'',regency:p.regency||''})),{onConflict:'id'});
  if(pe)throw pe;
  if(local.attendance.length){
   const {error:ae}=await supabase.from('attendance').upsert(local.attendance.map(a=>({participant_id:a.id,time:a.time})),{onConflict:'participant_id'});
   if(ae)throw ae;
  }
  data={participants:local.participants,attendance:local.attendance};
  data.participants.forEach(rememberAddress);
  cacheData();
  render();
  toast('Data lokal berhasil dipindahkan ke database online.');
 }catch(error){
  console.error('Migration error:',error);
  data=local;
  render();
  toast(`Gagal memindahkan data: ${error.message||'periksa konfigurasi Supabase'}`);
 }
}

function subscribeRealtime(){
 if(realtimeChannel)return;
 realtimeChannel=supabase.channel('maskana-db-changes')
  .on('postgres_changes',{event:'*',schema:'public',table:'participants'},()=>loadRemoteData())
  .on('postgres_changes',{event:'*',schema:'public',table:'attendance'},()=>loadRemoteData())
  .subscribe(status=>console.log('Supabase Realtime:',status));
}

function showQR(id){const p=data.participants.find(x=>x.id===id); if(!p)return; activeCardParticipant=p; $('#cardName').textContent=p.name;$('#cardAddress').textContent=`${p.village}, ${p.district}, ${p.regency}`;$('#cardPhone').textContent=p.phone;const box=$('#qrCode');box.innerHTML='';new QRCode(box,{text:p.id,width:160,height:160,colorDark:'#073d39',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});$('#qrModal').showModal()}
async function cardFile(){const canvas=await html2canvas($('#participantCard'),{scale:3,useCORS:true,backgroundColor:null});const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));return new File([blob],`kartu-qr-${activeCardParticipant.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png`,{type:'image/png'})}
async function downloadCard(){if(!activeCardParticipant||!window.html2canvas){toast('Fitur unduh belum siap. Periksa koneksi internet.');return}const button=$('#downloadCard');button.disabled=true;button.textContent='Menyiapkan...';try{const file=await cardFile();const link=document.createElement('a');link.download=file.name;link.href=URL.createObjectURL(file);link.click();URL.revokeObjectURL(link.href);toast('Kartu QR berhasil diunduh.')}catch(error){toast('Kartu belum dapat diunduh. Coba lagi.')}finally{button.disabled=false;button.textContent='⇩ Unduh PNG'}}
async function sendWhatsApp(){if(!activeCardParticipant||!window.html2canvas){toast('Fitur kartu belum siap. Periksa koneksi internet.');return}const button=$('#sendWhatsApp');button.disabled=true;button.textContent='Menyiapkan kartu...';try{const file=await cardFile();const p=activeCardParticipant;const text=`Kartu peserta ${p.name} — Pertemuan Warga Maskana Bersatu. Mohon simpan dan tunjukkan QR saat registrasi.`;if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({title:'Kartu QR Peserta',text,files:[file]});toast('Pilih WhatsApp pada menu berbagi untuk mengirim kartu.')}else{const link=document.createElement('a');link.download=file.name;link.href=URL.createObjectURL(file);link.click();URL.revokeObjectURL(link.href);toast('Browser ini belum mendukung kirim lampiran langsung. Kartu diunduh—lampirkan pada WhatsApp.')}}catch(error){if(error.name!=='AbortError')toast('Kartu belum dapat dikirim. Coba lagi.')}finally{button.disabled=false;button.textContent='◉ Kirim kartu ke WhatsApp'}}

async function recordScan(code){
 const p=data.participants.find(x=>x.id.toLowerCase()===code.trim().toLowerCase());
 $('#scanInput').value='';
 if(!p){toast('Kode QR tidak ditemukan.');$('#scanResult').innerHTML=`<div class="result-card"><div class="success-icon" style="background:#fff0ee;color:#da6c60">!</div><h2>Kode tidak ditemukan</h2><p>Pastikan QR berasal dari aplikasi ini.</p></div>`;return}
 const existing=data.attendance.find(a=>a.id===p.id);
 if(existing){toast(`${p.name} sudah tercatat hadir.`);$('#scanResult').innerHTML=resultHTML(p,existing.time,true);return}
 const time=new Date().toISOString();
 const {error}=await supabase.from('attendance').insert({participant_id:p.id,time});
 if(error){
  // Jika dua perangkat melakukan scan hampir bersamaan, unique constraint menjaga satu kehadiran.
  if(error.code==='23505'){
   await loadRemoteData();
   const latest=data.attendance.find(a=>a.id===p.id);
   toast(`${p.name} sudah tercatat hadir.`);
   $('#scanResult').innerHTML=resultHTML(p,latest?.time||time,true);
   return;
  }
  console.error(error);
  toast(`Gagal menyimpan kehadiran: ${error.message||'error database'}`);
  return;
 }
 data.attendance.unshift({id:p.id,time});
 cacheData();
 render();
 $('#scanResult').innerHTML=resultHTML(p,time,false);
 toast(`Kehadiran ${p.name} berhasil dicatat!`);
}
function resultHTML(p,time,already){return `<div class="result-card"><div class="success-icon">${already?'i':'✓'}</div><h2>${already?'Sudah tercatat hadir':'Kehadiran berhasil!'}</h2><p>${already?'Peserta ini telah dipindai sebelumnya.':'Data kehadiran tersimpan secara online.'}</p><span class="avatar" style="margin:0 auto 10px;width:42px;height:42px">${initials(p.name)}</span><h3 style="margin:0;font-size:15px">${esc(p.name)}</h3><div class="result-details"><p>Desa <b>${esc(p.village)}</b></p><p>Kecamatan <b>${esc(p.district)}</b></p><p>Waktu hadir <b>${fmtTime(time)}</b></p></div></div>`}
function exportCSV(){const rows=[['Nama','Desa','Kecamatan','Kabupaten','WhatsApp','Waktu Hadir'],...data.participants.map(p=>{const a=data.attendance.find(a=>a.id===p.id);return[p.name,p.village,p.district,p.regency,p.phone,a?new Date(a.time).toLocaleString('id-ID'):'Belum hadir']})];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='rekap-absensi-maskana.csv';a.click();URL.revokeObjectURL(a.href);toast('Data rekap berhasil diunduh.')}

document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav-item,.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active');$('#pageTitle').textContent=b.dataset.tab==='dashboard'?'Selamat datang 👋':b.textContent.trim();if(b.dataset.tab==='scan')setTimeout(()=>$('#scanInput').focus(),100)});
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>document.querySelector(`.nav-item[data-tab="${b.dataset.go}"]`).click());
$('#addParticipant').onclick=()=>$('#participantModal').showModal();
$('#villageInput').addEventListener('input',autoFillAddress);
$('#villageInput').addEventListener('change',autoFillAddress);
$('#participantForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const f=new FormData(e.target), name=f.get('name').trim();
 const p={id:'HK-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),name,phone:f.get('phone').trim(),village:f.get('village').trim(),district:f.get('district').trim(),regency:f.get('regency').trim()};
 const button=e.target.querySelector('button[type="submit"]'); if(button)button.disabled=true;
 try{
  const {error}=await supabase.from('participants').insert({id:p.id,name:p.name,phone:p.phone,village:p.village,district:p.district,regency:p.regency});
  if(error)throw error;
  data.participants.unshift(p); rememberAddress(p); cacheData(); e.target.reset(); $('#participantModal').close(); render(); showQR(p.id); toast('Peserta dan QR berhasil dibuat online.');
 }catch(error){console.error(error);toast(`Gagal menambah peserta: ${error.message||'error database'}`)}finally{if(button)button.disabled=false}
});
$('#scanInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();recordScan(e.target.value)}});
$('#participantSearch').oninput=renderParticipants;
$('#attendanceSearch').oninput=renderAttendance;
document.addEventListener('click',async e=>{
 if(e.target.dataset.qr)showQR(e.target.dataset.qr);
 if(e.target.dataset.delete){
  const p=data.participants.find(x=>x.id===e.target.dataset.delete);
  if(!p)return;
  if(confirm(`Hapus ${p.name}?`)){
   try{
    const {error}=await supabase.from('participants').delete().eq('id',p.id);
    if(error)throw error;
    data.participants=data.participants.filter(x=>x.id!==p.id);data.attendance=data.attendance.filter(x=>x.id!==p.id);cacheData();render();toast('Peserta dihapus dari database online.');
   }catch(error){console.error(error);toast(`Gagal menghapus peserta: ${error.message||'error database'}`)}
  }
 }
});
$('.close-qr').onclick=()=>$('#qrModal').close();
$('#downloadCard').onclick=downloadCard;
$('#sendWhatsApp').onclick=sendWhatsApp;
$('#exportBtn').onclick=exportCSV;
$('#exportBtn2').onclick=exportCSV;

(async function init(){
 render();
 await loadRemoteData();
 subscribeRealtime();
})();
