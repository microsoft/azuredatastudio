IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME = 'sp_WhoIsActive')
    EXEC sp_WhoIsActive 
        @output_column_list = '[session_id][CPU]',
        @sort_order = '[CPU] DESC'
ELSE 
    SELECT 0;
GO