-- Link the prepared Jejunum & Ileum lecture to the approved MGL-3 curriculum slot.
insert into public.lecture_assets (lecture_id,pdf_path,pptx_path,updated_at)
values (
  'y3-mgl-3-18',
  'y3-mgl-3-18/pdf/AnatoMate_Lecture_12_Jejunum_Ileum_All_Available_Images.pdf',
  'y3-mgl-3-18/pptx/AnatoMate_Lecture_12_Jejunum_Ileum_All_Available_Images.pptx',
  now()
)
on conflict (lecture_id) do update
set pdf_path=excluded.pdf_path,
    pptx_path=excluded.pptx_path,
    updated_at=now();

insert into public.lecture_settings (lecture_id,title_override,price_egp,access_mode,published,updated_at)
values ('y3-mgl-3-18','Jejunum & Ileum',50,'paid',true,now())
on conflict (lecture_id) do update
set title_override=excluded.title_override,
    price_egp=excluded.price_egp,
    access_mode=excluded.access_mode,
    published=true,
    updated_at=now();

insert into public.lecture_pricing_rules
(lecture_id,academic_year,nationality_match,price_egp,view_limit,enabled,priority,product_type)
values
('y3-mgl-3-18',3,'*',50,null,true,0,'video'),
('y3-mgl-3-18',3,'*',30,null,true,0,'datashow'),
('y3-mgl-3-18',3,'*',80,null,true,0,'bundle')
on conflict do nothing;
