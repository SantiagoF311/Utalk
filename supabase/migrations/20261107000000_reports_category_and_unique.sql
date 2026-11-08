-- Reportes: motivo de una lista fija (para filtrar y priorizar en
-- moderación), detalle opcional y un solo reporte por persona y contenido.

-- Los reportes que ya existían quedan como "otra cosa", con su texto como
-- detalle.
alter table reports
  add column category text not null default 'other'
  check (category in ('exposes_person', 'threat', 'harassment', 'spam', 'other'));
alter table reports alter column category drop default;

-- `reason` pasa a ser el detalle opcional que escribe quien reporta.
alter table reports alter column reason drop not null;

-- Si alguien ya había reportado lo mismo varias veces, se conserva el
-- primero; si no, los índices únicos de abajo no se podrían crear.
delete from reports r
using reports earlier
where r.reported_by = earlier.reported_by
  and r.post_id is not distinct from earlier.post_id
  and r.comment_id is not distinct from earlier.comment_id
  and (r.created_at, r.id) > (earlier.created_at, earlier.id);

-- Un reporte por persona y contenido. Parciales porque cada reporte apunta
-- a un post o a un comentario (el otro es null). El backend chequea antes,
-- y esto frena dos reportes simultáneos.
create unique index reports_one_per_post_and_reporter
  on reports (reported_by, post_id) where post_id is not null;
create unique index reports_one_per_comment_and_reporter
  on reports (reported_by, comment_id) where comment_id is not null;
