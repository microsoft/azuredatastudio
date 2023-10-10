-- External Streaming Jobs have dependencies on External Streams.
-- You will need to separately create External Streams in order to
-- successfully deploy this script.  For more information, see:
-- https://docs.microsoft.com/en-us/azure/azure-sql-edge/create-stream-analytics-job

EXEC sys.sp_create_streaming_job @NAME = '@@OBJECT_NAME@@', @STATEMENT = 'INSERT INTO SqlOutputStream SELECT
    timeCreated,
    streamColumn1 as Id
FROM EdgeHubInputStream'
