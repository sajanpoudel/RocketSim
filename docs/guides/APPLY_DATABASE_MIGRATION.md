# 🚀 Database Migration Instructions
## Fix Missing rocket_versions Table

**Problem:** The `rocket_versions` table doesn't exist in your Supabase database, causing 404 errors when trying to load version history.

**Solution:** Apply the SQL migration to create the missing table.

## Steps to Apply Migration

### Option 1: Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - Open https://supabase.com/dashboard/projects
   - Select your ROCKETv1 project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Copy the contents of `database_schema_rocket_versions.sql`
   - Paste into the SQL editor
   - Click "Run" to execute

4. **Verify Creation**
   ```sql
   -- Check if table was created
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'rocket_versions';
   
   -- Check table structure
   \d public.rocket_versions;
   ```

### Option 2: Supabase CLI (Alternative)

```bash
# If you have Supabase CLI installed
supabase db reset
supabase migration new create_rocket_versions_table
# Copy the SQL content to the new migration file
supabase db push
```

## Expected Result

After applying the migration, you should see:
- ✅ No more 404 errors for rocket_versions
- ✅ Version history working in the right panel
- ✅ Proper version tracking per project
- ✅ No duplicate projects in left panel

## Test the Fix

1. **Create a new rocket design**
2. **Make some changes via AI chat**
3. **Check right panel → Versions tab (🕐)**
4. **Verify each project has its own version history**

---

**Next Steps:** After applying this migration, the version control system will work properly and you'll see version history in the right panel instead of duplicate projects in the left panel. 