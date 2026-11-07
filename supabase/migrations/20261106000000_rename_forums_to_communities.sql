-- Los foros pasan a llamarse comunidades (como en Reddit), también en la DB.
-- Solo renombres: los datos, las FKs y los permisos se conservan.

alter table forums rename to communities;
alter table forum_moderators rename to community_moderators;

alter table posts rename column forum_id to community_id;
alter table community_moderators rename column forum_id to community_id;

-- Constraints: el backend reconoce el slug repetido por el nombre de la
-- constraint (`communities_panel_id_slug_key`), así que tienen que coincidir.
alter table communities rename constraint forums_pkey to communities_pkey;
alter table communities rename constraint forums_panel_id_fkey to communities_panel_id_fkey;
alter table communities rename constraint forums_created_by_fkey to communities_created_by_fkey;
alter table communities rename constraint forums_panel_id_slug_key to communities_panel_id_slug_key;
alter table posts rename constraint posts_forum_id_fkey to posts_community_id_fkey;
alter table community_moderators rename constraint forum_moderators_pkey to community_moderators_pkey;
alter table community_moderators
  rename constraint forum_moderators_forum_id_fkey to community_moderators_community_id_fkey;
alter table community_moderators
  rename constraint forum_moderators_user_id_fkey to community_moderators_user_id_fkey;

alter index forums_panel_id_idx rename to communities_panel_id_idx;
alter index forum_moderators_user_id_idx rename to community_moderators_user_id_idx;
alter index posts_forum_new_idx rename to posts_community_new_idx;
alter index posts_forum_top_idx rename to posts_community_top_idx;
alter index posts_forum_hot_idx rename to posts_community_hot_idx;

-- El cuerpo de la función nombra la tabla como texto: el rename no lo
-- actualiza, así que se recrea. Sin esto, crear una comunidad fallaría.
drop trigger forums_add_creator_as_moderator on communities;
drop function add_forum_creator_as_moderator();

create function add_community_creator_as_moderator()
returns trigger
language plpgsql
as $$
begin
  insert into community_moderators (community_id, user_id)
  values (new.id, new.created_by);
  return new;
end;
$$;

create trigger communities_add_creator_as_moderator
  after insert on communities
  for each row
  execute function add_community_creator_as_moderator();
