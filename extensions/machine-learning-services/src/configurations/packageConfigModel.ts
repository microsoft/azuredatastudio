/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface PackageConfigModel {
	name: string;
	version?: string;
	repository?: string;
	downloadUrl?: string;
	fileName?: string;
}
