IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME = 'sp_WhoIsActive')
    EXEC sp_WhoIsActive 
        @delta_interval = 1,
        @get_plans = 1,
        @sort_order = '[used_memory_delta] DESC'
ELSE 
    SELECT 0;
GO