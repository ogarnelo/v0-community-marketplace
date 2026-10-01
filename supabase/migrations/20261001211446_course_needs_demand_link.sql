-- Mi curso -> continuidad de demanda.
-- Aditiva: solo enlaza course_needs con la identidad estable demand_requests.
-- No altera saved_searches ni demand_requests.

alter table public.course_needs
  add column if not exists demand_request_id uuid
    references public.demand_requests(id)
    on delete set null;

create unique index if not exists course_needs_demand_request_id_uidx
  on public.course_needs (demand_request_id)
  where demand_request_id is not null;
