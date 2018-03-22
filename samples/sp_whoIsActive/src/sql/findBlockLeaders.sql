IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_NAME = 'sp_WhoIsActive')
    EXEC sp_WhoIsActive 
<<<<<<< Updated upstream
        @find_block_leaders = 1, 
=======
        @find_block_leaders = 1,
        @get_plans = 1,
>>>>>>> Stashed changes
        @sort_order = '[blocked_session_count] DESC'
GO