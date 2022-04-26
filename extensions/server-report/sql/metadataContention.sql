--SQL script to grab metadata contention from histogram
Use tempdb
DECLARE @target_data XML;
SELECT @target_data = CAST(t.target_data AS XML)
FROM sys.dm_xe_sessions AS s
JOIN sys.dm_xe_session_targets AS t
    ON t.event_session_address = s.address
WHERE s.name = N'ObjectContention' and t.target_name = N'histogram';

with wait_stats as
(
SELECT
    n.value('(value)[1]','bigint') AS alloc_unit_id,
    n.value('(@count)[1]', 'bigint') AS [Count]
FROM @target_data.nodes('//HistogramTarget/Slot') AS q(n)
)

SELECT objects.id,  SUM(objects.count) as [Count] FROM 
    (SELECT [dbo].[isSystemTable](wait_stats.alloc_unit_id) AS id, wait_stats.Count AS [count]
    FROM wait_stats
    WHERE [dbo].[isSystemTable](wait_stats.alloc_unit_id) not in (0, 99)) AS objects
GROUP BY objects.id
