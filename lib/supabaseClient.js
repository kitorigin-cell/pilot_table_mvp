// lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// Клиентский ключ для использования в браузере (безопасный)
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export { supabaseClient };