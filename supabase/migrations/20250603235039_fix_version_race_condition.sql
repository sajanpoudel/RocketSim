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