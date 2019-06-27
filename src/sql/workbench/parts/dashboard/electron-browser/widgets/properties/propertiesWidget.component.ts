/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Inject, forwardRef, ChangeDetectorRef, OnInit, ElementRef, ViewChild } from '@angular/core';

import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/parts/dashboard/electron-browser/core/dashboardWidget';
import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { toDisposableSubscription } from 'sql/base/node/rxjsUtils';
import { IDashboardRegistry, Extensions as DashboardExtensions } from 'sql/platform/dashboard/electron-browser/dashboardRegistry';

import { DatabaseInfo, ServerInfo } from 'azdata';

import { EventType, addDisposableListener } from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';
import * as nls from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { ILogService } from 'vs/platform/log/common/log';

export interface PropertiesConfig {
	properties: Array<Property>;
}

export interface FlavorProperties {
	flavor: string;
	condition?: {
		field: string;
		operator: '==' | '<=' | '>=' | '!=';
		value: string | boolean;
	};
	databaseProperties: Array<Property>;
	serverProperties: Array<Property>;
}

export interface ProviderProperties {
	provider: string;
	flavors: Array<FlavorProperties>;
}

export interface Property {
	displayName: string;
	value: string;
	ignore?: Array<string>;
	default?: string;
}

const dashboardRegistry = Registry.as<IDashboardRegistry>(DashboardExtensions.DashboardContributions);

export interface DisplayProperty {
	displayName: string;
	value: string;
}

@Component({
	selector: 'properties-widget',
	templateUrl: decodeURI(require.toUrl('sql/workbench/parts/dashboard/widgets/properties/propertiesWidget.component.html'))
})
export class PropertiesWidgetComponent extends DashboardWidget implements IDashboardWidget, OnInit {
	private _connection: ConnectionManagementInfo;
	private _databaseInfo: DatabaseInfo;
	private _clipped: boolean;
	private properties: Array<DisplayProperty>;
	private _hasInit = false;

	@ViewChild('child', { read: ElementRef }) private _child: ElementRef;
	@ViewChild('parent', { read: ElementRef }) private _parent: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrap: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(ILogService) private logService: ILogService
	) {
		super();
		this.init();
	}

	ngOnInit() {
		this._hasInit = true;
		this._register(addDisposableListener(window, EventType.RESIZE, () => this.handleClipping()));
		this._changeRef.detectChanges();
	}

	public refresh(): void {
		this.init();
	}

	private init(): void {
		this._connection = this._bootstrap.connectionManagementService.connectionInfo;
		this._register(toDisposableSubscription(this._bootstrap.adminService.databaseInfo.subscribe(data => {
			this._databaseInfo = data;
			this._changeRef.detectChanges();
			this.parseProperties();
			if (this._hasInit) {
				this.handleClipping();
			}
		}, error => {
			(<HTMLElement>this._el.nativeElement).innerText = nls.localize('dashboard.properties.error', "Unable to load dashboard properties");
		})));
	}

	private handleClipping(): void {
		if (this._child.nativeElement.offsetWidth > this._parent.nativeElement.offsetWidth) {
			this._clipped = true;
		} else {
			this._clipped = false;
		}
		this._changeRef.detectChanges();
	}

	private parseProperties() {
		const provider = this._config.provider;

		let propertyArray: Array<Property>;

		// if config exists use that, otherwise use default
		if (this._config.widget['properties-widget'] && this._config.widget['properties-widget'].properties) {
			const config = <PropertiesConfig>this._config.widget['properties-widget'];
			propertyArray = config.properties;
		} else {
			const providerProperties = dashboardRegistry.getProperties(provider as string);

			if (!providerProperties) {
				this.logService.error('No property definitions found for provider', provider);
				return;
			}

			let flavor: FlavorProperties;

			// find correct flavor
			if (providerProperties.flavors.length === 1) {
				flavor = providerProperties.flavors[0];
			} else if (providerProperties.flavors.length === 0) {
				this.logService.error('No flavor definitions found for "', provider,
					'. If there are not multiple flavors of this provider, add one flavor without a condition');
				return;
			} else {
				const flavorArray = providerProperties.flavors.filter((item) => {
					const condition = this._connection.serverInfo[item.condition.field];
					switch (item.condition.operator) {
						case '==':
							return condition === item.condition.value;
						case '!=':
							return condition !== item.condition.value;
						case '>=':
							return condition >= item.condition.value;
						case '<=':
							return condition <= item.condition.value;
						default:
							this.logService.error('Could not parse operator: "', item.condition.operator,
								'" on item "', item, '"');
							return false;
					}
				});

				if (flavorArray.length === 0) {
					this.logService.error('Could not determine flavor');
					return;
				} else if (flavorArray.length > 1) {
					this.logService.error('Multiple flavors matched correctly for this provider', provider);
					return;
				}

				flavor = flavorArray[0];
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
			if (this._databaseInfo && this._databaseInfo.options) {
				infoObject = this._databaseInfo.options;
			}
		} else {
			infoObject = this._connection.serverInfo;
		}

		// iterate over properties and display them
		this.properties = [];
		for (let i = 0; i < propertyArray.length; i++) {
			const property = propertyArray[i];
			const assignProperty = {};
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
			assignProperty['displayName'] = property.displayName;
			assignProperty['value'] = propertyObject;
			this.properties.push(<DisplayProperty>assignProperty);
		}

		if (this._hasInit) {
			this._changeRef.detectChanges();
		}
	}

	private getValueOrDefault<T>(infoObject: ServerInfo | {}, propertyValue: string, defaultVal?: any): T {
		let val: T = undefined;
		if (infoObject) {
			val = infoObject[propertyValue];
		}
		if (types.isUndefinedOrNull(val)) {
			val = defaultVal;
		}
		return val;
	}
}
