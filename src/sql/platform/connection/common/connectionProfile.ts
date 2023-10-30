/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import * as azdata from 'azdata';
import { ProviderConnectionInfo } from 'sql/platform/connection/common/providerConnectionInfo';
import * as interfaces from 'sql/platform/connection/common/interfaces';
import { generateUuid } from 'vs/base/common/uuid';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { isString, isUndefinedOrNull } from 'vs/base/common/types';
import { deepClone } from 'vs/base/common/objects';
import * as Constants from 'sql/platform/connection/common/constants';
import { URI } from 'vs/base/common/uri';
import { adjustForMssqlAppName } from 'sql/platform/connection/common/utils';

export interface IconPath {
	light: URI;
	dark: URI;
}


// Concrete implementation of the IConnectionProfile interface

/**
 * A concrete implementation of an IConnectionProfile with support for profile creation and validation
 */
export class ConnectionProfile extends ProviderConnectionInfo implements interfaces.IConnectionProfile {

	public parent?: ConnectionProfileGroup;
	private _id: string;
	public savePassword: boolean;
	private _groupName?: string;
	public groupId?: string;
	public saveProfile: boolean;

	public iconPath?: IconPath;

	public isDisconnecting: boolean = false;

	// title from ProviderConnectionInfo cannot be changed, in order to show different dynamic options appended, we must override the title with our own.
	private _title?: string;

	public constructor(
		capabilitiesService: ICapabilitiesService,
		model: string | azdata.IConnectionProfile | azdata.connection.ConnectionProfile | undefined) {
		super(capabilitiesService, model);
		if (model && !isString(model)) {
			this.groupId = model.groupId;
			this.groupFullName = model.groupFullName;
			this.savePassword = model.savePassword;
			this.saveProfile = model.saveProfile;
			this.azureTenantId = model.azureTenantId;

			// Special case setting properties to support both IConnectionProfile and azdata.connection.ConnectionProfile
			// It's not great that we have multiple definitions in azdata, but we can't break that right now so just
			// support both at least for the time being
			const isIConnectionProfile = 'id' in model;
			this._id = isIConnectionProfile ? model.id : model.connectionId;
			// TODO: @chgagnon - Should we add these properties to azdata.connection.ConnectionProfile?
			this.azureAccount = isIConnectionProfile ? model.azureAccount : '';
			this.azureResourceId = isIConnectionProfile ? model.azureResourceId : '';
			this.azurePortalEndpoint = isIConnectionProfile ? model.azurePortalEndpoint : '';
			if (this.capabilitiesService && this.providerName) {
				let capabilities = this.capabilitiesService.getCapabilities(this.providerName);
				if (capabilities && capabilities.connection && capabilities.connection.connectionOptions) {
					const options = capabilities.connection.connectionOptions;
					// MSSQL Provider doesn't treat appName as special type anymore.
					let appNameOption = options.find(option => option.specialValueType === interfaces.ConnectionOptionSpecialType.appName);
					if (appNameOption) {
						let appNameKey = appNameOption.name;
						this.options[appNameKey] = Constants.applicationName;
					} else if (this.providerName === Constants.mssqlProviderName || this.providerName === Constants.mssqlCmsProviderName) {
						// Update AppName here for MSSQL and MSSQL-CMS provider to be able to match connection URI with STS.
						appNameOption = options.find(option => option.name === Constants.mssqlApplicationNameOption);
						if (appNameOption) {
							this.options[Constants.mssqlApplicationNameOption] = adjustForMssqlAppName(model.options[Constants.mssqlApplicationNameOption]);
						}
					}
					// Set values for advanced options received in model.
					Object.keys(model.options).forEach(a => {
						let option = options.find(opt => opt.name === a);
						if (option !== undefined && option.defaultValue?.toString().toLocaleLowerCase() !== model.options[a]?.toString().toLocaleLowerCase()) {
							this.options[option.name] = model.options[a];
						}
					});
				}
				if (model.options.registeredServerDescription) {
					this.registeredServerDescription = model.options.registeredServerDescription;
				}
				const expiry = model.options.expiresOn;
				if (typeof expiry === 'number' && !Number.isNaN(expiry)) {
					this.options.expiresOn = model.options.expiresOn;
				}
			}
			if (model.options?.originalDatabase) {
				this.originalDatabase = model.options.originalDatabase;
			}
		} else {
			//Default for a new connection
			this.savePassword = false;
			this.saveProfile = true;
			this._groupName = ConnectionProfile.RootGroupName;
			this._id = generateUuid();
		}

		this.options['groupId'] = this.groupId;
		this.options['databaseDisplayName'] = this.databaseName;
	}

