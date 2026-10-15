-- Production integrity fix: onboarding RLS + canonical demo seed.
-- Keeps RLS and foreign keys authoritative while making the existing demo flow
-- deterministic against the canonical UmurimoHub Supabase project.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'worker_skills_worker_name_key'
      and conrelid = 'public.worker_skills'::regclass
  ) then
    alter table public.worker_skills
      add constraint worker_skills_worker_name_key unique (worker_id, name);
  end if;
end $$;

drop policy if exists "roles self insert" on public.user_roles;
create policy "roles self insert" on public.user_roles
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "workers self insert" on public.worker_profiles;
create policy "workers self insert" on public.worker_profiles
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "worker skills self insert" on public.worker_skills;
create policy "worker skills self insert" on public.worker_skills
for insert to authenticated
with check (
  exists (
    select 1
    from public.worker_profiles w
    where w.id = worker_id
      and w.user_id = (select auth.uid())
  )
);

drop policy if exists "worker skills self update" on public.worker_skills;
create policy "worker skills self update" on public.worker_skills
for update to authenticated
using (
  exists (
    select 1
    from public.worker_profiles w
    where w.id = worker_skills.worker_id
      and w.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.worker_profiles w
    where w.id = worker_skills.worker_id
      and w.user_id = (select auth.uid())
  )
);

drop policy if exists "businesses owner insert" on public.businesses;
create policy "businesses owner insert" on public.businesses
for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "business members self insert" on public.business_members;
create policy "business members self insert" on public.business_members
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.created_by = (select auth.uid())
  )
);

drop policy if exists "teams lead insert" on public.teams;
create policy "teams lead insert" on public.teams
for insert to authenticated
with check (lead_user_id = (select auth.uid()));

drop policy if exists "team members lead insert" on public.team_members;
create policy "team members lead insert" on public.team_members
for insert to authenticated
with check (
  exists (
    select 1
    from public.teams t
    join public.worker_profiles w on w.id = team_members.worker_id
    where t.id = team_id
      and t.lead_user_id = (select auth.uid())
      and w.user_id = (select auth.uid())
  )
);

-- Existing fictional catalog records are safe test/demo fixtures, not national data.
-- Stable IDs are retained because the UI already links to these records.
insert into public.worker_profiles
(id,name,initials,title,bio,district,sector,rate_rwf,rate_unit,rating,reviews,rep,years,available,verified,visibility,is_demo)
values
('w1','Jean Bosco Habimana','JH','Master mason & site foreman','Leads small crews on residential builds across Kigali. Known for clean finishing and on-time handover.','Gasabo','Construction',15000,'day',4.9,38,'{"completion":97,"onTime":92,"repeat":14,"verifiedProjects":31,"skillsVerified":2,"recommendations":12,"response":95}',11,true,true,'public',true),
('w2','Aline Uwase','AU','Solar PV technician','Installs off-grid and mini-grid systems for homes, schools and health posts in the Eastern Province.','Rwamagana','Energy',20000,'day',4.8,21,'{"completion":100,"onTime":95,"repeat":8,"verifiedProjects":19,"skillsVerified":2,"recommendations":9,"response":98}',5,true,true,'public',true),
('w3','Eric Niyonzima','EN','Frontend developer','Builds fast, low-bandwidth web apps for cooperatives and SMEs.','Kicukiro','Technology',12000,'hour',4.7,15,'{"completion":93,"onTime":88,"repeat":5,"verifiedProjects":12,"skillsVerified":1,"recommendations":6,"response":90}',4,false,true,'public',true),
('w4','Claudine Mukamana','CM','Tailor & fashion designer','Made-in-Rwanda garments and school uniforms; runs a 4-person workshop.','Huye','Creative',45000,'project',4.9,44,'{"completion":98,"onTime":94,"repeat":22,"verifiedProjects":40,"skillsVerified":1,"recommendations":15,"response":87}',8,true,true,'public',true),
('w5','Patrick Mugisha','PM','Coffee farm supervisor','Coordinates seasonal picking crews near Lake Kivu washing stations.','Nyamasheke','Agriculture',6000,'day',4.6,27,'{"completion":95,"onTime":90,"repeat":11,"verifiedProjects":24,"skillsVerified":1,"recommendations":7,"response":76}',9,true,false,'public',true),
('w6','Diane Ingabire','DI','Tour guide (EN/FR/Kinyarwanda)','Volcanoes region guide, community tourism and birding specialist.','Musanze','Tourism',30000,'day',4.9,52,'{"completion":99,"onTime":97,"repeat":18,"verifiedProjects":46,"skillsVerified":1,"recommendations":20,"response":96}',6,true,true,'public',true),
('w7','Olivier Hakizimana','OH','Motorcycle mechanic','Moto and e-moto maintenance; training apprentices in Gisenyi.','Rubavu','Automotive',8000,'day',4.5,19,'{"completion":90,"onTime":85,"repeat":9,"verifiedProjects":10,"skillsVerified":0,"recommendations":4,"response":82}',7,true,false,'public',true),
('w8','Grace Umutoni','GU','Bookkeeper for MSMEs','Monthly books, payroll and tax filing support for small businesses.','Nyarugenge','Finance',60000,'project',4.8,23,'{"completion":96,"onTime":93,"repeat":16,"verifiedProjects":28,"skillsVerified":2,"recommendations":10,"response":94}',5,true,true,'public',true)
on conflict (id) do update set
name=excluded.name,initials=excluded.initials,title=excluded.title,bio=excluded.bio,district=excluded.district,
sector=excluded.sector,rate_rwf=excluded.rate_rwf,rate_unit=excluded.rate_unit,rating=excluded.rating,reviews=excluded.reviews,
rep=excluded.rep,years=excluded.years,available=excluded.available,verified=excluded.verified,visibility=excluded.visibility,is_demo=true;

