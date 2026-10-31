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
 profile=p;
 safeText($('#accountState'),(p?.full_name||user.email)+' · '+user.email);
 safeText($('#refcode'),p?.referral_code||'Kode belum tersedia');$('#copyBtn').disabled=!p?.referral_code;
 const {data:ledger}=await db.from('wallet_ledger').select('entry_type,amount,status,created_at,note').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20);
 const posted=(ledger||[]).filter(x=>x.status==='posted').reduce((sum,x)=>sum+((['refund_credit','commission_credit','adjustment'].includes(x.entry_type)?1:-1)*Number(x.amount)),0);
 safeText($('#rupiah'),money(posted)+' · saldo rupiah tercatat');
 safeText($('#history'),ledger?.length?ledger.map(x=>new Date(x.created_at).toLocaleString('id-ID')+' · '+x.entry_type+' · '+money(x.amount)+' · '+x.status).join('\n'):'Belum ada aktivitas.');
 // Gold balance is deliberately not inferred from a cash ledger; requires a verified custody/holdings ledger.
 safeText($('#grams'),'— gram');
}
async function submitAuth(e){
 e.preventDefault();if(!db){authMessage('Database tidak tersedia.');return;}
 const email=$('#email').value.trim(),password=$('#password').value;
 $('#submitAuth').disabled=true;authMessage('Memproses…');
 try{
  if(signupMode){
   const full_name=$('#fullName').value.trim();if(!full_name){authMessage('Isi nama lengkap.');return;}
   let referred_by=null;const code=$('#refInput').value.trim().toUpperCase();
   if(code){const {data:ref}=await db.from('member_profiles').select('user_id').eq('referral_code',code).maybeSingle();if(!ref){authMessage('Kode referral tidak ditemukan.');return;}referred_by=ref.user_id;}
   const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name}}});
   if(error)throw error;
   if(data.user && data.session){
    const {error:pe}=await db.from('member_profiles').upsert({user_id:data.user.id,full_name,referred_by},{onConflict:'user_id'});if(pe)throw pe;
   }
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
