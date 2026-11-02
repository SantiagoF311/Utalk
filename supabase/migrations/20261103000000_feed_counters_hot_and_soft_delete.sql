  -- Contadores desnormalizados para el feed. La fuente de verdad sigue siendo
  -- post_votes / comment_votes / comments: estas columnas las mantienen
  -- triggers (atómicos, en la misma transacción que el voto o comentario) y
  -- se pueden recalcular desde cero con el backfill de abajo. `posts.score`
  -- también es el insumo del trending (ver docs/datos-y-trending.md).
  alter table posts
    add column score integer not null default 0,
    add column comment_count integer not null default 0;

  -- Borrado lógico de comentarios: un comentario borrado queda como
  -- "[eliminado]" en el árbol y sus respuestas se conservan. Antes un delete
  -- se llevaba todo el hilo por el on delete cascade de parent_id.
  alter table comments
    add column score integer not null default 0,
    add column deleted_at timestamptz;

  -- Votos de posts → posts.score. Un cambio de voto (update) resta el valor
  -- viejo y suma el nuevo.
  create function apply_post_vote_to_score()
  returns trigger
  language plpgsql
  as $$
  begin
    if tg_op in ('UPDATE', 'DELETE') then
      update posts set score = score - old.value where id = old.post_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      update posts set score = score + new.value where id = new.post_id;
    end if;
    return null;
  end;
  $$;

  create trigger post_votes_apply_score
    after insert or update or delete on post_votes
    for each row
    execute function apply_post_vote_to_score();

  -- Votos de comentarios → comments.score.
  create function apply_comment_vote_to_score()
  returns trigger
  language plpgsql
  as $$
  begin
    if tg_op in ('UPDATE', 'DELETE') then
      update comments set score = score - old.value where id = old.comment_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      update comments set score = score + new.value where id = new.comment_id;
    end if;
    return null;
  end;
  $$;

  create trigger comment_votes_apply_score
    after insert or update or delete on comment_votes
    for each row
    execute function apply_comment_vote_to_score();

  -- Comentarios → posts.comment_count. Los borrados lógicos siguen contando
  -- (siguen ocupando su lugar en el hilo); solo un delete real descuenta.
  create function apply_comment_to_post_count()
  returns trigger
  language plpgsql
  as $$
  begin
    if tg_op = 'INSERT' then
      update posts set comment_count = comment_count + 1 where id = new.post_id;
    elsif tg_op = 'DELETE' then
      update posts set comment_count = comment_count - 1 where id = old.post_id;
    end if;
    return null;
  end;
  $$;

  create trigger comments_apply_post_count
    after insert or delete on comments
    for each row
    execute function apply_comment_to_post_count();

  -- Backfill de lo que ya existía (también sirve como "rebuild" si alguna vez
  -- los contadores se desincronizan).
  update posts p set
    score = coalesce((select sum(v.value) from post_votes v where v.post_id = p.id), 0),
    comment_count = (select count(*) from comments c where c.post_id = p.id);

  update comments c set
    score = coalesce((select sum(v.value) from comment_votes v where v.comment_id = c.id), 0);

  -- Índices del feed paginado por cursor: "nuevos" ordena por
  -- (created_at, id) y "top" por (score, id), siempre dentro de un foro.
  -- Reemplazan al índice simple sobre forum_id.
  drop index posts_forum_id_idx;
  create index posts_forum_new_idx on posts (forum_id, created_at desc, id desc);
  create index posts_forum_top_idx on posts (forum_id, score desc, id desc);

  -- Orden "hot" con la fórmula de Reddit (no la de Hacker News): el valor de
  -- un post solo cambia cuando cambia su score — el paso del tiempo se
  -- resuelve haciendo que los posts nuevos nazcan con un valor más alto, no
  -- haciendo decaer a los viejos. Por eso no hace falta cola ni cron: es una
  -- columna generada que Postgres recalcula sola cuando el trigger de votos
  -- actualiza `score`. Ver docs/datos-y-trending.md.
  --
  -- - log10: los primeros 10 votos pesan lo mismo que los 90 siguientes.
  -- - 45000 s (12,5 h) más reciente equivale a 10x votos. Para cambiar la
  --   constante hay que recrear la columna (drop + add): reemplazar la función
  --   no recalcula las filas ya guardadas.
  -- - La época (2026-01-01) es arbitraria: solo desplaza todos los valores
  --   por igual, no cambia el orden.
  create function hot_score(score integer, created_at timestamptz)
  returns double precision
  language sql
  immutable
  as $$
    select sign(score::double precision) * log(greatest(abs(score), 1)::double precision)
        + extract(epoch from created_at - timestamptz '2026-01-01 00:00:00+00')::double precision / 45000
  $$;

  alter table posts
    add column hot double precision
    generated always as (hot_score(score, created_at)) stored;

  create index posts_forum_hot_idx on posts (forum_id, hot desc, id desc);
