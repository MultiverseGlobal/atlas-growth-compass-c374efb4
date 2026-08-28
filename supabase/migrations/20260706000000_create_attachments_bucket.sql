-- Create attachments storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public access to select objects in the attachments bucket
CREATE POLICY "Public Access to Attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

-- Policy to allow authenticated users to upload objects to the attachments bucket
CREATE POLICY "Authenticated Users Can Upload Attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Policy to allow users to delete their own objects in the attachments bucket
CREATE POLICY "Users Can Delete Own Attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND auth.uid() = owner);
