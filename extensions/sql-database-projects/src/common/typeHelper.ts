/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';

export type ProjectType = mssql.ProjectType | vscodeMssql.ProjectType;