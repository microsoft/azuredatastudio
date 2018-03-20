EXEC sp_WhoIsActive 
    @show_system_spids = 1, 
    @show_own_spid = 1,
    @output_column_list = '[session_id][used_memory]',
    @sort_order = '[used_memory] DESC'