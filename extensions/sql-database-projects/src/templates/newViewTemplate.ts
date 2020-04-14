/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// TODO: how to disable linter for leading whitespace in multi-line strings?

export const newSqlViewTemplate = `CREATE VIEW [dbo].[@@OBJECT_NAME@@]
\u0020AS SELECT * FROM [SomeTableOrView]
`;