insert into public.worker_skills (worker_id,name,level,verification) values
('w1','Masonry','Expert','Employer'),('w1','Carpentry','Advanced','Certificate'),
('w2','Solar installation','Advanced','Assessment'),('w2','Electrical wiring','Advanced','Certificate'),
('w3','React development','Advanced','Assessment'),('w3','Data analysis','Intermediate','Self-declared'),
('w4','Tailoring','Expert','Platform'),
('w5','Coffee harvesting','Expert','Employer'),('w5','Greenhouse management','Beginner','Self-declared'),
('w6','Tour guiding','Expert','Certificate'),('w6','Photography','Intermediate','Self-declared'),
('w7','Motorcycle mechanics','Advanced','Self-declared'),
('w8','Bookkeeping','Advanced','Certificate'),('w8','Data analysis','Intermediate','Assessment')
on conflict (worker_id,name) do update set level=excluded.level,verification=excluded.verification;

insert into public.teams
(id,name,summary,sector,skills,areas,lead_worker_id,projects,rating,available,is_demo)
values
('t1','Ubumwe Builders Crew','Six-person residential crew: foundations to finishing, with in-house electrical.','Construction',array['Masonry','Carpentry','Electrical wiring'],array['Gasabo','Kicukiro','Bugesera'],'w1',23,4.9,true,true),
('t2','Izuba Solar Team','Off-grid installs for schools and health posts.','Energy',array['Solar installation','Electrical wiring'],array['Rwamagana','Kayonza','Ngoma'],'w2',15,4.8,true,true),
('t3','Huye Stitch Collective','Uniform and garment production up to 500 units per month.','Creative',array['Tailoring'],array['Huye','Nyanza','Gisagara'],'w4',31,4.9,false,true),
('t4','Kivu Harvest Crew','Seasonal coffee picking and sorting crews of 10–40.','Agriculture',array['Coffee harvesting'],array['Nyamasheke','Rusizi','Karongi'],'w5',18,4.6,true,true)
on conflict (id) do update set
name=excluded.name,summary=excluded.summary,sector=excluded.sector,skills=excluded.skills,areas=excluded.areas,
lead_worker_id=excluded.lead_worker_id,projects=excluded.projects,rating=excluded.rating,available=excluded.available,is_demo=true;

