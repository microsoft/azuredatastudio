/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
	hideRefreshTask?: boolean;
}

export interface IDashboardTabGroup {
	id: string;
	title: string;
}
