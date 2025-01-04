/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PythonPkgDetails } from './jupyterServerInstallation'

export interface RequiredPackagesInfo {
	sharedPackages: PythonPkgDetails[];
	kernels: {
		name: string;
		packages: PythonPkgDetails[];
	}[];
}

export const requiredJupyterPackages: RequiredPackagesInfo = {
	sharedPackages: [{
		name: 'jupyter',
		version: '1.0.0'
	},
	// Require notebook 7.2.2 for https://github.com/microsoft/azuredatastudio/issues/25327
	{
		name: 'notebook',
		version: '7.2.2',
		installExactVersion: true
	},
	// Require ipykernel 6.5.0 for https://github.com/microsoft/azuredatastudio/issues/26075
	{
		name: 'ipykernel',
		version: '6.5.0',
		installExactVersion: true
	}],
	kernels: [{
		name: 'Python 3 (ipykernel)',
		packages: []
	}, {
		name: 'Python 3',
		packages: []
	}, {
		name: 'PowerShell',
		packages: [{
			name: 'powershell-kernel',
			version: '0.1.4'
		}]
	}]
}
