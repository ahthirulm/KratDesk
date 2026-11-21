DROP POLICY "Staff read job types" ON public.job_types;
CREATE POLICY "Staff read job types" ON public.job_types
FOR SELECT TO authenticated
USING (public.staff_can('Create bills'));

DROP POLICY "job_photos_read" ON storage.objects;
CREATE POLICY "job_photos_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'job-photos'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR EXISTS (
      SELECT 1
      FROM public.repair_jobs AS job
      WHERE job.photo_path = storage.objects.name
        AND public.staff_can('Create bills', job.branch_id)
    )
  )
);