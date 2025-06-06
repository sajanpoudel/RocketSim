-- Clean project architecture migration
-- This creates everything from scratch for the project-based system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Create projects table (top-level entity)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    
    CONSTRAINT projects_name_length CHECK (length(name) >= 1 AND length(name) <= 100),
    CONSTRAINT projects_description_length CHECK (length(description) <= 500)
);

-- Create rockets table with project relationship
CREATE TABLE IF NOT EXISTS public.rockets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parts JSONB NOT NULL,
    motor_id TEXT DEFAULT 'default-motor',
    drag_coefficient REAL DEFAULT 0.5,
    units TEXT DEFAULT 'metric',
    is_public BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    design_vector vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT rockets_name_length CHECK (length(name) >= 1 AND length(name) <= 100),
    CONSTRAINT rockets_units_valid CHECK (units IN ('metric', 'imperial')),
    CONSTRAINT rockets_drag_positive CHECK (drag_coefficient > 0)
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT UNIQUE NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    rocket_count INTEGER DEFAULT 0,
    simulation_count INTEGER DEFAULT 0
);

-- Create chat_messages table with project relationship
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES public.user_sessions(session_id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    rocket_id UUID REFERENCES public.rockets(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    agent_actions JSONB,
    context_data JSONB,
    tokens_used INTEGER,
    message_vector vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chat_content_length CHECK (length(content) >= 1 AND length(content) <= 10000)
);

-- Create simulations table
CREATE TABLE IF NOT EXISTS public.simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rocket_id UUID NOT NULL REFERENCES public.rockets(id) ON DELETE CASCADE,
    fidelity TEXT DEFAULT 'standard',
    status TEXT DEFAULT 'completed',
    max_altitude REAL,
    max_velocity REAL,
    max_acceleration REAL,
    apogee_time REAL,
    landing_velocity REAL,
    drift_distance REAL,
    stability_margin REAL,
    trajectory_data JSONB,
    flight_events JSONB,
    thrust_curve JSONB,
    computation_time REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create rocket_versions table with project relationship
CREATE TABLE IF NOT EXISTS public.rocket_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rocket_id UUID NOT NULL REFERENCES public.rockets(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    parts JSONB NOT NULL,
    motor_id TEXT DEFAULT 'default-motor',
    drag_coefficient REAL DEFAULT 0.5,
    units TEXT DEFAULT 'metric',
    created_by_action TEXT,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT rocket_versions_version_positive CHECK (version_number > 0),
    CONSTRAINT rocket_versions_name_length CHECK (length(name) >= 1 AND length(name) <= 100)
);

-- Create analysis_results table for advanced analysis
CREATE TABLE IF NOT EXISTS public.analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rocket_id UUID REFERENCES public.rockets(id) ON DELETE CASCADE,
    simulation_id UUID REFERENCES public.simulations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL,
    results JSONB NOT NULL,
    parameters JSONB,
    computation_time REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create weather_cache table for atmospheric data caching
CREATE TABLE IF NOT EXISTS public.weather_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_key TEXT NOT NULL,
    weather_data JSONB NOT NULL,
    source TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create environment_configs table for launch conditions
CREATE TABLE IF NOT EXISTS public.environment_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation REAL NOT NULL,
    wind_model JSONB,
    atmospheric_model JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at);

