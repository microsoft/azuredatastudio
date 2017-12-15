SELECT Top 5 TABL.name AS table_name,
SUM(PART.rows) AS rows_count,
SUM(ALOC.total_pages) AS total_pages,
SUM(ALOC.used_pages) AS used_pages,
SUM(ALOC.data_pages) AS data_pages,
(SUM(ALOC.total_pages)*8/1024) AS total_space_MB,
(SUM(ALOC.used_pages)*8/1024) AS used_space_MB,
(SUM(ALOC.data_pages)*8/1024) AS data_space_MB
FROM sys.tables AS TABL
INNER JOIN sys.indexes AS INDX
ON TABL.object_id = INDX.object_id
INNER JOIN sys.partitions AS PART
ON INDX.object_id = PART.object_id
AND INDX.index_id = PART.index_id
INNER JOIN sys.allocation_units AS ALOC
ON PART.partition_id = ALOC.container_id
WHERE
INDX.object_id > 255
AND INDX.index_id <= 1
GROUP BY TABL.name,
INDX.object_id,
INDX.index_id,
INDX.name
ORDER BY
(SUM(ALOC.total_pages)*8/1024) DESC