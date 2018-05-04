SELECT blocking_session_id
FROM sys.dm_os_waiting_tasks
WHERE 
    blocking_session_id IS NOT NULL