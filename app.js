// EmasKu Digital — browser client uses publishable key only. Never place service-role keys here.
const SUPABASE_URL='https://aqksufbyxrcuwurevtep.supabase.co';
const SUPABASE_KEY='sb_publishable_J0Pum85QiME0LR6VVtESsw_xGECMl6s';
const db=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const money=n=>'Rp'+new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(Number(n)||0);
let signupMode=false,profile=null,product=null;
function showAuth(){ $('#authDialog').showModal(); }
function authMessage(t){$('#authMessage').textContent=t||'';}
function safeText(el,t){el.textContent=t??'';}
async function loadProduct(){
 if(!db)return;
 const {data,error}=await db.from('gold_products').select('id,name,description,price_per_gram,active,created_at').eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error){safeText($('#goldPrice'),'Harga belum tersedia');safeText($('#priceSource'),'Data harga belum dapat dimuat');return;}
 product=data;
 if(data){safeText($('#goldPrice'),money(data.price_per_gram)+' / gram');safeText($('#priceSource'),data.name+' · harga database');}
 else{safeText($('#goldPrice'),'Belum ada harga aktif');safeText($('#priceSource'),'Admin/mitra belum menerbitkan harga');}
}
async function loadUser(){
 if(!db){safeText($('#accountState'),'Koneksi database gagal dimuat. Periksa koneksi internet.');return;}
 const {data:{user}}=await db.auth.getUser();
 if(!user){profile=null;safeText($('#accountState'),'Kamu belum masuk.');safeText($('#grams'),'— gram');safeText($('#rupiah'),'Masuk untuk melihat saldo');safeText($('#refcode'),'—');$('#copyBtn').disabled=true;safeText($('#history'),'Masuk untuk melihat aktivitas.');return;}
 const {data:p,error}=await db.from('member_profiles').select('user_id,full_name,referral_code,created_at').eq('user_id',user.id).maybeSingle();
 profile=p;safeText($('#accountState'),(p?.full_name||user.email)+' · '+user.email);
 safeText($('#refcode'),p?.referral_code||'Kode belum tersedia');$('#copyBtn').disabled=!p?.referral_code;
 const {data:{session}}=await db.auth.getSession();if(!session){safeText($('#history'),'Sesi habis. Masuk kembali.');return;}
 try{
  const response=await fetch(SUPABASE_URL+'/functions/v1/member-api',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'account'})});
  const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Gagal memuat akun');
  safeText($('#rupiah'),money(payload.cashBalance)+' · saldo rupiah tercatat');
  safeText($('#grams'),Number(payload.goldBalance||0).toFixed(4).replace('.',',')+' gram');
  const rows=(payload.cashLedger||[]).slice(0,20);
  safeText($('#history'),rows.length?rows.map(x=>new Date(x.created_at).toLocaleString('id-ID')+' · '+x.entry_type+' · '+money(x.amount)+' · '+x.status).join('\\n'):'Belum ada aktivitas.');
 }catch(err){safeText($('#history'),'Data akun belum dapat dimuat: '+err.message);}
}
async function submitAuth(e){
 e.preventDefault();if(!db){authMessage('Database tidak tersedia.');return;}
 const email=$('#email').value.trim(),password=$('#password').value;
 $('#submitAuth').disabled=true;authMessage('Memproses…');
 try{
  if(signupMode){
   const full_name=$('#fullName').value.trim();if(!full_name){authMessage('Isi nama lengkap.');return;}
   let referred_by=null;const code=$('#refInput').value.trim().toUpperCase();
   if(code){
    const {data:matches,error:lookupError}=await db.rpc('lookup_referral_code',{p_code:code});
    if(lookupError)throw lookupError;
    if(!matches?.length){authMessage('Kode referral tidak ditemukan. Periksa kode pengundang.');return;}
    referred_by=matches[0].referrer_id;
   }
   const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name,...(referred_by?{referred_by}:{})}}});
   if(error)throw error;
   authMessage(data.session?'Akun dibuat.':'Cek email untuk verifikasi, lalu masuk.');
   if(data.session){$('#authDialog').close();await loadUser();}
  }else{
   const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;
   $('#authDialog').close();await loadUser();
  }
 }catch(err){authMessage(err.message||'Gagal memproses akun.');}
 finally{$('#submitAuth').disabled=false;}
}
$('#loginBtn').onclick=showAuth;$('#startBtn').onclick=showAuth;$('#closeAuth').onclick=()=>$('#authDialog').close();
$('#toggleAuth').onclick=()=>{signupMode=!signupMode;$('#authTitle').textContent=signupMode?'Buat akun EmasKu':'Masuk ke EmasKu';$('#fullName').parentElement.hidden=!signupMode;$('#refInput').parentElement.hidden=!signupMode;$('#toggleAuth').textContent=signupMode?'Saya sudah punya akun':'Buat akun';$('#submitAuth').textContent=signupMode?'Daftar':'Masuk';$('#password').autocomplete=signupMode?'new-password':'current-password';authMessage('');};
$('#authForm').addEventListener('submit',submitAuth);
$('#copyBtn').onclick=async()=>{if(!profile?.referral_code)return;try{await navigator.clipboard.writeText(profile.referral_code);safeText($('#refInfo'),'Kode referral berhasil disalin.');}catch{safeText($('#refInfo'),'Kode referral: '+profile.referral_code);}};
$('#tradeBtn').onclick=()=>alert('Transaksi belum diaktifkan karena settlement mitra/pembayaran belum terhubung dan diuji.');
$('#fullName').parentElement.hidden=true;$('#refInput').parentElement.hidden=true;
if(db){db.auth.onAuthStateChange(()=>{setTimeout(loadUser,0);});loadProduct();loadUser();}
else{safeText($('#goldPrice'),'Koneksi gagal');safeText($('#accountState'),'Pustaka autentikasi gagal dimuat.');}
