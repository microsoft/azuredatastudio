/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// General Constants ///////////////////////////////////////////////////////
export const msgYes = localize('msgYes', 'Yes');
export const msgNo = localize('msgNo', 'No');

// Jupyter Constants ///////////////////////////////////////////////////////
export const msgManagePackagesPowershell = localize('msgManagePackagesPowershell', '<#\n--------------------------------------------------------------------------------\n\tThis is the sandboxed instance of python used by Jupyter server.\n\tTo install packages used by the python kernel use \'.\\python.exe -m pip install\'\n--------------------------------------------------------------------------------\n#>');
export const msgManagePackagesBash = localize('msgJupyterManagePackagesBash', ': \'\n--------------------------------------------------------------------------------\n\tThis is the sandboxed instance of python used by Jupyter server.\n\tTo install packages used by the python kernel use \'./python3.6 -m pip install\'\n--------------------------------------------------------------------------------\n\'');
export const msgManagePackagesCmd = localize('msgJupyterManagePackagesCmd', 'REM  This is the sandboxed instance of python used by Jupyter server. To install packages used by the python kernel use \'.\\python.exe -m pip install\'');
export const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', 'This sample code loads the file into a data frame and shows the first 10 results.');
