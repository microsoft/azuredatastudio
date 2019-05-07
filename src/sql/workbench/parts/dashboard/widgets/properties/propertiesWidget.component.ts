/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/propertiesWidget';

import { Component, Inject, forwardRef, ChangeDetectorRef, OnInit, ElementRef, ViewChild } from '@angular/core';

import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/parts/dashboard/common/dashboardWidget';
import { CommonServiceInterface } from 'sql/platform/bootstrap/node/commonServiceInterface.service';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { toDisposableSubscription } from 'sql/base/node/rxjsUtils';
import { IDashboardRegistry, Extensions as DashboardExtensions } from 'sql/platform/dashboard/common/dashboardRegistry';

import { DatabaseInfo, ServerInfo } from 'azdata';

import { EventType, addDisposableListener } from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';
import * as nls from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';
import { ILogService } from 'vs/platform/log/common/log';
import { IEndpoint } from 'sql/workbench/parts/notebook/notebookUtils';

export interface PropertiesConfig {
	properties: Array<Property>;
}

export interface EndpointsConfig {
	endpoints: Array<IEndpoint>;
}

export interface Endpoint {
	serviceName: string;
	ipAddress: string;
	port: number;
	hyperlink: string;
}

export enum EndpointConstants {
	clusterEndpoints = 'clusterEndpoints',
	gateway = 'gateway',
	hyperlink = 'hyperlink',
	managementproxy = 'management-proxy'
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
	hyperlink: boolean;
}

@Component({
	selector: 'properties-widget',
	templateUrl: decodeURI(require.toUrl('sql/workbench/parts/dashboard/widgets/properties/propertiesWidget.component.html'))
})
export class PropertiesWidgetComponent extends DashboardWidget implements IDashboardWidget, OnInit {
	private _connection: ConnectionManagementInfo;
	private _databaseInfo: DatabaseInfo;
	private _clipped: boolean;
	private _loading: boolean = true;
	private properties: Array<DisplayProperty>;
	private _hasInit = false;
	private endpoints: Array<Endpoint>;

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
			this._loading = true;
			this._databaseInfo = data;
			this._changeRef.detectChanges();
			this.parseConfig();
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

	private parseConfig() {
		// if config exists use that, otherwise use default
		if (this._config.widget['properties-widget'] && this._config.widget['properties-widget'].properties) {
			const config = <PropertiesConfig>this._config.widget['properties-widget'];
			this.parseProperties(config.properties);
		}
		else if (this._config.widget['properties-widget'] && this._config.widget['properties-widget'].endpoints) {
			this.parseEndpoints();
		}
		else {
			this.parseProperties(null);
		}
		this._loading = false;
	}

	private parseEndpoints() {
		if (!this.endpoints || this.endpoints.length === 0) {
			this.getEndpoints();
		}

		// iterate over endpoint properties and display them
		this.properties = [];
		for (let i = 0; i < this.endpoints.length; i++) {
			const endpoint = this.endpoints[i];
			const assignProperty = {};
			let propertyObject = this.getValueOrDefault<string>(this.endpoints[i], EndpointConstants.hyperlink.toString(), '--' || '--');

			assignProperty['displayName'] = endpoint.serviceName;
			assignProperty['value'] = propertyObject;
			assignProperty['hyperlink'] = this.isHyperlink(endpoint.serviceName);
			this.properties.push(<DisplayProperty>assignProperty);
		}

		if (this._hasInit) {
			this._changeRef.detectChanges();
		}
	}

	private getEndpoints() {
		const endpointArray = this._connection.serverInfo.options[EndpointConstants.clusterEndpoints.toString()];

		// TO DO: Once the endpoints data is moved to DMV, update this logic to replace hardcoded values
		// with the data from DMV.
		if (endpointArray && endpointArray.length > 0) {
			// iterate over endpoints and display them
			this.endpoints = [];
			for (let i = 0; i < endpointArray.length; i++) {
				const ep = endpointArray[i];
				const assignProperty = {};
				assignProperty['serviceName'] = ep.serviceName;
				assignProperty['ipAddress'] = ep.ipAddress;
				assignProperty['port'] = ep.port;
				assignProperty['hyperlink'] = ep.ipAddress + ':' + ep.port;
				this.endpoints.push(<Endpoint>assignProperty);
			}

			// add grafana and kibana endpoints from the management proxy endpoint
			const managementProxyEp = endpointArray.find(e => e.serviceName === EndpointConstants.managementproxy.toString());
			if (!endpointArray.find(e => e.serviceName.toLowerCase().indexOf('metrics') > -1)) {
				this.endpoints.push(this.addCustomeEndpoint(managementProxyEp, 'Grafana Dashboard', '/grafana'));
			}
			if (!endpointArray.find(e => e.serviceName.toLowerCase().indexOf('log') > -1)) {
				this.endpoints.push(this.addCustomeEndpoint(managementProxyEp, 'Kibana Dashboard', '/kibana'));
			}

			// add spark and yarn endpoints form the gateway endpoint
			const gatewayEndpoint = endpointArray.find(e => e.serviceName === EndpointConstants.gateway.toString());
			if (!endpointArray.find(e => e.serviceName.toLowerCase().indexOf('spark') > -1)) {
				this.endpoints.push(this.addCustomeEndpoint(gatewayEndpoint, 'Spark History', '/gateway/default/sparkhistory'));
			}
			if (!endpointArray.find(e => e.serviceName.toLowerCase().indexOf('log') > -1)) {
				this.endpoints.push(this.addCustomeEndpoint(gatewayEndpoint, 'Yarn History', '/gateway/default/yarn'));
			}
		}
	}

	private isHyperlink(serviceName: string): boolean {
		if (serviceName.toLowerCase().indexOf('app-proxy') > -1 || serviceName.toLowerCase().indexOf('controller') > -1
			|| serviceName.toLowerCase().indexOf('gateway') > -1 || serviceName.toLowerCase().indexOf('management-proxy') > -1) {
			return false;
		}
		else {
			return true;
		}
	}

	private addCustomeEndpoint(parentEndpoint: IEndpoint, serviceName: string, serivceUrl: string): Endpoint {
		const endpoint = {};
		if (parentEndpoint) {
			endpoint['serviceName'] = serviceName;
			endpoint['ipAddress'] = parentEndpoint.ipAddress;
			endpoint['port'] = parentEndpoint.port;
			endpoint['hyperlink'] = 'https://' + parentEndpoint.ipAddress + ':' + parentEndpoint.port + serivceUrl;
		}
		return <Endpoint>endpoint;
	}

	private parseProperties(propertyArray: Array<Property>) {

		const provider = this._config.provider;
		// if config exists use that, otherwise use default
		/* if (this._config.widget['properties-widget'] && this._config.widget['properties-widget'].properties) {
			const config = <PropertiesConfig>this._config.widget['properties-widget'];
			propertyArray = config.properties;
		} else  */
		if (!propertyArray || propertyArray.length === 0) {
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
			assignProperty['hyperlink'] = false;
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
