// Siembra datos para la ACQ de rendimiento del feed (GET /posts).
// Corre fuera de Nest: usa @supabase/supabase-js directo con la service
// role key, igual que SupabaseService, pero sin levantar el framework.
//
// Uso: npx ts-node --esm scripts/perf/seedFeedPerf.ts
// (desde apps/backend, con .env apuntando al proyecto de dev)
//
// `universities` es un catálogo cerrado (grant de solo SELECT a
// service_role, ver 20261104000000_grant_service_role_backend_tables.sql):
// el seed reusa una universidad ya existente en vez de crear una. Todo lo
// demás que crea (panel, comunidades, usuarios, posts) queda bajo el slug
// PERF_SLUG, para poder borrarlo después con cleanupFeedPerf.ts sin tocar
// datos reales.

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './loadEnv.js';

const PERF_SLUG = 'perf-test';
const USER_COUNT = 50;
const POST_COUNT = 5000;
const PASSWORD = 'perf-test-password-123';

const env = loadEnv();
const url = env.SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error('Faltan SUPABASE_URL / SUPABASE_SECRET_KEY en el .env de apps/backend');
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

async function findAnyUniversity(): Promise<{ id: string }> {
  const { data, error } = await supabase.from('universities').select('id').limit(1).single();
  if (error) {
    throw new Error(
      `No se pudo leer una universidad existente (el seed no crea universidades nuevas: ` +
        `es un catálogo cerrado). Detalle: ${error.message}`,
    );
  }
  return data;
}

// Panel general (university_id null): a diferencia del panel de una
// universidad, no choca con el unique de panels.university_id aunque la
// universidad reusada ya tenga uno.
async function upsertPanel(): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('panels')
    .upsert(
      { slug: PERF_SLUG, name: 'Panel de Perf Test', university_id: null },
      { onConflict: 'slug' },
    )
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// N comunidades dentro del mismo panel: el feed por panel mide el peor caso
// (join con communities + filtro por panel_id, sin índice dedicado), el feed
// por comunidad mide el caso indexado (posts_community_hot_idx y análogos).
async function upsertCommunities(
  panelId: string,
  createdBy: string,
  count: number,
): Promise<string[]> {
  const rows = Array.from({ length: count }, (_, i) => ({
    panel_id: panelId,
    slug: `${PERF_SLUG}-${i}`,
    name: `Comunidad Perf ${i}`,
    created_by: createdBy,
  }));
  const { data, error } = await supabase
    .from('communities')
    .upsert(rows, { onConflict: 'panel_id,slug' })
    .select('id');
  if (error) throw new Error(error.message);
  return (data as { id: string }[]).map((row) => row.id);
}

async function createUsers(
  universityId: string,
  count: number,
): Promise<{ id: string; email: string }[]> {
  const users: { id: string; email: string }[] = [];
  for (let i = 0; i < count; i++) {
    const email = `${PERF_SLUG}-user-${i}@perf-test.local`;
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (createError) {
      // Ya existe de una corrida anterior: se reusa.
      const { data: list, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) throw new Error(listError.message);
      const existing = list.users.find((u) => u.email === email);
      if (!existing) throw new Error(createError.message);
      users.push({ id: existing.id, email });
      continue;
    }
    users.push({ id: created.user.id, email });

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: created.user.id,
        username: `${PERF_SLUG}_${i}`,
        university_id: universityId,
      },
      { onConflict: 'id' },
    );
    if (profileError) throw new Error(profileError.message);
  }
  return users;
}

// Posts con score y antigüedad variados: sin esto, hot/top/new ordenan
// siempre igual y la prueba no ejercita de verdad el índice de sort.
async function seedPosts(
  communityIds: string[],
  authorIds: string[],
  count: number,
): Promise<void> {
  const BATCH = 500;
  const now = Date.now();
  for (let start = 0; start < count; start += BATCH) {
    const rows = Array.from({ length: Math.min(BATCH, count - start) }, (_, i) => {
      const n = start + i;
      const ageDays = (n % 365) + Math.random();
      return {
        community_id: communityIds[n % communityIds.length],
        author_id: authorIds[n % authorIds.length],
        title: `Post de perf test #${n}`,
        body: `Cuerpo del post de prueba de rendimiento número ${n}.`,
        score: Math.floor(Math.random() * 200) - 20,
        created_at: new Date(now - ageDays * 24 * 60 * 60 * 1000).toISOString(),
      };
    });
    const { error } = await supabase.from('posts').insert(rows);
    if (error) throw new Error(error.message);
    process.stdout.write(`\rPosts insertados: ${Math.min(start + BATCH, count)}/${count}`);
  }
  console.log();
}

async function main(): Promise<void> {
  console.log('Sembrando datos de perf test...');

  const university = await findAnyUniversity();
  const panel = await upsertPanel();
  const users = await createUsers(university.id, USER_COUNT);
  const communityIds = await upsertCommunities(panel.id, users[0].id, 10);
  await seedPosts(
    communityIds,
    users.map((u) => u.id),
    POST_COUNT,
  );

  console.log('\nListo. Datos para el script de k6:\n');
  console.log(JSON.stringify(
    {
      baseUrl: 'http://localhost:3000',
      loginEmail: users[0].email,
      loginPassword: PASSWORD,
      communityId: communityIds[0],
      panelId: panel.id,
      authorId: users[0].id,
    },
    null,
    2,
  ));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
