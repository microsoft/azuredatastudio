/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { InjectionToken } from '@angular/core';
import { NgGridItemConfig } from 'angular2-grid';
import { Action } from 'vs/base/common/actions';

export interface IDashboardWidget {
	actions: Array<Action>;
	actionsContext?: any;
	refresh?: () => void;
}

export const WIDGET_CONFIG = new InjectionToken<WidgetConfig>('widget_config');

export interface WidgetConfig {
	name?: string;
	icon?: string;
	context: string;
	provider: string | Array<string>;
	edition: number | Array<number>;
	gridItemConfig?: NgGridItemConfig;
	widget: Object;
	background_color?: string;
	border?: string;
	fontSize?: string;
	fontWeight?: string;
	padding?:string;
}

export abstract class DashboardWidget {
	protected _config: WidgetConfig;

	get actions(): Array<Action> {
		return [];
	}
}