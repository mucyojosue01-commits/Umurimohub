-- Add the distinct hiring stages used by the company position workflow.
alter type public.application_status add value if not exists 'under_review';
alter type public.application_status add value if not exists 'shortlisted';
alter type public.application_status add value if not exists 'interview';
alter type public.application_status add value if not exists 'offer';
