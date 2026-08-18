ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'MIXED_USE';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'DORMITORY';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'WAREHOUSE';
ALTER TYPE public.property_type ADD VALUE IF NOT EXISTS 'EMBASSY';
ALTER TYPE public.category_type ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id_photo_url text;