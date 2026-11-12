create or replace function public.save_review(
  p_product_id uuid,
  p_stars smallint,
  p_feedback text default ''
)
returns setof public.reviews
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to submit a review.' using errcode = '42501';
  end if;

  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'Choose a rating from 1 to 5 stars.' using errcode = '22023';
  end if;

  if char_length(coalesce(p_feedback, '')) > 500 then
    raise exception 'Feedback must be 500 characters or fewer.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id and role = 'customer'::public.app_role
  ) then
    raise exception 'Only customer accounts can submit reviews.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.products
    where id = p_product_id and status = 'published'
  ) then
    raise exception 'This product is not available for review.' using errcode = '23503';
  end if;

  return query
  insert into public.reviews (product_id, user_id, stars, feedback)
  values (p_product_id, v_user_id, p_stars, coalesce(p_feedback, ''))
  on conflict (product_id, user_id)
  do update set stars = excluded.stars, feedback = excluded.feedback
  returning *;
end;
$function$;

revoke all on function public.save_review(uuid, smallint, text) from public, anon;
grant execute on function public.save_review(uuid, smallint, text) to authenticated;
