/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


//Select all databases available on the server with size
export const SELECT_ALL_DB_W_SIZE = `
WITH
db_size
AS
(
SELECT database_id, CAST(SUM(size) * 8.0 / 1024 AS INTEGER) size
FROM sys.master_files with (nolock)
GROUP BY database_id
)
SELECT name, state_desc AS state, db_size.size
FROM sys.databases with (nolock) LEFT JOIN db_size ON sys.databases.database_id = db_size.database_id
WHERE sys.databases.state = 0
`;
