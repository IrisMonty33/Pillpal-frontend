import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const db = configured ? createClient(url!, key!, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }) : null;
export type Medication = { id: string; name: string; dose: string; instructions: string | null; times: string[]; next_refill: string | null };
export type Vital = { id: string; recorded_at: string; heart_rate: number | null; spo2: number | null; temperature_c: number | null; systolic: number | null; diastolic: number | null };
export type Event = { id: string; kind: 'dispensed' | 'taken' | 'missed'; message: string; occurred_at: string; medication_id: string | null };
export const demoMeds: Medication[] = [
  { id: 'a', name: 'Lisinopril', dose: '10 mg · 1 tablet', instructions: 'Take with water', times: ['08:00'], next_refill: '2026-10-07' },
  { id: 'b', name: 'Metformin', dose: '500 mg · 1 tablet', instructions: 'Take with food', times: ['08:00','18:00'], next_refill: '2026-10-12' },
];
export const demoVitals: Vital[] = [
  { id: 'v1', recorded_at: new Date().toISOString(), heart_rate: 72, spo2: 98, temperature_c: 36.7, systolic: 118, diastolic: 76 },
  { id: 'v2', recorded_at: new Date(Date.now()-86400000).toISOString(), heart_rate: 75, spo2: 97, temperature_c: 36.8, systolic: 121, diastolic: 78 },
];
export const demoEvents: Event[] = [
  { id:'e1', kind:'taken', message:'Morning dose taken', occurred_at:new Date().toISOString(), medication_id:'a' },
  { id:'e2', kind:'dispensed', message:'Metformin is ready to take', occurred_at:new Date(Date.now()-3600000).toISOString(), medication_id:'b' },
];
