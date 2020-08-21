/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtensionContributions as vsIExtensionContributions } from 'vs/platform/extensions/common/extensions';


export interface ISize {
	x: number;
	y: number;
}

export interface IInsightsConfigDetails {
	query?: string | Array<string>;
	queryFile?: string;
	label?: string | IInsightsLabel;
	value?: string;
	actions?: {
		types: Array<string>;
		database?: string;
		server?: string;
		user?: string;
	};
}

export interface IInsightsLabel {
	column: string;
	icon?: string;
	state?: Array<IStateCondition>;
}

export interface IStateCondition {
	condition: {
		if: string,
		equals?: string
	};
	color?: string;
	icon?: string;
}

export interface IInsightsConfig {
	cacheId?: string;
	type: any;
	name?: string;
	when?: string;
	gridItemConfig?: ISize;
	query?: string | Array<string>;
	queryFile?: string;
	details?: IInsightsConfigDetails;
	autoRefreshInterval?: number;
	id?: string;
}

export interface IInsightTypeContrib {
	id: string;
	contrib: IInsightsConfig;
}

export type IUserFriendlyIcon = string | { light: string; dark: string; };

export interface IDashboardTabContrib {
	id: string;
	title: string;
	container: { [key: string]: any };
	provider: string | string[];
	when?: string;
	description?: string;
	alwaysShow?: boolean;
	isHomeTab?: boolean;
	group?: string;
	icon?: IUserFriendlyIcon;
}

export interface IInsightTypeContrib {
	id: string;
	contrib: IInsightsConfig;
}

export interface IExtensionContributions extends vsIExtensionContributions {
	readonly 'dashboard.insights'?: IInsightTypeContrib | IInsightTypeContrib[];
	readonly 'dashboard.tabs'?: IDashboardTabContrib | IDashboardTabContrib[]
}