CREATE INDEX IF NOT EXISTS idx_rockets_user_id ON public.rockets(user_id);
CREATE INDEX IF NOT EXISTS idx_rockets_project_id ON public.rockets(project_id);
CREATE INDEX IF NOT EXISTS idx_rockets_created_at ON public.rockets(created_at);
CREATE INDEX IF NOT EXISTS idx_rockets_design_vector ON public.rockets USING ivfflat (design_vector vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON public.chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_vector ON public.chat_messages USING ivfflat (message_vector vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_simulations_rocket_id ON public.simulations(rocket_id);
CREATE INDEX IF NOT EXISTS idx_simulations_user_id ON public.simulations(user_id);

CREATE INDEX IF NOT EXISTS idx_rocket_versions_rocket_id ON public.rocket_versions(rocket_id);
CREATE INDEX IF NOT EXISTS idx_rocket_versions_project_id ON public.rocket_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_rocket_versions_user_id ON public.rocket_versions(user_id);

CREATE INDEX IF NOT EXISTS idx_analysis_results_rocket_id ON public.analysis_results(rocket_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_simulation_id ON public.analysis_results(simulation_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id ON public.analysis_results(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_type ON public.analysis_results(analysis_type);

CREATE INDEX IF NOT EXISTS idx_weather_cache_location_key ON public.weather_cache(location_key);
CREATE INDEX IF NOT EXISTS idx_weather_cache_expires_at ON public.weather_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_environment_configs_user_id ON public.environment_configs(user_id);

-- Create project summary view for efficient queries
CREATE OR REPLACE VIEW public.project_summary AS
SELECT 
    p.*,
    COALESCE(rocket_stats.rocket_count, 0) as rocket_count,
    COALESCE(version_stats.version_count, 0) as version_count,
    COALESCE(message_stats.message_count, 0) as message_count,
    COALESCE(sim_stats.simulations_count, 0) as simulations_count,
    COALESCE(analysis_stats.analysis_count, 0) as analysis_count,
    rocket_stats.last_rocket_update,
    message_stats.last_message_time
FROM public.projects p
LEFT JOIN (
    SELECT 
        project_id,
        COUNT(*) as rocket_count,
        MAX(updated_at) as last_rocket_update
    FROM public.rockets 
    GROUP BY project_id
) rocket_stats ON p.id = rocket_stats.project_id
LEFT JOIN (
    SELECT 
        project_id,
        COUNT(*) as version_count
    FROM public.rocket_versions 
    GROUP BY project_id
) version_stats ON p.id = version_stats.project_id
LEFT JOIN (
    SELECT 
        project_id,
        COUNT(*) as message_count,
        MAX(created_at) as last_message_time
    FROM public.chat_messages 
    WHERE role != 'system'
    GROUP BY project_id
) message_stats ON p.id = message_stats.project_id
LEFT JOIN (
    SELECT 
        r.project_id,
        COUNT(s.*) as simulations_count
    FROM public.rockets r
    LEFT JOIN public.simulations s ON r.id = s.rocket_id
    GROUP BY r.project_id
) sim_stats ON p.id = sim_stats.project_id
LEFT JOIN (
    SELECT 
        r.project_id,
        COUNT(a.*) as analysis_count
    FROM public.rockets r
    LEFT JOIN public.analysis_results a ON r.id = a.rocket_id
    GROUP BY r.project_id
) analysis_stats ON p.id = analysis_stats.project_id;

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rocket_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environment_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for projects
CREATE POLICY "Users can view their own projects" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for rockets
CREATE POLICY "Users can view their own rockets" ON public.rockets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rockets" ON public.rockets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rockets" ON public.rockets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rockets" ON public.rockets
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for chat_messages
CREATE POLICY "Users can view their own chat messages" ON public.chat_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages" ON public.chat_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for simulations
CREATE POLICY "Users can view their own simulations" ON public.simulations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own simulations" ON public.simulations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for rocket_versions
CREATE POLICY "Users can view their own rocket versions" ON public.rocket_versions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rocket versions" ON public.rocket_versions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for user_sessions
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON public.user_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON public.user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for analysis_results
CREATE POLICY "Users can view their own analysis results" ON public.analysis_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analysis results" ON public.analysis_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for weather_cache (public read, system write)
CREATE POLICY "Anyone can view weather cache" ON public.weather_cache
    FOR SELECT USING (true);

CREATE POLICY "System can manage weather cache" ON public.weather_cache
    FOR ALL USING (true);

-- Create RLS policies for environment_configs
CREATE POLICY "Users can view their own environment configs" ON public.environment_configs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own environment configs" ON public.environment_configs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own environment configs" ON public.environment_configs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own environment configs" ON public.environment_configs
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger to update project updated_at when rockets change
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.projects 
    SET updated_at = NOW() 
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_timestamp
    AFTER INSERT OR UPDATE OR DELETE ON public.rockets
    FOR EACH ROW
    EXECUTE FUNCTION update_project_timestamp();

-- Create vector search functions for AI embeddings
CREATE OR REPLACE FUNCTION search_chat_messages(
    query_vector vector(1536),
    user_id_param uuid,
    similarity_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    content text,
    role text,
    session_id text,
    project_id uuid,
    rocket_id uuid,
    created_at timestamptz,
    similarity float
) 
LANGUAGE sql STABLE
AS $$
    SELECT 
        cm.id,
        cm.content,
        cm.role,
        cm.session_id,
        cm.project_id,
        cm.rocket_id,
        cm.created_at,
        1 - (cm.message_vector <=> query_vector) as similarity
    FROM public.chat_messages cm
    WHERE 
        cm.user_id = user_id_param
        AND cm.message_vector IS NOT NULL
        AND 1 - (cm.message_vector <=> query_vector) > similarity_threshold
    ORDER BY cm.message_vector <=> query_vector
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION search_similar_rockets(
    query_vector vector(1536),
    user_id_param uuid DEFAULT NULL,
    similarity_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    name text,
    parts jsonb,
    motor_id text,
    drag_coefficient real,
    units text,
    tags text[],
    project_id uuid,
    user_id uuid,
    is_public boolean,
    created_at timestamptz,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT 
        r.id,
        r.name,
        r.parts,
        r.motor_id,
        r.drag_coefficient,
        r.units,
        r.tags,
        r.project_id,
        r.user_id,
        r.is_public,
        r.created_at,
        1 - (r.design_vector <=> query_vector) as similarity
    FROM public.rockets r
    WHERE 
        r.design_vector IS NOT NULL
        AND 1 - (r.design_vector <=> query_vector) > similarity_threshold
        AND (
            user_id_param IS NULL 
            OR r.user_id = user_id_param 
            OR r.is_public = true
        )
    ORDER BY r.design_vector <=> query_vector
    LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION search_similar_conversations(
    query_vector vector(1536),
    user_id_param uuid,
    similarity_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    session_id text,
    project_id uuid,
    message_count bigint,
    latest_message timestamptz,
    similarity float,
    snippet text
)
LANGUAGE sql STABLE
AS $$
    WITH session_similarities AS (
        SELECT 
            cm.session_id,
            cm.project_id,
            COUNT(*) as message_count,
            MAX(cm.created_at) as latest_message,
            MAX(1 - (cm.message_vector <=> query_vector)) as similarity,
            STRING_AGG(
                CASE WHEN LENGTH(cm.content) > 100 
                     THEN LEFT(cm.content, 100) || '...' 
                     ELSE cm.content 
                END, 
                ' | ' 
                ORDER BY cm.created_at DESC
            ) as snippet
        FROM public.chat_messages cm
        WHERE 
            cm.user_id = user_id_param
            AND cm.message_vector IS NOT NULL
            AND cm.session_id IS NOT NULL
        GROUP BY cm.session_id, cm.project_id
        HAVING MAX(1 - (cm.message_vector <=> query_vector)) > similarity_threshold
    )
    SELECT 
        session_id,
        project_id,
        message_count,
        latest_message,
        similarity,
        snippet
    FROM session_similarities
    ORDER BY similarity DESC
    LIMIT match_count;
$$;

-- Create race-condition-safe function for creating rocket versions
CREATE OR REPLACE FUNCTION create_rocket_version(
    p_rocket_id UUID,
    p_user_id UUID,
    p_rocket_name TEXT,
    p_description TEXT,
    p_parts JSONB,
    p_motor_id TEXT,
    p_drag_coefficient REAL,
    p_units TEXT,
    p_created_by_action TEXT
)
RETURNS TABLE(
    id UUID,
    version_number INTEGER,
    name TEXT,
    description TEXT,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_version INTEGER;
    v_new_version_id UUID;
    v_version_name TEXT;
BEGIN
    -- CRITICAL: Lock the rocket row to prevent concurrent access
    PERFORM 1 FROM public.rockets 
    WHERE rockets.id = p_rocket_id AND rockets.user_id = p_user_id
    FOR UPDATE;
    
    -- Get next version number atomically (within the locked transaction)
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO v_next_version
    FROM public.rocket_versions 
    WHERE rocket_id = p_rocket_id;
    
    -- Generate new version ID
    v_new_version_id := gen_random_uuid();
    
    -- Create version name
    v_version_name := p_rocket_name || ' v' || v_next_version::text;
    
    -- Insert new version (guaranteed unique version number)
    INSERT INTO public.rocket_versions (
        id,
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
        is_current,
        created_at
    ) VALUES (
        v_new_version_id,
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
        false,
        NOW()
    );
    
    -- Return the created version
    RETURN QUERY
    SELECT 
        v_new_version_id,
        v_next_version,
        v_version_name,
        p_description,
        NOW()::TIMESTAMPTZ;
END;
$$;

-- Success message
SELECT 'Clean project architecture created successfully!' as message; 