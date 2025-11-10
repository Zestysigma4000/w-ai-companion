-- Create public bucket for chat attachments if not exists
insert into storage.buckets (id, name, public)
select 'chat-attachments', 'chat-attachments', true
where not exists (select 1 from storage.buckets where id = 'chat-attachments');

-- Drop and recreate policies to ensure correct configuration
drop policy if exists "Public read chat attachments" on storage.objects;
drop policy if exists "Users can upload to their folder (chat-attachments)" on storage.objects;
drop policy if exists "Users can update their own files (chat-attachments)" on storage.objects;
drop policy if exists "Users can delete their own files (chat-attachments)" on storage.objects;

create policy "Public read chat attachments"
  on storage.objects
  for select
  using (bucket_id = 'chat-attachments');

create policy "Users can upload to their folder (chat-attachments)"
  on storage.objects
  for insert
  with check (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own files (chat-attachments)"
  on storage.objects
  for update
  using (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own files (chat-attachments)"
  on storage.objects
  for delete
  using (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );