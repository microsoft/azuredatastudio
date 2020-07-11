/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IDashboardTab {
	id: string;
	title: string;
	provider: string | string[];
	publisher: string;
	description?: string;
	container?: { [key: string]: any };
	when?: string;
	alwaysShow?: boolean;
	isHomeTab?: boolean;
	group?: string;
	iconClass?: string;
}

export interface IDashboardTabGroup {
	id: string;
	title: string;
}
