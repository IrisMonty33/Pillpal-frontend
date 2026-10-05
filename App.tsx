import React,  {useCallback,  useEffect,  useState} from 'react';
import {ActivityIndicator,  Alert,  FlatList,  RefreshControl,  SafeAreaView,  ScrollView,  StatusBar,  StyleSheet,  Text,  TextInput,  TouchableOpacity,  View} from 'react-native';
import {db,  configured,  demoEvents,  demoMeds,  demoVitals,  Event,  Medication,  Vital } from './src/data';

type Page = 'Home' | 'Reports' | 'Reminders' | 'Medications' | 'Schedule' | 'Settings' | 'Help';
const coral = '#FF6657',  ink = '#23313B',  muted = '#687983';
const date = (value: string) => new Date(value).toLocaleString(undefined,  { month:'short',  day:'numeric',  hour:'numeric',  minute:'2-digit' });
const time = (s:string) => {const [h, m] = s.split(':').map(Number);
  return new Date(2020, 0, 1, h, m).toLocaleTimeString([],  {hour:'numeric', minute:'2-digit'}); 
};

export default function App() {
  const [page, setPage] = useState<Page>('Home');
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [meds, setMeds] = useState<Medication[]>(configured ? [] : demoMeds);
  const [vitals, setVitals] = useState<Vital[]>(configured ? [] : demoVitals);
  const [events, setEvents] = useState<Event[]>(configured ? [] : demoEvents);
  const [role, setRole] = useState('patient');
  const [patientId, setPatientId] = useState<string | null>(null);
  
  useEffect(() => {if (!db) return; 
    db.auth.getSession().then(({data}) => setSession(data.session)); 
    const {data:{subscription}} = db.auth.onAuthStateChange((_event, s)=>setSession(s));
    return ()=>subscription.unsubscribe(); 
  },  []);
  
  const load = useCallback(async () => {
    if (!db || !session)
      return;

    setError('');

    // get patient
    const membership = await db.from('patient_access').select('patient_id, role').eq('user_id', session.user.id).limit(1).maybeSingle();
    
    // patient error check
    if (membership.error) {
      setError(membership.error.message);
      return;
    }
    
    // get patient
    const id = membership.data?.patient_id;
    setPatientId(id || null);
    setRole(membership.data?.role || 'patient');
    
    const [m, v, e] = await Promise.all([
      db.from('medications').select('id, name, dose, instructions, times, next_refill').eq('patient_id', id).order('name'), 
      db.from('vitals').select('id, recorded_at, heart_rate, spo2, temperature_c, systolic, diastolic').eq('patient_id', id).order('recorded_at', {ascending:false}).limit(50), 
      db.from('dose_events').select('id, kind, message, occurred_at, medication_id').eq('patient_id', id).order('occurred_at', {ascending:false}).limit(100)
    ]);

    // error handling
    const failure = [m.error, v.error, e.error].find(Boolean); 
    if (failure) 
      setError(failure.message);

    // given empty user
    if (!id) {
      setMeds([]); setVitals([]); setEvents([]); 
      return; 
    }

    else {
      setMeds(m.data as Medication[]);setVitals(v.data as Vital[]);setEvents(e.data as Event[]);
    }

  }, [session]);

  useEffect(()=>{load();}, [load]);
  useEffect(()=>{if (!db || !patientId) 
    return; 
    
  const channel = db.channel('patient-updates').on('postgres_changes', {event:'*', schema:'public', table:'vitals', filter:`patient_id=eq.${patientId}`},  load).on('postgres_changes',  {event:'*',  schema:'public', table:'dose_events', filter:`patient_id=eq.${patientId}`}, load).on('postgres_changes', {event:'*', schema:'public', table:'medications', filter:`patient_id=eq.${patientId}`}, load).subscribe();return ()=>{db!.removeChannel(channel);};}, [patientId, load]);
  
  const refresh=async()=>{setRefreshing(true);await load();setRefreshing(false);};
  const signIn=async()=>{if(!db)return;setBusy(true);const {error:e}=await db.auth.signInWithPassword({email:email.trim(), password});setBusy(false);if(e)Alert.alert('Sign in failed', e.message);};
  const signUp=async()=>{if(!db)return;setBusy(true);const {error:e}=await db.auth.signUp({email:email.trim(), password});setBusy(false);Alert.alert(e?'Sign up failed':'Check your email', e?.message || 'Confirm your address,  then sign in. Ask your device administrator to link your account to a patient.');};
  const card=(children:React.ReactNode)=><View style={styles.card}>{children}</View>;
  const label=(value:string)=><Text style={styles.label}>{value}</Text>;
  const empty=(message:string)=><Text style={styles.empty}>{message}</Text>;
  const header=<View style={styles.header}><Text style={styles.brand}>PillPal</Text><Text style={styles.subhead}>{configured ? (role==='caregiver'?'Caregiver view':'Patient view') : 'User\'s name'}</Text></View>;
  
  if(configured && !session) 
    return <SafeAreaView style={styles.root}><StatusBar barStyle="dark-content"/>{header}<View style={styles.login}>{label('Welcome back')}<Text style={styles.p}>Sign in to see your connected medication station.</Text><TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/><TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword}/><TouchableOpacity style={styles.button} onPress={signIn} disabled={busy}><Text style={styles.buttonText}>{busy?'Please wait…':'Sign in'}</Text></TouchableOpacity><TouchableOpacity onPress={signUp} disabled={busy}><Text style={styles.link}>Create an account</Text></TouchableOpacity></View></SafeAreaView>;
  
  // page initiation
  const tiles:Page[]=['Reports', 'Reminders', 'Medications', 'Schedule', 'Settings', 'Help'];
  const content=()=>{
    if(page==='Home') return <><Text style={styles.title}>Your health,  at a glance</Text>{card(<><Text style={styles.label}>Next dose</Text><Text style={styles.big}>{meds.flatMap(m=>m.times.map(t=>({m, t}))).sort((a, b)=>a.t.localeCompare(b.t))[0]?.m.name || 'No doses scheduled'}</Text><Text style={styles.p}>See Schedule for all dose times</Text></>)}<View style={styles.grid}>{tiles.map((t, i)=><TouchableOpacity accessibilityRole="button" key={t} style={styles.tile} onPress={()=>setPage(t)}><Text style={styles.tileIcon}>{['▤', '◉', '✚', '▦', '⚙', '?'][i]}</Text><Text style={styles.tileText}>{t}</Text></TouchableOpacity>)}</View></>;
    if(page==='Reports') return <><Text style={styles.title}>Vitals reports</Text><Text style={styles.p}>Measurements recorded by the station.</Text>{vitals.length ? vitals.map(v=><View key={v.id}>{card(<><Text style={styles.date}>{date(v.recorded_at)}</Text><View style={styles.vitalGrid}><Text style={styles.metric}>♥  {v.heart_rate ?? '—'} <Text style={styles.unit}>bpm</Text></Text><Text style={styles.metric}>O₂  {v.spo2 ?? '—'} <Text style={styles.unit}>%</Text></Text><Text style={styles.metric}>☼  {v.temperature_c ?? '—'} <Text style={styles.unit}>°C</Text></Text><Text style={styles.metric}>BP  {v.systolic ?? '—'}/{v.diastolic ?? '—'}</Text></View></>)}</View>) : empty('No measurements yet. Readings from your station will appear here.')}</>;
    if(page==='Reminders') return <><Text style={styles.title}>Reminders</Text><Text style={styles.p}>Dose activity from your station,  newest first.</Text>{events.length ? events.map(e=><View key={e.id}>{card(<><Text style={[styles.badge, e.kind==='missed'&&styles.alert]}>{e.kind.toUpperCase()}</Text><Text style={styles.label}>{e.message}</Text><Text style={styles.date}>{date(e.occurred_at)}</Text></>)}</View>) : empty('No dose notifications yet.')}</>;
    if(page==='Medications') return <><Text style={styles.title}>Medications</Text><Text style={styles.p}>Managed on your station touchscreen.</Text>{meds.length ? meds.map(m=><View key={m.id}>{card(<><Text style={styles.label}>{m.name}</Text><Text style={styles.p}>{m.dose}</Text><Text style={styles.p}>{m.times.map(time).join(' · ')}</Text>{m.instructions&&<Text style={styles.date}>{m.instructions}</Text>}{m.next_refill&&<Text style={styles.date}>Refill: {m.next_refill}</Text>}</>)}</View>) : empty('No medications synced yet.')}</>;
    if(page==='Schedule') return <><Text style={styles.title}>Daily schedule</Text><Text style={styles.p}>A quick view of planned doses.</Text>{meds.length ? meds.flatMap(m=>m.times.map(t=>({m, t}))).sort((a, b)=>a.t.localeCompare(b.t)).map(({m, t}, i)=><View key={m.id+t+i}>{card(<View style={styles.row}><Text style={styles.scheduleTime}>{time(t)}</Text><View style={{flex:1}}><Text style={styles.label}>{m.name}</Text><Text style={styles.p}>{m.dose}</Text></View></View>)}</View>) : empty('No doses scheduled.')}</>;
    if(page==='Settings') return <><Text style={styles.title}>Settings</Text>{card(<><Text style={styles.label}>Connection</Text><Text style={styles.p}>{configured?'Supabase connected':'Preview mode: add Supabase environment variables to connect.'}</Text><Text style={styles.p}>Access: {role}</Text>{configured&&<TouchableOpacity onPress={()=>db?.auth.signOut()}><Text style={styles.link}>Sign out</Text></TouchableOpacity>}</>)}</>;
    return <><Text style={styles.title}>Help</Text>{card(<><Text style={styles.label}>Using PillPal</Text><Text style={styles.p}>Set medication names,  doses and times on the station touchscreen. Reports and dose activity will sync here when the station is online.</Text><Text style={styles.p}>If a dose is missed,  check the station and contact your care team if needed. This app does not provide medical advice.</Text></>)}</>;
  };
  return <SafeAreaView style={styles.root}><StatusBar barStyle="dark-content"/>{header}<ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh}/>}>{page!=='Home'&&<TouchableOpacity onPress={()=>setPage('Home')}><Text style={styles.back}>‹  Home</Text></TouchableOpacity>}{error ? <Text style={styles.error}>{error}</Text> : null}{configured&&!patientId ? <Text style={styles.notice}>No patient is linked to this account yet. Ask the station administrator to grant access.</Text> : null}{content()}</ScrollView><View style={styles.nav}>{(['Home', 'Reports', 'Reminders', 'Medications', 'Schedule'] as Page[]).map(p=><TouchableOpacity key={p} onPress={()=>setPage(p)} style={styles.navItem}><Text style={[styles.navText, page===p&&styles.active]}>{p}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}

// general style initiation
const styles=StyleSheet.create({root:{flex:1, backgroundColor:'#F9F8F3'}, header:{backgroundColor:coral, paddingHorizontal:24, paddingTop:18, paddingBottom:18}, brand:{fontSize:29, fontWeight:'800', color:'#fff'}, subhead:{color:'#fff', marginTop:3}, body:{padding:20, paddingBottom:40}, title:{fontSize:25, fontWeight:'800', color:ink, marginBottom:10}, p:{color:muted, fontSize:15, lineHeight:22, marginTop:5}, card:{backgroundColor:'#fff', borderRadius:16, padding:18, marginBottom:12, borderWidth:1, borderColor:'#E7E9E8'}, label:{fontSize:17, fontWeight:'700', color:ink}, big:{fontSize:25, fontWeight:'800', color:ink, marginTop:10}, grid:{flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginTop:13}, tile:{backgroundColor:'#71CEE1', width:'48%', height:125, borderRadius:16, alignItems:'center', justifyContent:'center', marginBottom:13}, tileIcon:{fontSize:42, color:'#fff', fontWeight:'700'}, tileText:{fontWeight:'700', fontSize:16, color:ink, marginTop:4}, date:{color:muted, fontSize:13, marginTop:7}, vitalGrid:{flexDirection:'row', flexWrap:'wrap', marginTop:10}, metric:{width:'50%', fontSize:19, fontWeight:'700', color:ink, marginVertical:7}, unit:{fontSize:13, color:muted}, badge:{color:'#087F72', fontWeight:'800', fontSize:12, marginBottom:8}, alert:{color:'#C83D37'}, row:{flexDirection:'row', alignItems:'center', gap:16}, scheduleTime:{width:85, color:coral, fontWeight:'800', fontSize:17}, empty:{color:muted, textAlign:'center', paddingVertical:32}, back:{color:coral, fontWeight:'700', marginBottom:15, fontSize:16}, nav:{flexDirection:'row', backgroundColor:'#fff', borderTopWidth:1, borderColor:'#E7E9E8', paddingVertical:15}, navItem:{flex:1, alignItems:'center'}, navText:{fontSize:11, color:muted, fontWeight:'600'}, active:{color:coral}, login:{padding:25, marginTop:35}, input:{backgroundColor:'#fff', borderWidth:1, borderColor:'#DEE3E4', borderRadius:10, padding:14, marginTop:15, fontSize:16}, button:{backgroundColor:coral, borderRadius:10, padding:16, alignItems:'center', marginTop:20}, buttonText:{color:'#fff', fontWeight:'700', fontSize:16}, link:{color:coral, fontWeight:'700', marginTop:20}, error:{color:'#C83D37', marginBottom:10}, notice:{backgroundColor:'#FFF0CF', padding:12, borderRadius:8, marginBottom:14, color:ink}});
