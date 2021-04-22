--SQL script to grab all contention
Use tempdb
DECLARE @pc XML;
DECLARE @obj XML;

SELECT @pc = CAST(t.target_data AS XML)
FROM sys.dm_xe_sessions AS s
JOIN sys.dm_xe_session_targets AS t
    ON t.event_session_address = s.address
WHERE s.name = N'PageContention' and t.target_name = N'histogram';

SELECT @obj = CAST(t.target_data AS XML)
FROM sys.dm_xe_sessions AS s
JOIN sys.dm_xe_session_targets AS t
    ON t.event_session_address = s.address
WHERE s.name = N'ObjectContention' and t.target_name = N'histogram';

SELECT 'Metadata Contention' AS wait_type, SUM(obj.count) AS [Count]
FROM (
SELECT
    n.value('(value)[1]','bigint') AS alloc_unit_id,
    n.value('(@count)[1]', 'bigint') AS [count]
    FROM @obj.nodes('//HistogramTarget/Slot') AS q(n)
) obj
WHERE [dbo].[isSystemTable](obj.alloc_unit_id) not in (0, 99)
UNION
SELECT 'Allocation Contention' AS wait_type, SUM(pc.count) AS [Count]
FROM
(
SELECT
    n.value('(@count)[1]', 'bigint') AS [count]
FROM @pc.nodes('//HistogramTarget/Slot') AS q(n)
) pc
