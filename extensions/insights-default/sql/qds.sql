declare @qds_status int = (SELECT actual_state 
FROM sys.database_query_store_options)  
if @qds_status > 0
Begin
WITH SlowestQry AS( 
    SELECT TOP 5  
        q.query_id, 
        MAX(rs.max_duration ) max_duration 
    FROM sys.query_store_query_text AS qt    
    JOIN sys.query_store_query AS q    
        ON qt.query_text_id = q.query_text_id    
    JOIN sys.query_store_plan AS p    
        ON q.query_id = p.query_id    
    JOIN sys.query_store_runtime_stats AS rs    
        ON p.plan_id = rs.plan_id   
    WHERE rs.last_execution_time > DATEADD(week, -1, GETUTCDATE())   
    AND is_internal_query = 0 
    GROUP BY q.query_id 
    ORDER BY MAX(rs.max_duration ) DESC) 
SELECT  
    q.query_id,  
    format(rs.last_execution_time,'yyyy-MM-dd hh:mm:ss') as [last_execution_time],
    rs.max_duration,  
    p.plan_id 
FROM sys.query_store_query_text AS qt    
    JOIN sys.query_store_query AS q    
        ON qt.query_text_id = q.query_text_id    
    JOIN sys.query_store_plan AS p    
        ON q.query_id = p.query_id    
    JOIN sys.query_store_runtime_stats AS rs    
        ON p.plan_id = rs.plan_id   
    JOIN SlowestQry tq 
        ON tq.query_id = q.query_id 
WHERE rs.last_execution_time > DATEADD(week, -1, GETUTCDATE())   
AND is_internal_query = 0 
order by format(rs.last_execution_time,'yyyy-MM-dd hh:mm:ss')
END
else 
select 0 as [query_id], getdate() as [QDS is not enabled], 0 as  [max_duration]