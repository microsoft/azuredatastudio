/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as loc from '../localizedConstants';
import * as mssql from 'mssql';
import * as vscode from 'vscode';
import { isNullOrUndefined } from 'util';

export class SchemaCompareOptionsModel {
	// key is the option display name and values are checkboxValue and optionName
	private optionsValueNameLookup: { [key: string]: mssql.IOptionWithValue } = {};
	public excludedObjectTypes: number[] = [];
	public objectsLookup = {};

	constructor(public deploymentOptions: mssql.DeploymentOptions) {
		this.setOptionsToValueNameLookup();
	}

	/*
	 * Sets deployment option's checkbox values and property name to the optionsValueNameLookup map
	 */
	public setOptionsToValueNameLookup(): void {
		Object.entries(this.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			const optionValue: mssql.IOptionWithValue = {
				optionName: option[0],
				checked: option[1].value
			};
			this.optionsValueNameLookup[option[1].displayName] = optionValue;
		});
	}

	/*
	 * Initialize options data from deployment options for table component
	 * Returns data as [booleanValue, optionName]
	 */
	public getOptionsData(): any[][] {
		let data: any[][] = [];
		Object.entries(this.deploymentOptions.booleanOptionsDictionary).forEach(option => {
			// option[1] holds checkedbox value and displayName
			data.push([option[1].value, option[1].displayName]);
		});

		return data.sort((a, b) => a[1].localeCompare(b[1]));
	}

	/*
	* Sets the selected option checkbox value to the deployment options
	*/
	public setDeploymentOptions(): void {
		Object.entries(this.optionsValueNameLookup).forEach(option => {
			// option[1] holds checkedbox value and optionName
			this.deploymentOptions.booleanOptionsDictionary[option[1].optionName].value = option[1].checked;
		});
	}

	/*
	* Sets the checkbox value to the optionsValueNameLookup map
	*/
	public setOptionValue(displayName: string, checked: boolean): void {
		this.optionsValueNameLookup[displayName].checked = checked;
	}

	/*
	* Gets the description of the selected option by getting the option name from the optionsValueNameLookup
	*/
	public getOptionDescription(displayName: string): string {
		const optionName = this.optionsValueNameLookup[displayName];
		if (optionName === undefined) {
			void vscode.window.showWarningMessage(loc.OptionNotFoundWarningMessage(displayName));
		}
		return optionName !== undefined ? this.deploymentOptions.booleanOptionsDictionary[optionName.optionName].description : '';
	}

	//#region Schema Compare Objects
	public objectTypeLabels: string[] = [
		loc.Aggregates,
		loc.ApplicationRoles,
		loc.Assemblies,
		loc.AssemblyFiles,
		loc.AsymmetricKeys,
		loc.BrokerPriorities,
		loc.Certificates,
		loc.ColumnEncryptionKeys,
		loc.ColumnMasterKeys,
		loc.Contracts,
		loc.DatabaseOptions,
		loc.DatabaseRoles,
		loc.DatabaseTriggers,
		loc.Defaults,
		loc.ExtendedProperties,
		loc.ExternalDataSources,
		loc.ExternalFileFormats,
		loc.ExternalStreams,
		loc.ExternalStreamingJobs,
		loc.ExternalTables,
		loc.Filegroups,
		loc.Files,
		loc.FileTables,
		loc.FullTextCatalogs,
		loc.FullTextStoplists,
		loc.MessageTypes,
		loc.PartitionFunctions,
		loc.PartitionSchemes,
		loc.Permissions,
		loc.Queues,
		loc.RemoteServiceBindings,
		loc.RoleMembership,
		loc.Rules,
		loc.ScalarValuedFunctions,
		loc.SearchPropertyLists,
		loc.SecurityPolicies,
		loc.Sequences,
		loc.Services,
		loc.Signatures,
		loc.StoredProcedures,
		loc.SymmetricKeys,
		loc.Synonyms,
		loc.Tables,
		loc.TableValuedFunctions,
		loc.UserDefinedDataTypes,
		loc.UserDefinedTableTypes,
		loc.ClrUserDefinedTypes,
		loc.Users,
		loc.Views,
		loc.XmlSchemaCollections,
		loc.Audits,
		loc.Credentials,
		loc.CryptographicProviders,
		loc.DatabaseAuditSpecifications,
		loc.DatabaseEncryptionKeys,
		loc.DatabaseScopedCredentials,
		loc.Endpoints,
		loc.ErrorMessages,
		loc.EventNotifications,
		loc.EventSessions,
		loc.LinkedServerLogins,
		loc.LinkedServers,
		loc.Logins,
		loc.MasterKeys,
		loc.Routes,
		loc.ServerAuditSpecifications,
		loc.ServerRoleMembership,
		loc.ServerRoles,
		loc.ServerTriggers
	].sort();

	public getObjectsData(): string[][] {
		let data = [];
		this.objectsLookup = {};
		this.objectTypeLabels.forEach(l => {
			let checked: boolean = this.getSchemaCompareIncludedObjectsUtil(l);
			data.push([checked, l]);
			this.objectsLookup[l] = checked;
		});
		return data;
	}
	//#endregion


	public setObjectTypeOptions() {
		for (let option in this.objectsLookup) {
			this.setSchemaCompareIncludedObjectsUtil(option, this.objectsLookup[option]);
		}
		this.deploymentOptions.excludeObjectTypes.value = this.excludedObjectTypes;
	}

	public getSchemaCompareIncludedObjectsUtil(label): boolean {
		switch (label) {
			case loc.Aggregates:
				return !isNullOrUndefined(this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Aggregates)) ? false : true;
			case loc.ApplicationRoles:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ApplicationRoles)) ? false : true;
			case loc.Assemblies:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Assemblies)) ? false : true;
			case loc.AssemblyFiles:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.AssemblyFiles)) ? false : true;
			case loc.AsymmetricKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.AsymmetricKeys)) ? false : true;
			case loc.BrokerPriorities:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.BrokerPriorities)) ? false : true;
			case loc.Certificates:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Certificates)) ? false : true;
			case loc.ColumnEncryptionKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ColumnEncryptionKeys)) ? false : true;
			case loc.ColumnMasterKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ColumnMasterKeys)) ? false : true;
			case loc.Contracts:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Contracts)) ? false : true;
			case loc.DatabaseOptions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseOptions)) ? false : true;
			case loc.DatabaseRoles:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseRoles)) ? false : true;
			case loc.DatabaseTriggers:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseTriggers)) ? false : true;
			case loc.Defaults:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Defaults)) ? false : true;
			case loc.ExtendedProperties:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExtendedProperties)) ? false : true;
			case loc.ExternalDataSources:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalDataSources)) ? false : true;
			case loc.ExternalFileFormats:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalFileFormats)) ? false : true;
			case loc.ExternalStreams:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalStreams)) ? false : true;
			case loc.ExternalStreamingJobs:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalStreamingJobs)) ? false : true;
			case loc.ExternalTables:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ExternalTables)) ? false : true;
			case loc.Filegroups:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Filegroups)) ? false : true;
			case loc.Files:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Files)) ? false : true;
			case loc.FileTables:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.FileTables)) ? false : true;
			case loc.FullTextCatalogs:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.FullTextCatalogs)) ? false : true;
			case loc.FullTextStoplists:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.FullTextStoplists)) ? false : true;
			case loc.MessageTypes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.MessageTypes)) ? false : true;
			case loc.PartitionFunctions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.PartitionFunctions)) ? false : true;
			case loc.PartitionSchemes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.PartitionSchemes)) ? false : true;
			case loc.Permissions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Permissions)) ? false : true;
			case loc.Queues:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Queues)) ? false : true;
			case loc.RemoteServiceBindings:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.RemoteServiceBindings)) ? false : true;
			case loc.RoleMembership:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.RoleMembership)) ? false : true;
			case loc.Rules:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Rules)) ? false : true;
			case loc.ScalarValuedFunctions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ScalarValuedFunctions)) ? false : true;
			case loc.SearchPropertyLists:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.SearchPropertyLists)) ? false : true;
			case loc.SecurityPolicies:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.SecurityPolicies)) ? false : true;
			case loc.Sequences:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Sequences)) ? false : true;
			case loc.Services:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Services)) ? false : true;
			case loc.Signatures:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Signatures)) ? false : true;
			case loc.StoredProcedures:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.StoredProcedures)) ? false : true;
			case loc.SymmetricKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.SymmetricKeys)) ? false : true;
			case loc.Synonyms:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Synonyms)) ? false : true;
			case loc.Tables:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Tables)) ? false : true;
			case loc.TableValuedFunctions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.TableValuedFunctions)) ? false : true;
			case loc.UserDefinedDataTypes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.UserDefinedDataTypes)) ? false : true;
			case loc.UserDefinedTableTypes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.UserDefinedTableTypes)) ? false : true;
			case loc.ClrUserDefinedTypes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ClrUserDefinedTypes)) ? false : true;
			case loc.Users:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Users)) ? false : true;
			case loc.Views:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Views)) ? false : true;
			case loc.XmlSchemaCollections:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.XmlSchemaCollections)) ? false : true;
			case loc.Audits:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Audits)) ? false : true;
			case loc.Credentials:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Credentials)) ? false : true;
			case loc.CryptographicProviders:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.CryptographicProviders)) ? false : true;
			case loc.DatabaseAuditSpecifications:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseAuditSpecifications)) ? false : true;
			case loc.DatabaseEncryptionKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseEncryptionKeys)) ? false : true;
			case loc.DatabaseScopedCredentials:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.DatabaseScopedCredentials)) ? false : true;
			case loc.Endpoints:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Endpoints)) ? false : true;
			case loc.ErrorMessages:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ErrorMessages)) ? false : true;
			case loc.EventNotifications:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.EventNotifications)) ? false : true;
			case loc.EventSessions:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.EventSessions)) ? false : true;
			case loc.LinkedServerLogins:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.LinkedServerLogins)) ? false : true;
			case loc.LinkedServers:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.LinkedServers)) ? false : true;
			case loc.Logins:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Logins)) ? false : true;
			case loc.MasterKeys:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.MasterKeys)) ? false : true;
			case loc.Routes:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.Routes)) ? false : true;
			case loc.ServerAuditSpecifications:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ServerAuditSpecifications)) ? false : true;
			case loc.ServerRoleMembership:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ServerRoleMembership)) ? false : true;
			case loc.ServerRoles:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ServerRoles)) ? false : true;
			case loc.ServerTriggers:
				return (this.deploymentOptions.excludeObjectTypes.value.find(x => x === mssql.SchemaObjectType.ServerTriggers)) ? false : true;
		}
		return false;
	}

	public setSchemaCompareIncludedObjectsUtil(label: string, included: boolean) {
		switch (label) {
			case loc.Aggregates:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Aggregates);
				}
				return;
			case loc.ApplicationRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ApplicationRoles);
				}
				return;
			case loc.Assemblies:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Assemblies);
				}
				return;
			case loc.AssemblyFiles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.AssemblyFiles);
				}
				return;
			case loc.AsymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.AsymmetricKeys);
				}
				return;
			case loc.BrokerPriorities:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.BrokerPriorities);
				}
				return;
			case loc.Certificates:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Certificates);
				}
				return;
			case loc.ColumnEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ColumnEncryptionKeys);
				}
				return;
			case loc.ColumnMasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ColumnMasterKeys);
				}
				return;
			case loc.Contracts:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Contracts);
				}
				return;
			case loc.DatabaseOptions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseOptions);
				}
				return;
			case loc.DatabaseRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseRoles);
				}
				return;
			case loc.DatabaseTriggers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseTriggers);
				}
				return;
			case loc.Defaults:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Defaults);
				}
				return;
			case loc.ExtendedProperties:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExtendedProperties);
				}
				return;
			case loc.ExternalDataSources:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalDataSources);
				}
				return;
			case loc.ExternalFileFormats:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalFileFormats);
				}
				return;
			case loc.ExternalStreams:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalStreams);
				}
				return;
			case loc.ExternalStreamingJobs:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalStreamingJobs);
				}
				return;
			case loc.ExternalTables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ExternalTables);
				}
				return;
			case loc.Filegroups:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Filegroups);
				}
				return;
			case loc.Files:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Files);
				}
				return;
			case loc.FileTables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FileTables);
				}
				return;
			case loc.FullTextCatalogs:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FullTextCatalogs);
				}
				return;
			case loc.FullTextStoplists:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.FullTextStoplists);
				}
				return;
			case loc.MessageTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.MessageTypes);
				}
				return;
			case loc.PartitionFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.PartitionFunctions);
				}
				return;
			case loc.PartitionSchemes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.PartitionSchemes);
				}
				return;
			case loc.Permissions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Permissions);
				}
				return;
			case loc.Queues:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Queues);
				}
				return;
			case loc.RemoteServiceBindings:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.RemoteServiceBindings);
				}
				return;
			case loc.RoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.RoleMembership);
				}
				return;
			case loc.Rules:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Rules);
				}
				return;
			case loc.ScalarValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ScalarValuedFunctions);
				}
				return;
			case loc.SearchPropertyLists:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SearchPropertyLists);
				}
				return;
			case loc.SecurityPolicies:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SecurityPolicies);
				}
				return;
			case loc.Sequences:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Sequences);
				}
				return;
			case loc.Services:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Services);
				}
				return;
			case loc.Signatures:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Signatures);
				}
				return;
			case loc.StoredProcedures:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.StoredProcedures);
				}
				return;
			case loc.SymmetricKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.SymmetricKeys);
				}
				return;
			case loc.Synonyms:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Synonyms);
				}
				return;
			case loc.Tables:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Tables);
				}
				return;
			case loc.TableValuedFunctions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.TableValuedFunctions);
				}
				return;
			case loc.UserDefinedDataTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.UserDefinedDataTypes);
				}
				return;
			case loc.UserDefinedTableTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.UserDefinedTableTypes);
				}
				return;
			case loc.ClrUserDefinedTypes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ClrUserDefinedTypes);
				}
				return;
			case loc.Users:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Users);
				}
				return;
			case loc.Views:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Views);
				}
				return;
			case loc.XmlSchemaCollections:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.XmlSchemaCollections);
				}
				return;
			case loc.Audits:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Audits);
				}
				return;
			case loc.Credentials:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Credentials);
				}
				return;
			case loc.CryptographicProviders:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.CryptographicProviders);
				}
				return;
			case loc.DatabaseAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseAuditSpecifications);
				}
				return;
			case loc.DatabaseEncryptionKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseEncryptionKeys);
				}
				return;
			case loc.DatabaseScopedCredentials:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.DatabaseScopedCredentials);
				}
				return;
			case loc.Endpoints:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Endpoints);
				}
				return;
			case loc.ErrorMessages:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ErrorMessages);
				}
				return;
			case loc.EventNotifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.EventNotifications);
				}
				return;
			case loc.EventSessions:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.EventSessions);
				}
				return;
			case loc.LinkedServerLogins:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.LinkedServerLogins);
				}
				return;
			case loc.LinkedServers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.LinkedServers);
				}
				return;
			case loc.Logins:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Logins);
				}
				return;
			case loc.MasterKeys:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.MasterKeys);
				}
				return;
			case loc.Routes:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.Routes);
				}
				return;
			case loc.ServerAuditSpecifications:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerAuditSpecifications);
				}
				return;
			case loc.ServerRoleMembership:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerRoleMembership);
				}
				return;
			case loc.ServerRoles:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerRoles);
				}
				return;
			case loc.ServerTriggers:
				if (!included) {
					this.excludedObjectTypes.push(mssql.SchemaObjectType.ServerTriggers);
				}
				return;
		}
	}
}
