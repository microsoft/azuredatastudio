declare @condition tinyint;
SET @condition = 24;

select
d.database_id as [Database ID],
d.name as [Database],
d.recovery_model_desc as [Recovery model],
d.state_desc as [Database state],
case
    when b.type = N'D' then N'Database'
    when b.type = N'I' then N'Differential Database'
    when b.type = N'L' then N'Log'
    when b.type = N'F' then N'File or Filegroup'
    when b.type = N'G' then N'Differental File'
    when b.type = N'P' then N'Partial'
    when b.type = N'Q' then N'Differential Partial'
    else NULL
    end
as [Backup type],
b.backup_start_date as [Backup start date],
b.backup_finish_date as [Backup finish date],
case
    when m.last_backup_time is null then N'No backup found'
    when datediff(hh, m.last_backup_time, getdate()) > @condition then N'Older than 24hrs'
    else N'Within 24hrs'
    end as [Backup_Health]
from sys.databases as d
left join msdb..backupset as b on d.name = b.database_name
left join (select bs.database_name, max(bs.backup_start_date) as last_backup_time
        from msdb..backupset as bs
        group by bs.database_name ) as m  on d.name = m.database_name  and b.backup_start_date = m.last_backup_time
where (b.backup_start_date is null or b.backup_start_date = m.last_backup_time)
    and d.database_id > 4
order by d.database_id asc
