/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as platform from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';
import { values } from 'vs/base/common/collections';
import { IInsightsConfig } from 'sql/platform/extensions/common/extensions';

export type InsightIdentifier = string;

export const Extensions = {
	InsightContribution: 'dashboard.contributions.insights'
};

export interface IInsightData {
	columns: string[];
	rows: string[][];
}

export interface IInsightsView {
	data: IInsightData;
	setConfig?: (config: any) => void;
	init?: () => void;
}

export interface IInsightRegistry {
	insightSchema: IJSONSchema;
	registerInsight(id: string, description: string, schema: IJSONSchema, ctor: IInsightsViewCtor): InsightIdentifier;
	registerExtensionInsight(id: string, val: IInsightsConfig): void;
	getRegisteredExtensionInsights(id: string): IInsightsConfig;
	getCtorFromId(id: string): IInsightsViewCtor;
	getAllCtors(): Array<IInsightsViewCtor>;
	getAllIds(): Array<string>;
}

interface IInsightsViewCtor {
	new(...args: any[]): IInsightsView;
}

class InsightRegistry implements IInsightRegistry {
	private _insightSchema: IJSONSchema = { type: 'object', description: nls.localize('schema.dashboardWidgets.InsightsRegistry', "Widget used in the dashboards"), properties: {}, additionalProperties: false };
	private _extensionInsights: { [x: string]: IInsightsConfig } = {};
	private _idToCtor: { [x: string]: IInsightsViewCtor } = {};

	/**
	 * Register a dashboard widget
	 * @param id id of the widget
	 * @param description description of the widget
	 * @param schema config schema of the widget
	 */
	public registerInsight(id: string, description: string, schema: IJSONSchema, ctor: IInsightsViewCtor): InsightIdentifier {
		this._insightSchema.properties![id] = schema;
		this._idToCtor[id] = ctor;
		return id;
	}

	public registerExtensionInsight(id: string, val: IInsightsConfig): void {
		this._extensionInsights[id] = val;
	}

	public getRegisteredExtensionInsights(id: string): IInsightsConfig {
		return this._extensionInsights[id];
	}

	public getCtorFromId(id: string): IInsightsViewCtor {
		return this._idToCtor[id];
	}

	public getAllCtors(): Array<IInsightsViewCtor> {
		return values(this._idToCtor);
	}

	public getAllIds(): Array<string> {
		return Object.keys(this._idToCtor);
	}

	public get insightSchema(): IJSONSchema {
		return this._insightSchema;
	}
}

const insightRegistry = new InsightRegistry();
platform.Registry.add(Extensions.InsightContribution, insightRegistry);

export function registerInsight(id: string, description: string, schema: IJSONSchema, ctor: IInsightsViewCtor): InsightIdentifier {
	return insightRegistry.registerInsight(id, description, schema, ctor);
}

const WidgetAutoRefreshState: { [key: string]: boolean } = {};

export function getWidgetAutoRefreshState(widgetId: string, connectionId: string): boolean {
	const key = widgetId + connectionId;
	return Object.keys(WidgetAutoRefreshState).indexOf(key) === -1 || WidgetAutoRefreshState[key];
}

export function setWidgetAutoRefreshState(widgetId: string, connectionId: string, state: boolean): void {
	WidgetAutoRefreshState[widgetId + connectionId] = state;
}