insert into public.team_members(team_id,worker_id,role,status) values
('t1','w1','lead','active'),('t1','w2','member','active'),('t2','w2','lead','active'),
('t3','w4','lead','active'),('t4','w5','lead','active')
on conflict (team_id,worker_id) do update set role=excluded.role,status=excluded.status;

insert into public.businesses
(id,name,about,district,sector,services,rating,verified,is_demo)
values
('b1','Inzira Homes Ltd (demo)','Affordable housing developer.','Gasabo','Construction',array['Residential builds','Renovation'],4.7,true,true),
('b2','Kivu Hills Coffee Coop (demo)','Smallholder cooperative with a washing station.','Nyamasheke','Agriculture',array['Washed arabica','Seasonal work'],4.8,true,true),
('b3','Akagera Lodge Partners (demo)','Eco-lodge near the national park.','Kayonza','Hospitality',array['Hospitality','Guided tours'],4.6,true,true),
('b4','Agaciro Digital (demo)','Software studio for SMEs.','Kicukiro','Technology',array['Web apps','Data'],4.4,false,true)
on conflict (id) do update set
name=excluded.name,about=excluded.about,district=excluded.district,sector=excluded.sector,services=excluded.services,
rating=excluded.rating,verified=excluded.verified,is_demo=true;

insert into public.opportunities
(id,business_id,title,summary,sector,district,type,mode,duration,pay_rwf,pay_unit,deadline,skills,responsibilities,requirements,team_allowed,team_size,status,featured,is_demo)
values
('o1','b1','Masonry crew for 4-unit housing block','Build walls and slabs for a 4-unit affordable block in Kinyinya sector.','Construction','Gasabo','Project','On-site','10 weeks',4800000,'project','2026-10-28',array['Masonry','Carpentry'],array['Foundation and wall works','Daily site reporting','Safety compliance'],array['3+ years masonry','Own basic tools','Team lead with references'],true,6,'open',true,true),
('o2','b2','Seasonal coffee pickers (40 people)','Selective red-cherry picking during main harvest. Paid weekly via mobile money (when available).','Agriculture','Nyamasheke','Seasonal','On-site','8 weeks',3500,'day','2026-10-20',array['Coffee harvesting'],array['Selective picking','Sorting at collection point'],array['Ages 18+','Available full season'],true,40,'open',true,true),
('o3','b3','Solar install for 3 rural schools','Install 5kW systems with battery storage.','Energy','Kayonza','Project','On-site','3 weeks',2100000,'project','2026-11-02',array['Solar installation','Electrical wiring'],array['Mounting and wiring','Commissioning','User training'],array['Verified solar skill','Safety certificate'],true,3,'open',false,true),
('o4','b4','React developer – cooperative dashboard','Build an offline-friendly dashboard for farmer cooperatives.','Technology','Kicukiro','Job','Hybrid','6 months',650000,'month','2026-10-25',array['React development'],array['Build UI','Work with field team'],array['2+ years React','Portfolio'],false,null,'open',false,true),
('o5','b3','Bilingual tour guide – peak season','Lead game drives and community walks.','Tourism','Kayonza','Gig','On-site','6 weeks',35000,'day','2026-10-30',array['Tour guiding'],array['Guest briefings','Guided drives'],array['EN + FR','Guide certificate'],false,null,'open',false,true),
('o6','b1','Tailoring apprenticeship (6 places)','Learn garment production with a master tailor. Stipend provided.','Creative','Huye','Apprenticeship','On-site','4 months',40000,'month','2026-11-10',array['Tailoring'],array['Attend workshop daily','Complete assessments'],array['Ages 16–30','No experience needed'],false,null,'open',false,true)
on conflict (id) do update set
business_id=excluded.business_id,title=excluded.title,summary=excluded.summary,sector=excluded.sector,district=excluded.district,
type=excluded.type,mode=excluded.mode,duration=excluded.duration,pay_rwf=excluded.pay_rwf,pay_unit=excluded.pay_unit,deadline=excluded.deadline,
skills=excluded.skills,responsibilities=excluded.responsibilities,requirements=excluded.requirements,team_allowed=excluded.team_allowed,
team_size=excluded.team_size,status=excluded.status,featured=excluded.featured,is_demo=true;
