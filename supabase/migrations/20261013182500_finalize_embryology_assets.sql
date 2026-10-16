-- Finalize Embryology document assets and variants.
-- Approved curriculum remains the source of truth; prepared decks are mapped by topic.

insert into public.lecture_module_map (lecture_id,module_code,academic_year) values
('y1-iae-1-11','IAE-1',1),
('y1-iae-1-12','IAE-1',1),
('y1-iae-1-13','IAE-1',1),
('y1-iae-1-14','IAE-1',1),
('y1-iae-1-15','IAE-1',1),
('y1-iae-1-19','IAE-1',1)
on conflict (lecture_id) do update set module_code=excluded.module_code,academic_year=excluded.academic_year;

insert into public.lecture_assets (lecture_id,pdf_path,pptx_path,updated_at) values
('y1-iae-1-11','y1-iae-1-11/pdf/AnatoMate_Embryology_Lecture_1_48_Slides.pdf','y1-iae-1-11/pptx/AnatoMate_Embryology_Lecture_1_48_Slides.pptx',now()),
('y1-iae-1-12','y1-iae-1-12/pdf/AnatoMate_Embryology_Lecture_02_Gametogenesis.pdf','y1-iae-1-12/pptx/AnatoMate_Embryology_Lecture_02_Gametogenesis.pptx',now()),
('y1-iae-1-13','y1-iae-1-13/pdf/AnatoMate_Lecture_6_Fertilization_28_Slides.pdf','y1-iae-1-13/pptx/AnatoMate_Lecture_6_Fertilization_28_Slides.pptx',now()),
('y1-iae-1-14','y1-iae-1-14/pdf/AnatoMate_Embryology_Lecture_7_Cleavage_Blastocyst.pdf','y1-iae-1-14/pptx/AnatoMate_Embryology_Lecture_7_Cleavage_Blastocyst.pptx',now()),
('y1-iae-1-15','y1-iae-1-15/pdf/AnatoMate_Embryology_Week2_All_Images.pdf','y1-iae-1-15/pptx/AnatoMate_Embryology_Week2_All_Images.pptx',now()),
('y1-iae-1-19','y1-iae-1-19/pdf/AnatoMate_Placenta_Lecture_11_All_Slides.pdf','y1-iae-1-19/pptx/AnatoMate_Placenta_Lecture_11_All_Slides_OPTIMIZED.pptx',now())
on conflict (lecture_id) do update set pdf_path=excluded.pdf_path,pptx_path=excluded.pptx_path,updated_at=now();

insert into public.lecture_settings (lecture_id,title_override,price_egp,access_mode,published,updated_at) values
('y1-iae-1-11','Introduction to Embryology',40,'paid',true,now()),
('y1-iae-1-12','Gametogenesis',40,'paid',true,now()),
('y1-iae-1-13','Fertilization',40,'paid',true,now()),
('y1-iae-1-14','First Week of Development',40,'paid',true,now()),
('y1-iae-1-15','Second Week of Development',40,'paid',true,now()),
('y1-iae-1-19','Placenta & Fetal Membranes',40,'paid',true,now())
on conflict (lecture_id) do update set title_override=excluded.title_override,price_egp=excluded.price_egp,access_mode=excluded.access_mode,published=excluded.published,updated_at=now();

