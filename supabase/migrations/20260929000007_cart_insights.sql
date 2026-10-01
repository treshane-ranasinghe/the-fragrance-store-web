-- Cart Activity Monitor: product insights for a date range and customer type
create or replace function public.admin_cart_insights(
  p_from timestamptz default null, p_to timestamptz default null, p_customer_type text default null
)
returns table (
  item_id uuid, is_bundle boolean, item_name text, brand_name text,
  adds int, removes int, orders int, ordered_qty int, conversion_rate numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
  with ev as (
    select coalesce(pv.product_id, e.bundle_id) as item_id, e.bundle_id is not null as is_bundle, e.action
      from public.cart_events e
      join public.profiles pr on pr.id = e.user_id
      left join public.product_variants pv on pv.id = e.variant_id
     where (p_from is null or e.created_at >= p_from) and (p_to is null or e.created_at < p_to)
       and (p_customer_type is null or (p_customer_type = 'guest') = pr.is_anonymous)
  ),
  ords as (
    select coalesce(oi.product_id, oi.bundle_id) as item_id, count(distinct oi.order_id)::int as n, sum(oi.quantity)::int as qty
      from public.order_items oi join public.orders o on o.id = oi.order_id
     where oi.parent_item_id is null and o.status <> 'cancelled'
       and (p_from is null or o.created_at >= p_from) and (p_to is null or o.created_at < p_to)
     group by 1
  )
  select i.item_id, i.is_bundle, coalesce(p.name, bu.name), b.name,
         (count(*) filter (where i.action = 'add'))::int,
         (count(*) filter (where i.action = 'remove'))::int,
         coalesce(max(o.n), 0)::int,
         coalesce(max(o.qty), 0)::int,
         case when count(*) filter (where i.action = 'add') = 0 then 0::numeric
              else round(100.0 * coalesce(max(o.n), 0) / count(*) filter (where i.action = 'add'), 1) end
    from ev i
    left join public.products p on p.id = i.item_id and not i.is_bundle
    left join public.brands b on b.id = p.brand_id
    left join public.bundles bu on bu.id = i.item_id and i.is_bundle
    left join ords o on o.item_id = i.item_id
   where i.item_id is not null
   group by i.item_id, i.is_bundle, p.name, bu.name, b.name
   order by 5 desc;
end;
$$;
