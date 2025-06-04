-- Create rocket_versions table for version control
CREATE TABLE IF NOT EXISTS public.rocket_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rocket_id UUID NOT NULL REFERENCES public.rockets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parts JSONB NOT NULL,
    motor_id VARCHAR(100),
    drag_coefficient DECIMAL(4,3) DEFAULT 0.35,
    units VARCHAR(10) DEFAULT 'metric',
    created_by_action VARCHAR(100), -- What AI action created this version
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rocket_versions_rocket_id ON public.rocket_versions(rocket_id);
CREATE INDEX IF NOT EXISTS idx_rocket_versions_user_id ON public.rocket_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_rocket_versions_version_number ON public.rocket_versions(rocket_id, version_number);
CREATE INDEX IF NOT EXISTS idx_rocket_versions_is_current ON public.rocket_versions(rocket_id, is_current);

-- Enable Row Level Security
ALTER TABLE public.rocket_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own rocket versions" ON public.rocket_versions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rocket versions" ON public.rocket_versions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rocket versions" ON public.rocket_versions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rocket versions" ON public.rocket_versions
    FOR DELETE USING (auth.uid() = user_id);

-- Create unique constraint to prevent duplicate version numbers per rocket
CREATE UNIQUE INDEX IF NOT EXISTS idx_rocket_versions_unique_version 
ON public.rocket_versions(rocket_id, version_number);

-- Add constraint to ensure version numbers are positive
ALTER TABLE public.rocket_versions 
ADD CONSTRAINT rocket_versions_version_number_positive 
CHECK (version_number > 0);

-- Create atomic function to create rocket versions (prevents race conditions)
CREATE OR REPLACE FUNCTION create_rocket_version(
    p_rocket_id UUID,
    p_user_id UUID,
    p_rocket_name VARCHAR(255),
    p_description TEXT,
    p_parts JSONB,
    p_motor_id VARCHAR(100),
    p_drag_coefficient DECIMAL(4,3),
    p_units VARCHAR(10),
    p_created_by_action VARCHAR(100)
)
RETURNS TABLE(
    id UUID,
    version_number INTEGER,
    name VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_version INTEGER;
    v_new_version_id UUID;
    v_version_name VARCHAR(255);
BEGIN
    -- Lock the rocket row to prevent concurrent version creation
    PERFORM 1 FROM public.rockets 
    WHERE rockets.id = p_rocket_id AND rockets.user_id = p_user_id
    FOR UPDATE;
    
    -- Get the next version number atomically
    SELECT COALESCE(MAX(rocket_versions.version_number), 0) + 1
    INTO v_next_version
    FROM public.rocket_versions
    WHERE rocket_versions.rocket_id = p_rocket_id;
    
    -- Generate version name
    v_version_name := p_rocket_name || ' v' || v_next_version;
    
    -- Mark all previous versions as not current
    UPDATE public.rocket_versions 
    SET is_current = false 
    WHERE rocket_versions.rocket_id = p_rocket_id;
    
    -- Insert new version
    INSERT INTO public.rocket_versions (
        rocket_id,
        user_id,
        version_number,
        name,
        description,
        parts,
        motor_id,
        drag_coefficient,
        units,
        created_by_action,
        is_current
    ) VALUES (
        p_rocket_id,
        p_user_id,
        v_next_version,
        v_version_name,
        p_description,
        p_parts,
        p_motor_id,
        p_drag_coefficient,
        p_units,
        p_created_by_action,
        true
    ) RETURNING rocket_versions.id INTO v_new_version_id;
    
    -- Return the created version info
    RETURN QUERY
    SELECT 
        v_new_version_id as id,
        v_next_version as version_number,
        v_version_name as name,
        p_description as description,
        NOW() as created_at;
END;
$$;
