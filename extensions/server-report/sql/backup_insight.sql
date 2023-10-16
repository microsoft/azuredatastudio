declare @condition tinyint;
SET @condition = 24;
with
    backupInsight_cte (database_id, last_backup, health_check)
    as
    (
        select d.database_id, max(b.backup_start_date) AS last_backup, case when (datediff( hh , max(b.backup_start_date) , getdate()) < @condition) then 1 else 0 end as health_check
        from sys.databases as d left join msdb..backupset as b on d.name = b.database_name
        group by d.database_id
    )
select 
    sum(health_check) [Within 24hrs], 
    sum(case when health_check = 0 AND last_backup IS NOT NULL then 1 else 0 end) [Older than 24hrs], 
    sum(case when health_check = 0 AND last_backup IS NULL then 1 else 0 end) [No backup found]
from backupInsight_cte