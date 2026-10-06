-- Development seed: clearly labeled demo records (is_demo = true)
insert into public.worker_profiles (id,name,title,district,sector,rate_rwf,rate_unit,available,years,bio,initials,verified,rating,reviews,rep,is_demo) values
('w1','Jean Bosco Habimana','Master mason & site foreman','Gasabo','Construction',15000,'day',true,11,'Leads small crews on residential builds across Kigali. Known for clean finishing and on-time handover.','JH',true,4.9,38,'{"completion":97,"onTime":92,"repeat":14,"verifiedProjects":31,"skillsVerified":2,"recommendations":12,"response":95}'::jsonb,true),
('w2','Aline Uwase','Solar PV technician','Rwamagana','Energy',20000,'day',true,5,'Installs off-grid and mini-grid systems for homes, schools and health posts in the Eastern Province.','AU',true,4.8,21,'{"completion":100,"onTime":95,"repeat":8,"verifiedProjects":19,"skillsVerified":2,"recommendations":9,"response":98}'::jsonb,true),
('w3','Eric Niyonzima','Frontend developer','Kicukiro','Technology',12000,'hour',false,4,'Builds fast, low-bandwidth web apps for cooperatives and SMEs.','EN',true,4.7,15,'{"completion":93,"onTime":88,"repeat":5,"verifiedProjects":12,"skillsVerified":1,"recommendations":6,"response":90}'::jsonb,true),
('w4','Claudine Mukamana','Tailor & fashion designer','Huye','Creative',45000,'project',true,8,'Made-in-Rwanda garments and school uniforms; runs a 4-person workshop.','CM',true,4.9,44,'{"completion":98,"onTime":94,"repeat":22,"verifiedProjects":40,"skillsVerified":1,"recommendations":15,"response":87}'::jsonb,true),
('w5','Patrick Mugisha','Coffee farm supervisor','Nyamasheke','Agriculture',6000,'day',true,9,'Coordinates seasonal picking crews near Lake Kivu washing stations.','PM',false,4.6,27,'{"completion":95,"onTime":90,"repeat":11,"verifiedProjects":24,"skillsVerified":1,"recommendations":7,"response":76}'::jsonb,true),
('w6','Diane Ingabire','Tour guide (EN/FR/Kinyarwanda)','Musanze','Tourism',30000,'day',true,6,'Volcanoes region guide, community tourism and birding specialist.','DI',true,4.9,52,'{"completion":99,"onTime":97,"repeat":18,"verifiedProjects":46,"skillsVerified":1,"recommendations":20,"response":96}'::jsonb,true),
('w7','Olivier Hakizimana','Motorcycle mechanic','Rubavu','Automotive',8000,'day',true,7,'Moto and e-moto maintenance; training apprentices in Gisenyi.','OH',false,4.5,19,'{"completion":90,"onTime":85,"repeat":9,"verifiedProjects":10,"skillsVerified":0,"recommendations":4,"response":82}'::jsonb,true),
('w8','Grace Umutoni','Bookkeeper for MSMEs','Nyarugenge','Finance',60000,'project',true,5,'Monthly books, payroll and tax filing support for small businesses.','GU',true,4.8,23,'{"completion":96,"onTime":93,"repeat":16,"verifiedProjects":28,"skillsVerified":2,"recommendations":10,"response":94}'::jsonb,true);

insert into public.worker_skills (worker_id,name,level,verification) values
('w1','Masonry','Expert','Employer'),('w1','Carpentry','Advanced','Certificate'),
('w2','Solar installation','Advanced','Assessment'),('w2','Electrical wiring','Advanced','Certificate'),
('w3','React development','Advanced','Assessment'),('w3','Data analysis','Intermediate','Self-declared'),
('w4','Tailoring','Expert','Platform'),
('w5','Coffee harvesting','Expert','Employer'),('w5','Greenhouse management','Beginner','Self-declared'),
('w6','Tour guiding','Expert','Certificate'),('w6','Photography','Intermediate','Self-declared'),
('w7','Motorcycle mechanics','Advanced','Self-declared'),
('w8','Bookkeeping','Advanced','Certificate'),('w8','Data analysis','Intermediate','Assessment');

