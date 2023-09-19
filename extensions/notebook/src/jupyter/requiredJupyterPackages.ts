/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PythonPkgDetails } from './jupyterServerInstallation'

export interface PackagesManifest {
	sharedPackages: PythonPkgDetails[];
	kernels: {
		name: string;
		packages: PythonPkgDetails[];
	}[];
}

export const requiredJupyterPackages: PackagesManifest = {
	sharedPackages: [{
		name: 'jupyter',
		version: '1.0.0'
	}, {
		name: 'notebook',
		version: '6.5.5',
		installExactVersion: true
	}, {
		name: 'ipykernel',
		version: '5.5.5',
		installExactVersion: true
	}, {
		name: 'traitlets',
		version: '5.9.0',
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
