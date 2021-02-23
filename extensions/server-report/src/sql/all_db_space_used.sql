--Source: https://gallery.technet.microsoft.com/scriptcenter/All-Databases-Data-log-a36da95d
-- Use for a demo/sample purpose only. This query is not built-in to any product.

------------------------------Data file size----------------------------
declare @dbsize table
(Dbname nvarchar(128),
    file_Size_MB decimal(20,2)default (0),
    Space_Used_MB decimal(20,2)default (0),
    Free_Space_MB decimal(20,2) default (0))
insert into @dbsize
    (Dbname,file_Size_MB,Space_Used_MB,Free_Space_MB)
exec sp_MSforeachdb
'use [?];
  select DB_NAME() AS DbName,
sum(size)/128.0 AS File_Size_MB,
sum(CAST(FILEPROPERTY(name, ''SpaceUsed'') AS INT))/128.0 as Space_Used_MB,
SUM( size)/128.0 - sum(CAST(FILEPROPERTY(name,''SpaceUsed'') AS INT))/128.0 AS Free_Space_MB
from sys.database_files  where type=0 group by type'
-------------------log size--------------------------------------
declare @logsize table
(Dbname nvarchar(128),
    Log_File_Size_MB decimal(20,2)default (0),
    log_Space_Used_MB decimal(20,2)default (0),
    log_Free_Space_MB decimal(20,2)default (0))
insert into @logsize
    (Dbname,Log_File_Size_MB,log_Space_Used_MB,log_Free_Space_MB)
exec sp_MSforeachdb
'use [?];
  select DB_NAME() AS DbName,
sum(size)/128.0 AS Log_File_Size_MB,
sum(CAST(FILEPROPERTY(name, ''SpaceUsed'') AS INT))/128.0 as log_Space_Used_MB,
SUM( size)/128.0 - sum(CAST(FILEPROPERTY(name,''SpaceUsed'') AS INT))/128.0 AS log_Free_Space_MB
from sys.database_files  where type=1 group by type'
--------------------------------database free size
declare @dbfreesize table
(name nvarchar(128),
    database_size varchar(50),
    Freespace varchar(50)default (0.00))
insert into @dbfreesize
    (name,database_size,Freespace)
exec sp_MSforeachdb
'use [?];SELECT database_name = db_name()
    ,database_size = ltrim(str((convert(DECIMAL(15, 2), dbsize) + convert(DECIMAL(15, 2), logsize)) * 8192 / 1048576, 15, 2) + ''MB'')
    ,''unallocated space'' = ltrim(str((
                CASE
                    WHEN dbsize >= reservedpages
                        THEN (convert(DECIMAL(15, 2), dbsize) - convert(DECIMAL(15, 2), reservedpages)) * 8192 / 1048576
                    ELSE 0
                    END
                ), 15, 2) + '' MB'')
FROM (
    SELECT dbsize = sum(convert(BIGINT, CASE
                    WHEN type = 0
                        THEN size
                    ELSE 0
                    END))
        ,logsize = sum(convert(BIGINT, CASE
                    WHEN type <> 0
                        THEN size
                    ELSE 0
                    END))
    FROM sys.database_files
) AS files
,(
    SELECT reservedpages = sum(a.total_pages)
        ,usedpages = sum(a.used_pages)
        ,pages = sum(CASE
                WHEN it.internal_type IN (
                        202
                        ,204
                        ,211
                        ,212
                        ,213
                        ,214
                        ,215
                        ,216
                        )
                    THEN 0
                WHEN a.type <> 1
                    THEN a.used_pages
                WHEN p.index_id < 2
                    THEN a.data_pages
                ELSE 0
                END)
    FROM sys.partitions p
    INNER JOIN sys.allocation_units a
        ON p.partition_id = a.container_id
    LEFT JOIN sys.internal_tables it
        ON p.object_id = it.object_id
) AS partitions'
-----------------------------------
select TOP 10
    d.Dbname,
    --(file_size_mb + log_file_size_mb) as DBsize,
    --d.file_Size_MB,
    d.Space_Used_MB,
    --d.Free_Space_MB,
    --l.Log_File_Size_MB,
    l.log_Space_Used_MB--,
    --l.log_Free_Space_MB,
    --fs.Freespace as DB_Freespace
from @dbsize d join @logsize l on d.Dbname=l.Dbname join @dbfreesize fs on d.Dbname=fs.name
order by d.Space_Used_MB DESC
