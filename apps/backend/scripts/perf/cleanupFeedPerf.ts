// Borra todo lo que seedFeedPerf.ts creó: el panel "perf-test" (y sus
// comunidades/posts en cascada) y los perfiles cuyo username empieza con
// "perf-test_". No toca la universidad: el seed reusa una ya existente, no
// crea ninguna.
//
// Uso: npx ts-node --esm scripts/perf/cleanupFeedPerf.ts

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './loadEnv.js';

const PERF_SLUG = 'perf-test';

const env = loadEnv();
const url = env.SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  throw new Error('Faltan SUPABASE_URL / SUPABASE_SECRET_KEY en el .env de apps/backend');
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

async function main(): Promise<void> {
  const { data: panel, error: panelFindError } = await supabase
    .from('panels')
    .select('id')
    .eq('slug', PERF_SLUG)
    .maybeSingle();
  if (panelFindError) throw new Error(panelFindError.message);

  if (panel) {
    // posts/community_members/community_moderators caen en cascada al borrar
    // communities; comments/votes/reports caen en cascada al borrar posts.
    const { error } = await supabase.from('communities').delete().eq('panel_id', panel.id);
    if (error) throw new Error(error.message);
    const { error: panelError } = await supabase.from('panels').delete().eq('id', panel.id);
    if (panelError) throw new Error(panelError.message);
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id')
    .like('username', `${PERF_SLUG}\\_%`);
  if (profilesError) throw new Error(profilesError.message);

  for (const profile of profiles ?? []) {
    // Borra el usuario de auth.users; profiles cae en cascada (on delete cascade).
    const { error } = await supabase.auth.admin.deleteUser(profile.id);
    if (error) throw new Error(error.message);
  }

  if (!panel && (profiles?.length ?? 0) === 0) {
    console.log('No hay datos de perf test para borrar.');
    return;
  }

  console.log(
    `Borrados: ${profiles?.length ?? 0} usuarios, panel, comunidades y posts de perf test.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