insert into public.businesses (id,name,sector,district,verified,rating,about,services,is_demo) values
('b1','Inzira Homes Ltd (demo)','Construction','Gasabo',true,4.7,'Affordable housing developer.',array['Residential builds','Renovation']::text[],true),
('b2','Kivu Hills Coffee Coop (demo)','Agriculture','Nyamasheke',true,4.8,'Smallholder cooperative with a washing station.',array['Washed arabica','Seasonal work']::text[],true),
('b3','Akagera Lodge Partners (demo)','Hospitality','Kayonza',true,4.6,'Eco-lodge near the national park.',array['Hospitality','Guided tours']::text[],true),
('b4','Agaciro Digital (demo)','Technology','Kicukiro',false,4.4,'Software studio for SMEs.',array['Web apps','Data']::text[],true);

insert into public.teams (id,name,lead_worker_id,sector,areas,rating,projects,available,summary,skills,is_demo) values
('t1','Ubumwe Builders Crew','w1','Construction',array['Gasabo','Kicukiro','Bugesera']::text[],4.9,23,true,'Six-person residential crew: foundations to finishing, with in-house electrical.',array['Masonry','Carpentry','Electrical wiring']::text[],true),
('t2','Izuba Solar Team','w2','Energy',array['Rwamagana','Kayonza','Ngoma']::text[],4.8,15,true,'Off-grid installs for schools and health posts.',array['Solar installation','Electrical wiring']::text[],true),
('t3','Huye Stitch Collective','w4','Creative',array['Huye','Nyanza','Gisagara']::text[],4.9,31,false,'Uniform and garment production up to 500 units per month.',array['Tailoring']::text[],true),
('t4','Kivu Harvest Crew','w5','Agriculture',array['Nyamasheke','Rusizi','Karongi']::text[],4.6,18,true,'Seasonal coffee picking and sorting crews of 10–40.',array['Coffee harvesting']::text[],true);

insert into public.team_members (team_id,worker_id,role,status) values
('t1','w1','lead','active'),('t1','w2','member','active'),('t2','w2','lead','active'),('t3','w4','lead','active'),('t4','w5','lead','active');

insert into public.opportunities (id,business_id,title,sector,district,type,pay_rwf,pay_unit,mode,duration,deadline,team_allowed,team_size,skills,summary,responsibilities,requirements,featured,status,is_demo) values
('o1','b1','Masonry crew for 4-unit housing block','Construction','Gasabo','Project',4800000,'project','On-site','10 weeks','2026-10-28',true,6,array['Masonry','Carpentry']::text[],'Build walls and slabs for a 4-unit affordable block in Kinyinya sector.',array['Foundation and wall works','Daily site reporting','Safety compliance']::text[],array['3+ years masonry','Own basic tools','Team lead with references']::text[],true,'open',true),
('o2','b2','Seasonal coffee pickers (40 people)','Agriculture','Nyamasheke','Seasonal',3500,'day','On-site','8 weeks','2026-10-20',true,40,array['Coffee harvesting']::text[],'Selective red-cherry picking during main harvest. Paid weekly via mobile money (when available).',array['Selective picking','Sorting at collection point']::text[],array['Ages 18+','Available full season']::text[],true,'open',true),
('o3','b3','Solar install for 3 rural schools','Energy','Kayonza','Project',2100000,'project','On-site','3 weeks','2026-11-02',true,3,array['Solar installation','Electrical wiring']::text[],'Install 5kW systems with battery storage.',array['Mounting and wiring','Commissioning','User training']::text[],array['Verified solar skill','Safety certificate']::text[],false,'open',true),
('o4','b4','React developer – cooperative dashboard','Technology','Kicukiro','Job',650000,'month','Hybrid','6 months','2026-10-25',false,null,array['React development']::text[],'Build an offline-friendly dashboard for farmer cooperatives.',array['Build UI','Work with field team']::text[],array['2+ years React','Portfolio']::text[],false,'open',true),
('o5','b3','Bilingual tour guide – peak season','Tourism','Kayonza','Gig',35000,'day','On-site','6 weeks','2026-10-30',false,null,array['Tour guiding']::text[],'Lead game drives and community walks.',array['Guest briefings','Guided drives']::text[],array['EN + FR','Guide certificate']::text[],false,'open',true),
('o6','b1','Tailoring apprenticeship (6 places)','Creative','Huye','Apprenticeship',40000,'month','On-site','4 months','2026-11-10',false,null,array['Tailoring']::text[],'Learn garment production with a master tailor. Stipend provided.',array['Attend workshop daily','Complete assessments']::text[],array['Ages 16–30','No experience needed']::text[],false,'open',true);
