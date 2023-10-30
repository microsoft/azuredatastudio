/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export namespace nbversion {
	/**
	 * The major version of the notebook format.
	 */
	export const MAJOR_VERSION: number = 4;

	/**
	 * The minor version of the notebook format.
	 */
	export const MINOR_VERSION: number = 2;
}

export enum KernelsLanguage {
	SQL = 'sql',
	Python = 'python',
	PowerShell = 'powershell',
	CSharp = 'csharp',
	FSharp = 'fsharp'
}
