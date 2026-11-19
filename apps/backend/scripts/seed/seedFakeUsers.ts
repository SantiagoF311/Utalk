// Siembra usuarios ficticios realistas para pruebas manuales/exploratorias:
// 3 de la USTA y 3 de la Cooperativa (UCC), con correo institucional real
// (nombre.apellido@dominio) y un apodo anónimo, como lo vería cualquier
// usuario real de la app (UTalk es anónima por diseño: el nombre real solo
// vive en el email de auth.users, nunca en profiles.username).
//
// Uso: node --loader ts-node/esm --experimental-specifier-resolution=node scripts/seed/seedFakeUsers.ts

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from '../perf/loadEnv.js';

const PASSWORD = 'fake-user-password-123';

interface FakeUser {
  fullName: string;
  email: string;
  username: string;
  universitySlug: string;
}

const USERS: FakeUser[] = [
  {
    fullName: 'Carlos Ulloa',
    email: 'carlos.ulloa@campusucc.edu.co',
    username: 'lobo_andino',
    universitySlug: 'ucc',
  },
  {
    fullName: 'Valentina Rojas',
    email: 'valentina.rojas@campusucc.edu.co',
    username: 'luna_cafetera',
    universitySlug: 'ucc',
  },
  {
    fullName: 'Juan Sebastián Pardo',
    email: 'juan.pardo@campusucc.edu.co',
    username: 'rio_nocturno',
    universitySlug: 'ucc',
  },
  {
    fullName: 'María Camila Torres',
    email: 'mariatorres@ustavillavo.edu.co',
    username: 'sol_llanero',
    universitySlug: 'ustavillavo',
  },
  {
    fullName: 'Andrés Felipe Gómez',
    email: 'andresgomez@ustavillavo.edu.co',
    username: 'tigre_silencioso',
    universitySlug: 'ustavillavo',
  },
  {
    fullName: 'Laura Daniela Herrera',
    email: 'lauraherrera@ustavillavo.edu.co',
    username: 'brisa_dorada',
    universitySlug: 'ustavillavo',
  },
];

const env = loadEnv();
const url = env.SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error('Faltan SUPABASE_URL / SUPABASE_SECRET_KEY en el .env de apps/backend');
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

async function findUniversityIdBySlug(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from('universities')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error) {
    throw new Error(
      `No se encontró la universidad "${slug}". Falta aplicar su migración de seed. Detalle: ${error.message}`,
    );
  }
  return data.id;
}

async function main(): Promise<void> {
  const universityIdBySlug = new Map<string, string>();
  for (const slug of new Set(USERS.map((u) => u.universitySlug))) {
    universityIdBySlug.set(slug, await findUniversityIdBySlug(slug));
  }

  for (const user of USERS) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });

    let userId: string;
    if (createError) {
      const { data: list, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) throw new Error(listError.message);
      const existing = list.users.find((u) => u.email === user.email);
      if (!existing) throw new Error(createError.message);
      userId = existing.id;
      console.log(`Ya existía: ${user.email}`);
    } else {
      userId = created.user.id;
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        username: user.username,
        university_id: universityIdBySlug.get(user.universitySlug),
      },
      { onConflict: 'id' },
    );
    if (profileError) throw new Error(profileError.message);

    console.log(`Listo: ${user.username} <${user.email}>`);
  }

  console.log(`\n${USERS.length} perfiles sembrados. Contraseña para todos: ${PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
