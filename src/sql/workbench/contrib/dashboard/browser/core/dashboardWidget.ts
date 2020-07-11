/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InjectionToken, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NgGridItemConfig } from 'angular2-grid';
import { Action } from 'vs/base/common/actions';
import { Disposable } from 'vs/base/common/lifecycle';
import { TabType } from 'sql/base/browser/ui/panel/tab.component';
import { IDashboardTab } from 'sql/workbench/services/dashboard/browser/common/interfaces';

export interface IDashboardWidget {
	actions: Array<Action>;
	actionsContext?: any;
	refresh?: () => void;
	layout?: () => void;
}

export const WIDGET_CONFIG = new InjectionToken<WidgetConfig>('widget_config');

export interface WidgetConfig {
	id?: string; // used to track the widget lifespan operations
	name?: string;
	icon?: string;
	context: string;
	provider: string | Array<string>;
	edition: number | Array<number>;
	when?: string;
	gridItemConfig?: NgGridItemConfig;
	widget: { [key: string]: any };
	background_color?: string;
	border?: string;
	fontSize?: string;
	fontWeight?: string;
	padding?: string;
	hideHeader?: boolean;
}

export interface TabConfig extends IDashboardTab {
	context: string;
	originalConfig: Array<WidgetConfig>;
	editable: boolean;
	canClose: boolean;
	actions?: Array<Action>;
	type?: TabType;
}


export type IUserFriendlyIcon = string | { light: string; dark: string; };

export interface NavSectionConfig {
	id: string;
	title: string;
	iconClass?: string;
	icon?: IUserFriendlyIcon;
	container: { [key: string]: any };
}

export interface TabSettingConfig {
	tabId: string;
	isPinned: boolean;
}

export abstract class DashboardWidget extends Disposable implements OnDestroy {
	protected _config: WidgetConfig;
	protected _loading: boolean;
	protected _inited: boolean = false;
	protected _loadingMessage: string;
	protected _loadingCompletedMessage: string;

	constructor(protected _changeRef: ChangeDetectorRef) {
		super();
	}

	get actions(): Array<Action> {
		return [];
	}

	ngOnDestroy() {
		this.dispose();
	}

	protected setLoadingStatus(loading: boolean): void {
		this._loading = loading;
		if (this._inited) {
			this._changeRef.detectChanges();
		}
	}
}
