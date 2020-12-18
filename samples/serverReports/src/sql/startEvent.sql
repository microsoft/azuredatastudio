--Starts the XEvents sessions and creates the functions needed to find object id and give name to the page types
use tempdb

BEGIN TRY
IF NOT EXISTS (SELECT * FROM sys.dm_xe_sessions  WHERE name = 'PageContention')
    BEGIN
        CREATE EVENT SESSION [PageContention] ON SERVER
        ADD EVENT latch_suspend_end(
            WHERE class = 28
            AND (page_type_id = 8
            OR page_type_id = 9 
            OR page_type_id = 11))
        ADD TARGET package0.histogram(SET slots=16, filtering_event_name=N'latch_suspend_end', source=N'page_type_id', source_type=(0))
        ALTER EVENT SESSION [PageContention] ON SERVER
        STATE =  START
    END
IF NOT EXISTS (SELECT * FROM sys.dm_xe_sessions  WHERE name = 'ObjectContention')
    BEGIN
        CREATE EVENT SESSION [ObjectContention] ON SERVER
        ADD EVENT latch_suspend_end(
            WHERE class = 28
            AND database_id = 2)
        ADD TARGET package0.histogram(SET slots=256, filtering_event_name=N'latch_suspend_end', source=N'page_alloc_unit_id', source_type=(0))
        ALTER EVENT SESSION [ObjectContention] ON SERVER
        STATE =  START
    END
END TRY
BEGIN CATCH
    PRINT 'XEvent fields not supported'
END CATCH
GO

IF OBJECT_ID(N'[dbo].[isSystemTable]', N'FN') IS NOT NULL
    DROP FUNCTION [dbo].[isSystemTable]
GO

CREATE FUNCTION [dbo].[isSystemTable] (@alloc bigint)
RETURNS bigint

AS BEGIN
    
    DECLARE @index BIGINT;
    DECLARE @objId BIGINT;

    SELECT @index =
        CONVERT (BIGINT,
            CONVERT (FLOAT, @alloc)
                * (1 / POWER (2.0, 48))
        );
    SELECT @objId = 
        CONVERT (BIGINT,
            CONVERT (FLOAT, @alloc - (@index * CONVERT (BIGINT, POWER (2.0, 48))))
                * (1 / POWER (2.0, 16))
        );

    IF (@objId > 0 AND @objId <= 100 AND @index <= 255)
        return @objId
    
    return 0
    
    END
GO

IF OBJECT_ID(N'[dbo].[mapPageType]', N'FN') IS NOT NULL
    DROP FUNCTION [dbo].[mapPageType]
GO

CREATE FUNCTION [dbo].[mapPageType] (@pageTypeId bigint)
RETURNS varchar(20)

AS BEGIN
    IF @pageTypeId = 8
        return 'GAM_PAGE'
    ELSE IF @pageTypeId = 9
        return 'SGAM_PAGE'
    ELSE IF @pageTypeId = 11
        return 'PFS_PAGE'    
    return ''
    END
GO