	public static matchesProfile(a: interfaces.IConnectionProfile | undefined, b: interfaces.IConnectionProfile | undefined): boolean {
		return a && b && a.getOptionsKey() === b.getOptionsKey();
	}

	public matches(other: interfaces.IConnectionProfile): boolean {
		return ConnectionProfile.matchesProfile(this, other);

	}

	public generateNewId() {
		this._id = generateUuid();
	}

	public getParent(): ConnectionProfileGroup | undefined {
		return this.parent;
	}

	public get id(): string {
		if (!this._id) {
			this._id = generateUuid();
		}
		return this._id;
	}

	public set id(value: string) {
		this._id = value;
	}

	public get azureTenantId(): string | undefined {
		return this.options['azureTenantId'];
	}

	public set azureTenantId(value: string | undefined) {
		this.options['azureTenantId'] = value;
	}

	public get azureAccount(): string | undefined {
		return this.options['azureAccount'];
	}

	public set azureAccount(value: string | undefined) {
		this.options['azureAccount'] = value;
	}

	public get azurePortalEndpoint() {
		return this.options['azurePortalEndpoint'];
	}

	public set azurePortalEndpoint(value: string | undefined) {
		this.options['azurePortalEndpoint'] = value;
	}

	public get azureResourceId() {
		return this.options['azureResourceId'];
	}

	public set azureResourceId(value: string | undefined) {
		this.options['azureResourceId'] = value;
	}

	/**
	 * Database of server specified before connection.
	 * Some providers will modify the database field of the connection once a connection is made
	 * so that it reflects the actual database that was connected to.
	 */
	public get originalDatabase() {
		return this.options['originalDatabase'];
	}

	public set originalDatabase(value: string | undefined) {
		this.options['originalDatabase'] = value;
	}

	public get registeredServerDescription(): string {
		return this.options['registeredServerDescription'];
	}

	public set registeredServerDescription(value: string) {
		this.options['registeredServerDescription'] = value;
	}

	public get groupFullName(): string | undefined {
		return this._groupName;
	}

	public set groupFullName(value: string | undefined) {
		this._groupName = value;
	}

	public get isAddedToRootGroup(): boolean {
		return (this._groupName === ConnectionProfile.RootGroupName);
	}

	public override get title(): string {
		if (this._title) {
			return this._title;
		}
		return this.getOriginalTitle();
	}

	public getOriginalTitle(): string {
		return super.title;
	}

	public override set title(value: string) {
		this._title = value;
	}

	public override clone(): ConnectionProfile {
		let instance = new ConnectionProfile(this.capabilitiesService, this);
		return instance;
	}

	public cloneWithNewId(): ConnectionProfile {
		let instance = this.clone();
		instance.generateNewId();
		return instance;
	}

	public cloneWithDatabase(databaseName: string): ConnectionProfile {
		let instance = this.cloneWithNewId();
		instance.databaseName = databaseName;
		instance.originalDatabase = databaseName;
		return instance;
	}

	public static readonly RootGroupName: string = '/';

	public withoutPassword(): ConnectionProfile {
		let clone = this.clone();
		clone.password = '';
		return clone;
	}

	/**
	 * Returns a key derived the connections options (providerName, authenticationType, serverName, databaseName, userName, groupid)
	 * and all the other properties (except empty ones) if useFullOptions is enabled for the provider.
	 * This key uniquely identifies a connection in a group
	 * Example (original format): "providerName:MSSQL|authenticationType:|databaseName:database|serverName:server3|userName:user|group:testid"
	 * Example (new format): "providerName:MSSQL|databaseName:database|serverName:server3|userName:user|groupId:testid"
	 * @param getOriginalOptions will return the original URI format regardless if useFullOptions was set or not. (used for retrieving passwords)
	 */
	public override getOptionsKey(getOriginalOptions?: boolean): string {
		let id = super.getOptionsKey(getOriginalOptions);
		let databaseDisplayName: string = this.options['databaseDisplayName'];
		if (databaseDisplayName) {
			id += ProviderConnectionInfo.idSeparator + 'databaseDisplayName' + ProviderConnectionInfo.nameValueSeparator + databaseDisplayName;
		}

		let groupProp = 'group'
		if (!getOriginalOptions && this.serverCapabilities && this.serverCapabilities.useFullOptions) {
			groupProp = 'groupId'
		}

		return id + ProviderConnectionInfo.idSeparator + groupProp + ProviderConnectionInfo.nameValueSeparator + this.groupId;
	}

