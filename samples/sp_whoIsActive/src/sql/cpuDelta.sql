IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME = 'sp_WhoIsActive')
    EXEC sp_WhoIsActive 
        @delta_interval = 1,
        @output_column_list = '[session_id][CPU_delta]',
        @sort_order = '[CPU_delta] DESC'
ELSE 
    SELECT 0;
GO