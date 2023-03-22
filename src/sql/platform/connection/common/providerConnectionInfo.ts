/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { isString } from 'vs/base/common/types';

import * as azdata from 'azdata';
import * as Constants from 'sql/platform/connection/common/constants';
import { ICapabilitiesService, ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionOptionSpecialType } from 'sql/platform/connection/common/interfaces';
import { localize } from 'vs/nls';

type SettableProperty = 'serverName' | 'authenticationType' | 'databaseName' | 'password' | 'connectionName' | 'userName';

export class ProviderConnectionInfo extends Disposable implements azdata.ConnectionInfo {

	options: { [name: string]: any } = {};

	private _providerName?: string;
	public static readonly ProviderPropertyName = 'providerName';

	public constructor(
		protected capabilitiesService: ICapabilitiesService,
		model: string | azdata.IConnectionProfile | azdata.connection.ConnectionProfile | undefined
	) {
		super();
		// we can't really do a whole lot if we don't have a provider
		if (model) {
			this.providerName = isString(model) ? model : 'providerName' in model ? model.providerName : model.providerId;

			if (!isString(model)) {
				if (model.options && this.hasServerCapabilities()) {
					this.serverCapabilities.connectionOptions.forEach(option => {
						let value = model.options[option.name];
						this.options[option.name] = value;
					});
				}

				this.updateSpecialValueType('serverName', model);
				this.updateSpecialValueType('authenticationType', model);
				this.updateSpecialValueType('databaseName', model);
				this.updateSpecialValueType('password', model);
				this.updateSpecialValueType('userName', model);
				this.updateSpecialValueType('connectionName', model);
			}
		}
	}


	/**
	 * Updates one of the special value types (serverName, authenticationType, etc.) if this doesn't already
	 * have a value in the options map.
	 *
	 * This handles the case where someone hasn't passed in a valid property bag, but doesn't cause errors when
	 */
	private updateSpecialValueType(typeName: SettableProperty, model: azdata.IConnectionProfile | azdata.connection.ConnectionProfile): void {
		if (!this[typeName]) {
			this[typeName] = model[typeName]!;
		}
	}

	public get providerName(): string {
		return this._providerName!; // this needs to be rewritten at some point
	}

	public set providerName(name: string) {
		this._providerName = name;
	}

	public override dispose(): void {
		// Notes:
		// 1. It is not recommended to add disposables to this class considering the way we create and use the connection objects,
		//    there are places that the connection objects are not being disposed properly.
		// 2. Remember to dispose the listeners added to this class.
		super.dispose();
	}

	public clone(): ProviderConnectionInfo {
		let instance = new ProviderConnectionInfo(this.capabilitiesService, this.providerName);
		instance.options = Object.assign({}, this.options);
		return instance;
	}

	public get serverCapabilities(): ConnectionProviderProperties | undefined {
		return this.capabilitiesService?.getCapabilities(this.providerName)?.connection;
	}

	public get connectionName(): string {
		return this.getSpecialTypeOptionValue(ConnectionOptionSpecialType.connectionName)!;
	}

	public get serverName(): string {
		return this.getSpecialTypeOptionValue(ConnectionOptionSpecialType.serverName)!;
	}

	public get databaseName(): string {
		return this.getSpecialTypeOptionValue(ConnectionOptionSpecialType.databaseName)!;
	}

	public get userName(): string {
		return this.getSpecialTypeOptionValue(ConnectionOptionSpecialType.userName)!;
	}

	public get password(): string {
		return this.getSpecialTypeOptionValue(ConnectionOptionSpecialType.password)!;
	}

	public get authenticationType(): string {
		return this.getSpecialTypeOptionValue(ConnectionOptionSpecialType.authType)!;
	}

	public set connectionName(value: string) {
		this.setSpecialTypeOptionName(ConnectionOptionSpecialType.connectionName, value);
	}

	public set serverName(value: string) {
		this.setSpecialTypeOptionName(ConnectionOptionSpecialType.serverName, value);
	}

	public set databaseName(value: string) {
		this.setSpecialTypeOptionName(ConnectionOptionSpecialType.databaseName, value);
	}

	public set userName(value: string) {
		this.setSpecialTypeOptionName(ConnectionOptionSpecialType.userName, value);
	}

	public set password(value: string) {
		this.setSpecialTypeOptionName(ConnectionOptionSpecialType.password, value);
	}

	public set authenticationType(value: string) {
		this.setSpecialTypeOptionName(ConnectionOptionSpecialType.authType, value);
	}

