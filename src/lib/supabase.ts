import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cliente público — usar en componentes y rutas de lectura */
export const supabase = createClient(supabaseUrl, supabaseAnon);

/** Cliente con service role — usar SOLO en rutas API del servidor (nunca en el cliente) */
export function supabaseServer() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
