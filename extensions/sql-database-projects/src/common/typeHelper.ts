/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';

export type ProjectType = mssql.ProjectType | vscodeMssql.ProjectType;
export type GetScriptsResult = mssql.GetScriptsResult | vscodeMssql.GetScriptsResult;
export type GetFoldersResult = mssql.GetFoldersResult | vscodeMssql.GetFoldersResult;
export type SystemDatabase = mssql.SystemDatabase | vscodeMssql.SystemDatabase;
export type SystemDbReferenceType = mssql.SystemDbReferenceType | vscodeMssql.SystemDbReferenceType;
