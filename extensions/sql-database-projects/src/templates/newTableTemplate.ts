/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO: how to disable linter for leading whitespace in multi-line strings?

export const newSqlTableTemplate = `CREATE TABLE [dbo].[@@OBJECT_NAME@@]
(
\t[Id] INT NOT NULL PRIMARY KEY
)
`;
