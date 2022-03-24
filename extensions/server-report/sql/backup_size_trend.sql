SELECT
[database_name] AS "database",
format(backup_start_date, 'yyyy-MM-dd') as date,
--DATEPART(month,[backup_start_date]) AS "Month",
AVG([backup_size]/1024/1024) AS "size MB"
--AVG([compressed_backup_size]/1024/1024) AS "Compressed Backup Size MB",
--AVG([backup_size]/[compressed_backup_size]) AS "Compression Ratio"
from (SELECT TOP 100 *
FROM msdb.dbo.backupset
where [type] = 'D'
ORDER BY backup_start_date DESC) AS recentbackups
GROUP BY [database_name], format(backup_start_date, 'yyyy-MM-dd') --DATEPART(mm,[backup_start_date]);
