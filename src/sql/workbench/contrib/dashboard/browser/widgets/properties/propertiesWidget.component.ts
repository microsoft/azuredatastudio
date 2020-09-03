/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Inject, forwardRef, ChangeDetectorRef, OnInit, ElementRef, ViewChild } from '@angular/core';

import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { Property, PropertiesConfig, getFlavor } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';

import { DatabaseInfo, ServerInfo } from 'azdata';
import * as types from 'vs/base/common/types';
import * as nls from 'vs/nls';
import { ILogService } from 'vs/platform/log/common/log';
import { subscriptionToDisposable } from 'sql/base/browser/lifecycle';
import { PropertiesContainer, PropertyItem } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { PROPERTIES_CONTAINER_PROPERTY_NAME, PROPERTIES_CONTAINER_PROPERTY_VALUE } from 'vs/workbench/common/theme';

@Component({
	selector: 'properties-widget',
	template: `
	<loading-spinner *ngIf="_loading" [loading]="_loading" [loadingMessage]="loadingMessage" [loadingCompletedMessage]="loadingCompletedMessage"></loading-spinner>
	<properties-container [style.display]="_loading ? 'none' : ''"></properties-container>`
})
export class PropertiesWidgetComponent extends DashboardWidget implements IDashboardWidget, OnInit {
	@ViewChild(PropertiesContainer) private _propertiesContainer: PropertiesContainer;
	public loadingMessage: string = nls.localize('loadingProperties', "Loading properties");
	public loadingCompletedMessage: string = nls.localize('loadingPropertiesCompleted', "Loading properties completed");
	private _connection: ConnectionManagementInfo;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrap: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(ILogService) private logService: ILogService
	) {
		super(changeRef);
		this.init();
	}

	ngOnInit() {
		this._inited = true;
		this._changeRef.detectChanges();
	}

	public refresh(): void {
		this.init();
	}

	private init(): void {
		this._connection = this._bootstrap.connectionManagementService.connectionInfo;
		this.setLoadingStatus(true);
		this._register(subscriptionToDisposable(this._bootstrap.adminService.databaseInfo.subscribe(databaseInfo => {
			const propertyItems = this.parseProperties(databaseInfo);
			if (this._inited) {
				this._propertiesContainer.propertyItems = propertyItems;
				this._changeRef.detectChanges();
			} else {
				this.logService.info('Database properties successfully retrieved but component not initialized yet');
			}
			this.setLoadingStatus(false);
		}, error => {
			this.setLoadingStatus(false);
			(<HTMLElement>this._el.nativeElement).innerText = nls.localize('dashboard.properties.error', "Unable to load dashboard properties");
		})));
	}

	private parseProperties(databaseInfo?: DatabaseInfo): PropertyItem[] {
		const provider = this._config.provider;

		let propertyArray: Array<Property>;

		// if config exists use that, otherwise use default
		if (this._config.widget['properties-widget'] && this._config.widget['properties-widget'].properties) {
			const config = <PropertiesConfig>this._config.widget['properties-widget'];
			propertyArray = config.properties;
		} else {
			const flavor = getFlavor(this._connection.serverInfo, this.logService, provider as string);
			if (!flavor) {
				return [];
			}
			// determine what context we should be pulling from
			if (this._config.context === 'database') {
				if (!Array.isArray(flavor.databaseProperties)) {
					this.logService.error('flavor', flavor.flavor, ' does not have a definition for database properties');
				}

				if (!Array.isArray(flavor.serverProperties)) {
					this.logService.error('flavor', flavor.flavor, ' does not have a definition for server properties');
				}

				propertyArray = flavor.databaseProperties;
			} else {
				if (!Array.isArray(flavor.serverProperties)) {
					this.logService.error('flavor', flavor.flavor, ' does not have a definition for server properties');
				}

				propertyArray = flavor.serverProperties;
			}
		}


		let infoObject: ServerInfo | {};
		if (this._config.context === 'database') {
			if (databaseInfo?.options) {
				infoObject = databaseInfo.options;
			}
		} else {
			infoObject = this._connection.serverInfo;
		}

		return propertyArray.map(property => {
			let propertyObject = this.getValueOrDefault<string>(infoObject, property.value, property.default || '--');

			// make sure the value we got shouldn't be ignored
			if (property.ignore !== undefined && propertyObject !== '--') {
				for (let j = 0; j < property.ignore.length; j++) {
					// set to default value if we should be ignoring it's value
					if (propertyObject === property.ignore[0]) {
						propertyObject = property.default || '--';
						break;
					}
				}
			}
			return {
				displayName: property.displayName,
				value: propertyObject
			};
		});
	}

	private getValueOrDefault<T>(infoObject: ServerInfo | {}, propertyName: string, defaultVal?: any): T {
		let val: T = undefined;
		let obj = propertyName in infoObject ? infoObject : ('options' in infoObject && propertyName in infoObject.options ? infoObject.options : undefined);
		if (obj) {
			val = obj[propertyName];
		}
		if (types.isUndefinedOrNull(val)) {
			val = defaultVal;
		}
		return val;
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {

	const propertyNameColor = theme.getColor(PROPERTIES_CONTAINER_PROPERTY_NAME);
	if (propertyNameColor) {
		collector.addRule(`
		properties-widget .propertyName,
		properties-widget .splitter {
			color: ${propertyNameColor}
		}`);
	}

	const propertyValueColor = theme.getColor(PROPERTIES_CONTAINER_PROPERTY_VALUE);
	if (propertyValueColor) {
		collector.addRule(`properties-widget .propertyValue {
			color: ${propertyValueColor}
		}`);
	}
});
