EXEC sp_WhoIsActive 
    @find_block_leaders = 1, 
    @sort_order = '[blocked_session_count] DESC'