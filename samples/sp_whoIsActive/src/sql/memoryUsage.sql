IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME = 'sp_WhoIsActive')
    EXEC sp_WhoIsActive 
        @output_column_list = '[session_id][used_memory]',
        @sort_order = '[used_memory] DESC'
ELSE 
    SELECT 0;
GO