insert into public.lecture_document_variants
(lecture_id,variant_key,label,description,source_name,pdf_path,pptx_path,sort_order,published,updated_at) values
('y1-iae-1-12','standard','Gametogenesis — Core Lecture','Core gametogenesis lecture.','AnatoMate_Embryology_Lecture_02_Gametogenesis','y1-iae-1-12/pdf/AnatoMate_Embryology_Lecture_02_Gametogenesis.pdf','y1-iae-1-12/pptx/AnatoMate_Embryology_Lecture_02_Gametogenesis.pptx',1,true,now()),
('y1-iae-1-12','spermatogenesis','Spermatogenesis','Focused spermatogenesis lecture.','AnatoMate_Embryology_Lecture_3_Spermatogenesis','y1-iae-1-12/variants/spermatogenesis/AnatoMate_Embryology_Lecture_3_Spermatogenesis.pdf','y1-iae-1-12/variants/spermatogenesis/AnatoMate_Embryology_Lecture_3_Spermatogenesis.pptx',2,true,now()),
('y1-iae-1-12','oogenesis','Oogenesis','Focused oogenesis lecture.','AnatoMate_Oogenesis_Lecture_4_Slides','y1-iae-1-12/variants/oogenesis/AnatoMate_Oogenesis_Lecture_4_Slides.pdf','y1-iae-1-12/variants/oogenesis/AnatoMate_Oogenesis_Lecture_4_Slides.pptx',3,true,now()),
('y1-iae-1-12','female-reproductive-cycles','Female Reproductive Cycles','Cycle-focused supporting lecture within the gametogenesis block.','AnatoMate_Embryology_Lecture_5_Female_Reproductive_Cycles','y1-iae-1-12/variants/female-cycles/pdf/AnatoMate_Embryology_Lecture_5_Female_Reproductive_Cycles.pdf','y1-iae-1-12/variants/female-cycles/pptx/AnatoMate_Embryology_Lecture_5_Female_Reproductive_Cycles.pptx',4,true,now()),
('y1-iae-1-15','standard','Second Week of Development — Core Lecture','Core second-week lecture.','AnatoMate_Embryology_Week2_All_Images','y1-iae-1-15/pdf/AnatoMate_Embryology_Week2_All_Images.pdf','y1-iae-1-15/pptx/AnatoMate_Embryology_Week2_All_Images.pptx',1,true,now()),
('y1-iae-1-15','implantation-decidua','Implantation & Decidua','Focused implantation and decidua lecture.','AnatoMate_Lecture_8_Implantation_Decidua_All_Slides','y1-iae-1-15/variants/implantation-decidua/AnatoMate_Lecture_8_Implantation_Decidua_All_Slides.pdf','y1-iae-1-15/variants/implantation-decidua/AnatoMate_Lecture_8_Implantation_Decidua_All_Slides.pptx',2,true,now()),
('y1-iae-1-19','standard','Placenta — Core Lecture','Core placenta lecture.','AnatoMate_Placenta_Lecture_11_All_Slides','y1-iae-1-19/pdf/AnatoMate_Placenta_Lecture_11_All_Slides.pdf','y1-iae-1-19/pptx/AnatoMate_Placenta_Lecture_11_All_Slides_OPTIMIZED.pptx',1,true,now()),
('y1-iae-1-19','chorion-villi','Chorion & Chorionic Villi','Focused chorion and chorionic villi lecture.','AnatoMate_Lecture_10_Chorion_Chorionic_Villi_40_Slides','y1-iae-1-19/variants/chorion-villi/AnatoMate_Lecture_10_Chorion_Chorionic_Villi_40_Slides.pdf','y1-iae-1-19/variants/chorion-villi/AnatoMate_Lecture_10_Chorion_Chorionic_Villi_40_Slides.pptx',2,true,now())
on conflict (lecture_id,variant_key) do update set
label=excluded.label,description=excluded.description,source_name=excluded.source_name,pdf_path=excluded.pdf_path,pptx_path=excluded.pptx_path,sort_order=excluded.sort_order,published=excluded.published,updated_at=now();

insert into public.lecture_pricing_rules
(lecture_id,academic_year,nationality_match,price_egp,view_limit,enabled,priority,product_type)
select x.lecture_id,1,'*',x.price,null,true,0,x.product_type
from (values
('y1-iae-1-11','video',40),('y1-iae-1-11','datashow',30),('y1-iae-1-11','bundle',70),
('y1-iae-1-12','video',40),('y1-iae-1-12','datashow',30),('y1-iae-1-12','bundle',70),
('y1-iae-1-13','video',40),('y1-iae-1-13','datashow',30),('y1-iae-1-13','bundle',70),
('y1-iae-1-14','video',40),('y1-iae-1-14','datashow',30),('y1-iae-1-14','bundle',70),
('y1-iae-1-15','video',40),('y1-iae-1-15','datashow',30),('y1-iae-1-15','bundle',70),
('y1-iae-1-19','video',40),('y1-iae-1-19','datashow',30),('y1-iae-1-19','bundle',70)
) as x(lecture_id,product_type,price)
on conflict do nothing;
