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
	// Require notebook 6.5.6 for https://github.com/jupyter/notebook/issues/7048
	{
		name: 'notebook',
		version: '6.5.6',
		installExactVersion: true
	},
	// Require ipykernel 5.5.5 for https://github.com/microsoft/azuredatastudio/issues/24405
	{
		name: 'ipykernel',
		version: '5.5.5',
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
