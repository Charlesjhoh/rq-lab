/**
 * 아이디(이메일)+비밀번호로 로그인할 수 있는 계정을 만든다.
 * 서비스는 기본적으로 이메일 인증번호 로그인인데, PG사 검수처럼 인증메일을
 * 받을 수 없는 쪽에 계정을 넘겨줘야 할 때 쓴다. 이미 있는 이메일이면 비밀번호만 바꾼다.
 *
 *   node scripts/create-password-user.mjs <email> <password>
 *
 * .env.local 의 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 사용.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("usage: node scripts/create-password-user.mjs <email> <password>");
  process.exit(1);
}
if (password.length < 6) {
  console.error("비밀번호는 6자 이상이어야 합니다.");
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function findUserByEmail(target) {
  const lower = target.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === lower);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
}

const existing = await findUserByEmail(email);
if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`기존 계정 비밀번호 설정 완료: ${email} (${existing.id})`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`새 계정 생성 완료: ${email} (${data.user.id})`);
}