	public getOptionValue(name: string): any {
		return this.options[name];
	}

	public setOptionValue(name: string, value: any): void {
		//TODO: validate
		this.options[name] = value;
	}

	private getServerInfo() {
		let title = '';
		if (this.hasServerCapabilities()) {
			title = this.serverName;
			// Only show database name if the provider supports it.
			if (this.serverCapabilities.connectionOptions?.find(option => option.specialValueType === ConnectionOptionSpecialType.databaseName)) {
				title += `, ${this.databaseName || '<default>'}`;
			}
			title += ` (${this.userName || this.authenticationType})`;
		}
		return title;
	}

	/**
	 * Returns the title of the connection
	 */
	public get title(): string {
		let label = '';

		if (this.hasServerCapabilities()) {
			if (this.connectionName) {
				label = this.connectionName;
			} else {
				label = this.getServerInfo();
			}
		}
		// The provider capabilities are registered at the same time at load time, we can assume all providers are registered as long as the collection is not empty.
		else if (Object.keys(this.capabilitiesService.providers).length > 0) {
			return localize('connection.unsupported', "Unsupported connection");
		} else {
			return localize('loading', "Loading...");
		}
		return label;
	}

	public hasServerCapabilities(): boolean {
		return (this.serverCapabilities !== undefined);
	}

	public get serverInfo(): string {
		let value = this.getServerInfo();
		if (this.serverCapabilities?.useFullOptions) {
			value += this.getNonDefaultOptionsString();
		}
		return value;
	}

	public isPasswordRequired(): boolean {
		// if there is no provider capabilities metadata assume a password is not required
		if (!this.hasServerCapabilities()) {
			return false;
		}

		let optionMetadata = this.serverCapabilities.connectionOptions.find(
			option => option.specialValueType === ConnectionOptionSpecialType.password)!; // i guess we are going to assume there is a password field
		let isPasswordRequired = optionMetadata.isRequired;
		if (this.providerName === Constants.mssqlProviderName) {
			isPasswordRequired = this.authenticationType === Constants.AuthenticationType.SqlLogin && optionMetadata.isRequired;
		}
		return isPasswordRequired;
	}

	private getSpecialTypeOptionValue(type: string): string | undefined {
		let name = this.getSpecialTypeOptionName(type);
		if (name) {
			return this.options[name];
		}
		return undefined;
	}

	/**
	 * Returns a key derived the connections options (providerName, authenticationType, serverName, databaseName, userName, groupid)
	 * and all the other properties if useFullOptions is enabled for the provider.
	 * This key uniquely identifies a connection in a group
	 * Example: "providerName:MSSQL|authenticationType:|databaseName:database|serverName:server3|userName:user|group:testid"
	 * @param getOriginalOptions will return the original URI format regardless if useFullOptions was set or not. (used for retrieving passwords)
	 */
	public getOptionsKey(getOriginalOptions?: boolean): string {
		let useFullOptions = false;
		let idNames = [];
		if (this.hasServerCapabilities()) {
			useFullOptions = this.serverCapabilities.useFullOptions
			idNames = this.serverCapabilities.connectionOptions.map(o => {
				// All options enabled, use every property besides password.
				let newProperty = useFullOptions && o.specialValueType !== ConnectionOptionSpecialType.password && !getOriginalOptions
				// Fallback to original base IsIdentity properties otherwise.
				let originalProperty = (o.specialValueType || o.isIdentity) && o.specialValueType !== ConnectionOptionSpecialType.password
					&& o.specialValueType !== ConnectionOptionSpecialType.connectionName;
				if (newProperty || originalProperty) {
					return o.name;
				} else {
					return undefined;
				}
			});
		} else {
			// This should never happen but just incase the serverCapabilities was not ready at this time
			idNames = ['authenticationType', 'database', 'server', 'user'];
		}

		idNames = idNames.filter(x => x !== undefined);

		//Sort to make sure using names in the same order every time otherwise the ids would be different
		idNames.sort();

		let idValues: string[] = [];
		for (let index = 0; index < idNames.length; index++) {
			let value = this.options[idNames[index]!];
			// If we're using the new URI format, we do not include any values that are empty or are default.
			if (useFullOptions && !getOriginalOptions) {
				let finalValue = undefined;
				let options = this.serverCapabilities.connectionOptions.filter(value => value.name === idNames[index]!);
				if (options.length > 0 && value) {
					finalValue = value !== options[0].defaultValue ? value : undefined;
				}
				value = finalValue;
			}
			else {
				value = value ? value : '';
			}
			if (value) {
				idValues.push(`${idNames[index]}${ProviderConnectionInfo.nameValueSeparator}${value}`);
			}
		}

		return ProviderConnectionInfo.ProviderPropertyName + ProviderConnectionInfo.nameValueSeparator +
			this.providerName + ProviderConnectionInfo.idSeparator + idValues.join(ProviderConnectionInfo.idSeparator);
	}

