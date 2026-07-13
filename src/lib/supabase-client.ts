import { createBrowserClient } from "@supabase/ssr";

// 실제 환경 변수가 있으면 쓰고, 없으면 공백 문자열처리
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// 💡 v0가 환경 변수를 못 읽어 에러를 뿜는 현상을 완벽히 우회
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);