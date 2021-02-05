--SQL script to grab allocation contention from histogram
Use tempdb
DECLARE @target_data XML;
SELECT @target_data = CAST(t.target_data AS XML)
FROM sys.dm_xe_sessions AS s
JOIN sys.dm_xe_session_targets AS t
    ON t.event_session_address = s.address
WHERE s.name = N'PageContention' and t.target_name = N'histogram';

with wait_stats as
(
SELECT
    n.value('(value)[1]','bigint') AS id,
    n.value('(@count)[1]', 'bigint') AS [Count]
FROM @target_data.nodes('//HistogramTarget/Slot') AS q(n)
)

SELECT [dbo].[mapPageType](wait_stats.id), wait_stats.Count
FROM wait_stats
