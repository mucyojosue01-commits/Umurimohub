-- Both triggers called the same notification function for the same status update,
-- creating duplicate notifications for each application stage transition.
drop trigger if exists application_status_notification on public.applications;
