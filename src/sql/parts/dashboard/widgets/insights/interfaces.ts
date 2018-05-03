/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IStateCondition {
	condition: {
		if: string,
		equals?: string
	};
	color?: string;
	icon?: string;
}

export interface IInsightsLabel {
	column: string;
	icon?: string;
	state?: Array<IStateCondition>;
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

export interface IInsightData {
	columns: Array<string>;
	rows: Array<Array<string>>;
}

export interface IInsightsView {
	data: IInsightData;
	setConfig?: (config: { [key: string]: any }) => void;
	init?: () => void;
}

export interface ISize {
	x: number;
	y: number;
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
}
export interface IInsightTypeContrib {
	id: string;
	contrib: IInsightsConfig;
}