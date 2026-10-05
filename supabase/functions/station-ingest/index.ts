// Deploy with JWT verification disabled; this endpoint authenticates each station by its own secret.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json'}});
Deno.serve(async request => {
  if(request.method !== 'POST') return reply({error:'POST required'},405);
  const token=request.headers.get('x-station-token');
  if(!token || token.length < 32) return reply({error:'Invalid station token'},401);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const hash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:station,error:authError}=await db.from('stations').select('patient_id').eq('token_hash',hash).maybeSingle();
  if(authError || !station) return reply({error:'Unauthorized'},401);
  let input: any; try { input=await request.json(); } catch {return reply({error:'Invalid JSON'},400);}
  const {type,payload}=input || {};
  if(!payload || typeof payload !== 'object' || Array.isArray(payload)) return reply({error:'Invalid payload'},400);
  let table:string; let values:Record<string,unknown>;
  if(type==='vital') {
    const allowed=['recorded_at','heart_rate','spo2','temperature_c','systolic','diastolic'];
    values=Object.fromEntries(allowed.filter(k=>payload[k]!==undefined).map(k=>[k,payload[k]])); table='vitals';
  } else if(type==='dose_event') {
    if(!['dispensed','taken','missed'].includes(payload.kind) || typeof payload.message!=='string' || payload.message.length>500) return reply({error:'Invalid event'},400);
    values={kind:payload.kind,message:payload.message,occurred_at:payload.occurred_at,medication_id:payload.medication_id};table='dose_events';
  } else if(type==='medication') {
    if(typeof payload.name!=='string' || typeof payload.dose!=='string' || !Array.isArray(payload.times)) return reply({error:'Invalid medication'},400);
    values={name:payload.name,dose:payload.dose,times:payload.times,instructions:payload.instructions,next_refill:payload.next_refill};table='medications';
  } else return reply({error:'Unknown type'},400);
  values=Object.fromEntries(Object.entries(values).filter(([,v])=>v!==undefined));
  const {data,error}=await db.from(table).insert({...values,patient_id:station.patient_id}).select('id').single();
  return error ? reply({error:error.message},400) : reply({id:data.id},201);
});
