const SUPABASE_URL='https://clojzlftxumfreyrsugx.supabase.co';
const SUPABASE_KEY='sb_publishable_mH67_UIYRx069mQ0PJzpvQ_HIm3eFLZ';

export default async function handler(req,res){
  try{
    const response=await fetch(SUPABASE_URL+'/rest/v1/hdm_keepalive?id=eq.1',{
      method:'PATCH',
      headers:{
        apikey:SUPABASE_KEY,
        Authorization:'Bearer '+SUPABASE_KEY,
        'Content-Type':'application/json',
        Prefer:'return=minimal'
      },
      body:JSON.stringify({last_ping:new Date().toISOString()})
    });
    if(!response.ok){
      const body=await response.text();
      return res.status(500).json({ok:false,status:response.status,error:body.slice(0,300)});
    }
    return res.status(200).json({ok:true,at:new Date().toISOString()});
  }catch(error){
    return res.status(500).json({ok:false,error:String(error?.message||error)});
  }
}
