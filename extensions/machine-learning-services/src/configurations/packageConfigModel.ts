/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The model for package config value
 */
export interface PackageConfigModel {

	/**
	 * Package name
	 */
	name: string;

	/**
	 * Package version
	 */
	version?: string;

	/**
	 * Package repository
	 */
	repository?: string;

	/**
	 * Package download url
	 */
	downloadUrl?: string;

	/**
	 * Package file name if package has download url
	 */
	fileName?: string;

	/**
	 * Package platform (Windows, Mac, Linux)
	 */
	platform?: string;
}