	public static getProviderFromOptionsKey(optionsKey: string) {
		let providerId: string = '';
		if (optionsKey) {
			let ids: string[] = optionsKey.split(ProviderConnectionInfo.idSeparator);
			ids.forEach(id => {
				let idParts = id.split(ProviderConnectionInfo.nameValueSeparator);
				if (idParts.length >= 2 && idParts[0] === ProviderConnectionInfo.ProviderPropertyName) {
					providerId = idParts[1];
				}
			});
		}
		return providerId;
	}

	public getSpecialTypeOptionName(type: string): string | undefined {
		if (this.hasServerCapabilities()) {
			let optionMetadata = this.serverCapabilities.connectionOptions.find(o => o.specialValueType === type);
			return !!optionMetadata ? optionMetadata.name : undefined;
		} else {
			return type.toString();
		}
	}

	public setSpecialTypeOptionName(type: string, value: string): void {
		let name = this.getSpecialTypeOptionName(type);
		if (!!name) {
			this.options[name] = value;
		}
	}

	public get authenticationTypeDisplayName(): string {
		let optionMetadata = this.hasServerCapabilities() ? this.serverCapabilities.connectionOptions.find(o => o.specialValueType === ConnectionOptionSpecialType.authType) : undefined;
		let authType = this.authenticationType;
		let displayName: string = authType;

		if (optionMetadata && optionMetadata.categoryValues) {
			optionMetadata.categoryValues.forEach(element => {
				if (element.name === authType) {
					displayName = element.displayName;
				}
			});
		}
		return displayName;
	}

	public getProviderOptions(): azdata.ConnectionOption[] | undefined {
		return this.serverCapabilities?.connectionOptions;
	}

	public static get idSeparator(): string {
		return '|';
	}

	public static get nameValueSeparator(): string {
		return ':';
	}


	/**
	 * Get all non specialValueType (or if distinct connections share same connection name, everything but connectionName and password).
	 * Also allows for getting the non default options for this profile. (this function is used for changing the title).
	 * @param needSpecial include all the special options key besides connection name or password in case we have multiple
	 * distinct connections sharing the same connection name.
	 * @param getNonDefault get only the non default options (for individual connections) to be used for identfying different properties
	 * among connections sharing the same title.
	 */
	public getConnectionOptionsList(needSpecial: boolean, getNonDefault: boolean): azdata.ConnectionOption[] {
		let connectionOptions: azdata.ConnectionOption[] = [];

		if (this.hasServerCapabilities()) {
			this.serverCapabilities.connectionOptions.forEach(element => {
				if (((!needSpecial && element.specialValueType !== ConnectionOptionSpecialType.serverName &&
					element.specialValueType !== ConnectionOptionSpecialType.databaseName &&
					element.specialValueType !== ConnectionOptionSpecialType.authType &&
					element.specialValueType !== ConnectionOptionSpecialType.userName) || needSpecial) &&
					element.specialValueType !== ConnectionOptionSpecialType.connectionName &&
					element.specialValueType !== ConnectionOptionSpecialType.password) {
					if (getNonDefault) {
						let value = this.getOptionValue(element.name);
						if (value && value !== element.defaultValue) {
							connectionOptions.push(element);
						}
					}
					else {
						connectionOptions.push(element);
					}
				}
			});
		}
		//Need to sort for consistency.
		connectionOptions.sort();

		return connectionOptions;
	}

	/**
	 * Append all non default options to tooltip string if useFullOptions is enabled.
	 */
	private getNonDefaultOptionsString(): string {
		let parts: string = "";

		let nonDefaultOptions = this.getConnectionOptionsList(false, true);
		nonDefaultOptions.forEach(element => {
			let value = this.getOptionValue(element.name);
			if (parts.length === 0) {
				parts = " (";
			}
			let addValue = element.name + ProviderConnectionInfo.nameValueSeparator + `${value}`;
			parts += parts === " (" ? addValue : (ProviderConnectionInfo.idSeparator + addValue);
		});
		if (parts.length > 0) {
			parts += ")";
		}

		return parts;
	}
}
