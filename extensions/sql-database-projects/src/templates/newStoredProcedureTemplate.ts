/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO: how to disable linter for leading whitespace in multi-line strings?

export const newSqlStoredProcedureTemplate = `CREATE PROCEDURE [dbo].[@@OBJECT_NAME@@]
@param1 int = 0,
@param2 int
AS
SELECT @param1, @param2
RETURN 0
`;
