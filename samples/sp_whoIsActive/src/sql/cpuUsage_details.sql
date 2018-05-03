IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME = 'sp_WhoIsActive')
    EXEC sp_WhoIsActive 
        @get_plans = 1,
        @sort_order = '[CPU] DESC'
ELSE 
    SELECT 0;
GO
