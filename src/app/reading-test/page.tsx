import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import StepTestClient from "./StepTestClient";

export default async function Page() {
  const cookieStore = cookies();

  // 🔥 1. 먼저 서버용 supabase 생성
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );


const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  redirect("/login");
}

return <StepTestClient user={user} />;
}