EXEC sys.sp_create_streaming_job @NAME = '@@OBJECT_NAME@@', @STATEMENT = 'INSERT INTO SqlOutputStream SELECT
    timeCreated,
    machine.temperature as machine_temperature,
    machine.pressure as machine_pressure,
    ambient.temperature as ambient_temperature,
    ambient.humidity as ambient_humidity
FROM EdgeHubInputStream'
