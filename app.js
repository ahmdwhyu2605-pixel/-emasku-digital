// EmasKu Digital frontend. Client uses publishable key only.
const SUPABASE_URL='https://aqksufbyxrcuwurevtep.supabase.co';
const SUPABASE_KEY='sb_publishable_J0Pum85QiME0LR6VVtESsw_xGECMl6s';
const db=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const money=n=>'Rp'+new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(Number(n)||0);
let signupMode=false,profile=null,product=null,captchaA=0,captchaB=0;
function safeText(el,t){if(el)el.textContent=t??'';}
function authMessage(t){safeText($('#authMessage'),t);}
function showAuth(){ refreshCaptcha(); $('#captchaLabel').hidden=false; $('#authDialog').showModal(); }
function refreshCaptcha(){captchaA=1+Math.floor(Math.random()*9);captchaB=1+Math.floor(Math.random()*9);safeText($('#captchaQuestion'),captchaA+' + '+captchaB+' = ?');$('#captchaAnswer').value='';}
async function currentSession(){const {data:{session}}=await db.auth.getSession();return session;}
async function loadProduct(){
 if(!db)return;
 const {data,error}=await db.from('gold_products').select('id,name,description,price_per_gram,active,created_at').eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error){safeText($('#goldPrice'),'Harga belum tersedia');safeText($('#priceSource'),'Gagal membaca database');return;}
 product=data;
 if(data){safeText($('#goldPrice'),money(data.price_per_gram)+' / gram');safeText($('#priceSource'),data.name+' · harga database');}
 else{safeText($('#goldPrice'),'Belum ada harga aktif');safeText($('#priceSource'),'Harga belum diterbitkan');}
}
async function loadUser(){
 if(!db){safeText($('#accountState'),'Database tidak dapat dimuat.');return;}
 const {data:{user}}=await db.auth.getUser();
 if(!user){profile=null;safeText($('#accountState'),'Kamu belum masuk.');safeText($('#grams'),'— gram');safeText($('#rupiah'),'Masuk untuk melihat saldo');safeText($('#refcode'),'—');$('#copyBtn').disabled=true;safeText($('#history'),'Masuk untuk melihat aktivitas.');return;}
 const {data:p,error}=await db.from('member_profiles').select('user_id,full_name,referral_code,created_at').eq('user_id',user.id).maybeSingle();
 if(error){safeText($('#accountState'),'Profil gagal dimuat: '+error.message);return;}
 profile=p;safeText($('#accountState'),(p?.full_name||user.email)+' · '+user.email);
 safeText($('#refcode'),p?.referral_code||'Kode belum tersedia');$('#copyBtn').disabled=!p?.referral_code;
 try{
  const session=await currentSession();if(!session)throw new Error('Sesi login habis.');
  const response=await fetch(SUPABASE_URL+'/functions/v1/member-api',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'account'})});
  const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Gagal membaca akun');
  safeText($('#rupiah'),money(payload.cashBalance)+' · saldo rupiah');safeText($('#grams'),Number(payload.goldBalance||0).toFixed(4).replace('.',',')+' gram');
  const rows=(payload.cashLedger||[]).slice(0,20);
  safeText($('#history'),rows.length?rows.map(x=>new Date(x.created_at).toLocaleString('id-ID')+' · '+x.entry_type+' · '+money(x.amount)+' · '+x.status).join('\n'):'Belum ada aktivitas.');
 }catch(err){safeText($('#history'),'Gagal memuat aktivitas: '+err.message);}
}
async function submitAuth(e){
 e.preventDefault();if(!db){authMessage('Database tidak tersedia.');return;}
 const email=$('#email').value.trim(),password=$('#password').value;
 $('#submitAuth').disabled=true;authMessage('Memproses…');
 try{
  if(Number($('#captchaAnswer').value)!==captchaA+captchaB){refreshCaptcha();authMessage('Jawaban hitungan salah. Coba lagi.');return;}
  if(signupMode){
   const full_name=$('#fullName').value.trim();if(!full_name){authMessage('Isi nama lengkap.');return;}
   let referred_by=null;const code=$('#refInput').value.trim().toUpperCase();
   if(code){const {data:matches,error}=await db.rpc('lookup_referral_code',{p_code:code});if(error)throw error;if(!matches?.length){authMessage('Kode referral tidak ditemukan.');return;}referred_by=matches[0].referrer_id;}
   const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name,...(referred_by?{referred_by}:{})}}});if(error)throw error;
   authMessage(data.session?'Akun dibuat, langsung masuk.':'Akun terdaftar, tetapi verifikasi email masih diwajibkan di Supabase.');
   if(data.session){$('#authDialog').close();await loadUser();}
  }else{const result=await Promise.race([db.auth.signInWithPassword({email,password}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Koneksi login terlalu lama. Coba lagi atau periksa internet.')),15000))]);if(result.error)throw result.error;$('#authDialog').close();safeText($('#accountState'),'Login berhasil. Memuat akun…');void loadUser();}
 }catch(err){authMessage(err.message||'Gagal memproses akun.');}
 finally{$('#submitAuth').disabled=false;}
}
async function trade(){
 const side=$('#tradeSide').value,grams=Number(String($('#tradeGrams').value).trim().replace(',','.'));
 if(!Number.isFinite(grams)||grams<=0){safeText($('#tradeMessage'),'Masukkan jumlah gram lebih dari 0 (contoh: 0,1).');return;}
 if(!product||!Number.isFinite(Number(product.price_per_gram))||Number(product.price_per_gram)<=0){safeText($('#tradeMessage'),'Transaksi belum bisa dijalankan: harga emas aktif masih Rp0 atau belum tersedia.');return;}
 $('#tradeBtn').disabled=true;safeText($('#tradeMessage'),'Memproses transaksi sandbox…');
 try{
  const session=await currentSession();if(!session){showAuth();throw new Error('Masuk terlebih dahulu.');}
  const {data,error}=await db.schema('public').rpc('sandbox_trade',{p_side:side,p_grams:grams});
  if(error)throw new Error(error.message||'Transaksi gagal.');
  safeText($('#tradeMessage'),(side==='buy'?'Pembelian':'Penjualan')+' berhasil (sandbox). Total: '+money(data.total_amount)+'.');
  await loadUser();
 }catch(err){safeText($('#tradeMessage'),'Transaksi gagal: '+err.message);}
 finally{$('#tradeBtn').disabled=false;}
}
$('#loginBtn').onclick=showAuth;$('#startBtn').onclick=showAuth;$('#closeAuth').onclick=()=>$('#authDialog').close();
$('#toggleAuth').onclick=()=>{signupMode=!signupMode;$('#authTitle').textContent=signupMode?'Buat akun EmasKu':'Masuk ke EmasKu';$('#fullNameLabel').hidden=!signupMode;$('#refInputLabel').hidden=!signupMode;$('#captchaLabel').hidden=false;refreshCaptcha();$('#toggleAuth').textContent=signupMode?'Saya sudah punya akun':'Buat akun';$('#submitAuth').textContent=signupMode?'Daftar':'Masuk';$('#password').autocomplete=signupMode?'new-password':'current-password';authMessage('');};
$('#authForm').addEventListener('submit',submitAuth);
$('#copyBtn').onclick=async()=>{if(!profile?.referral_code)return;try{await navigator.clipboard.writeText(profile.referral_code);safeText($('#refInfo'),'Kode referral disalin.');}catch{safeText($('#refInfo'),'Kode referral: '+profile.referral_code);}};
$('#tradeBtn').onclick=trade;
$('#fullNameLabel').hidden=true;$('#refInputLabel').hidden=true;
if(db){db.auth.onAuthStateChange(()=>setTimeout(loadUser,0));loadProduct();loadUser();}
else{safeText($('#goldPrice'),'Koneksi gagal');safeText($('#accountState'),'Pustaka Supabase gagal dimuat.');}