	/**
	 * Returns the unique id for the connection that doesn't include the group name.
	 * Used primarily for retrieving shared passwords among different connections in default state.
	 * @param getOriginalOptions will return the original URI format regardless if useFullOptions was set or not. (used for retrieving passwords)
	 */
	public getConnectionInfoId(getOriginalOptions = true): string {
		let id = super.getOptionsKey(getOriginalOptions);
		let databaseDisplayName: string = this.options['databaseDisplayName'];
		if (databaseDisplayName && !getOriginalOptions && this.serverCapabilities?.useFullOptions) {
			id += ProviderConnectionInfo.idSeparator + 'databaseDisplayName' + ProviderConnectionInfo.nameValueSeparator + databaseDisplayName;
		}
		return id;
	}

	public toIConnectionProfile(): interfaces.IConnectionProfile {
		let result: interfaces.IConnectionProfile = {
			connectionName: this.connectionName,
			serverName: this.serverName,
			databaseName: this.databaseName,
			authenticationType: this.authenticationType,
			serverCapabilities: this.serverCapabilities,
			getOptionsKey: this.getOptionsKey,
			getOptionKeyIdNames: this.getOptionKeyIdNames,
			matches: this.matches,
			groupId: this.groupId,
			groupFullName: this.groupFullName,
			password: this.password,
			providerName: this.providerName,
			savePassword: this.savePassword,
			userName: this.userName,
			options: this.options,
			saveProfile: this.saveProfile,
			id: this.id,
			azureTenantId: this.azureTenantId,
			azureAccount: this.azureAccount,
			azurePortalEndpoint: this.azurePortalEndpoint,
			azureResourceId: this.azureResourceId
		};

		return result;
	}

	public toConnectionInfo(): azdata.ConnectionInfo {
		return {
			options: this.options
		};
	}

	/**
	 * Returns whether this profile is connected to the default database (it doesn't specify a database to connect to)
	 */
	public static isConnectionToDefaultDb(profile: azdata.IConnectionProfile): boolean {
		return !profile.databaseName || profile.databaseName.trim() === '';
	}

	public static fromIConnectionProfile(capabilitiesService: ICapabilitiesService, profile: azdata.IConnectionProfile): ConnectionProfile {
		if (profile instanceof ConnectionProfile) {
			return profile;
		} else {
			return new ConnectionProfile(capabilitiesService, profile);
		}
	}

	public static createFromStoredProfile(profile: interfaces.IConnectionProfileStore, capabilitiesService: ICapabilitiesService): ConnectionProfile {
		let connectionInfo = new ConnectionProfile(capabilitiesService, profile.providerName);
		connectionInfo.options = profile.options;

		// append group ID and original display name to build unique OE session ID
		connectionInfo.options = deepClone(profile.options);
		connectionInfo.options['groupId'] = connectionInfo.groupId;
		connectionInfo.options['databaseDisplayName'] = connectionInfo.databaseName;

		connectionInfo.groupId = profile.groupId;
		connectionInfo.providerName = profile.providerName;
		connectionInfo.saveProfile = true;
		connectionInfo.savePassword = profile.savePassword;
		connectionInfo.id = profile.id || generateUuid();
		return connectionInfo;
	}

	public static convertToProfileStore(
		capabilitiesService: ICapabilitiesService,
		connectionProfile: interfaces.IConnectionProfile): interfaces.IConnectionProfileStore {
		let connectionInfo = ConnectionProfile.fromIConnectionProfile(capabilitiesService, connectionProfile);
		let profile: interfaces.IConnectionProfileStore = {
			options: {},
			groupId: connectionProfile.groupId!,
			providerName: connectionInfo.providerName,
			savePassword: connectionInfo.savePassword,
			id: connectionInfo.id
		};

		Object.keys(connectionInfo.options).forEach(element => {
			// Allow empty strings to ensure "user": "" is populated if empty << Required by SSMS 19.2
			// Do not change this design until SSMS 19 goes out of support.
			if (!isUndefinedOrNull(connectionInfo.options[element])) {
				profile.options[element] = connectionInfo.options[element];
			}
		});

		return profile;
	}
}
