/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Model } from '../model';
import * as VariableNames from './constants';
import { BigDataClusterDeploymentProfile } from '../../services/bigDataClusterDeploymentProfile';

export class DeployClusterWizardModel extends Model {
	public adAuthSupported: boolean = false;

	public get hadrEnabled(): boolean {
		return this.getBooleanValue(VariableNames.EnableHADR_VariableName);
	}

	public set hadrEnabled(value: boolean) {
		this.setPropertyValue(VariableNames.EnableHADR_VariableName, value);
	}

	public get authenticationMode(): string | undefined {
		return this.getStringValue(VariableNames.AuthenticationMode_VariableName);
	}

	public set authenticationMode(value: string | undefined) {
		this.setPropertyValue(VariableNames.AuthenticationMode_VariableName, value);
	}

	public getStorageSettingValue(propertyName: string, defaultValuePropertyName: string): string | undefined {
		const value = this.getStringValue(propertyName);
		return (value === undefined || value === '') ? this.getStringValue(defaultValuePropertyName) : value;
	}

	private setStorageSettingValue(propertyName: string, defaultValuePropertyName: string): void {
		const value = this.getStringValue(propertyName);
		if (value === undefined || value === '') {
			this.setPropertyValue(propertyName, this.getStringValue(defaultValuePropertyName));
		}
	}

	private setStorageSettingValues(): void {
		this.setStorageSettingValue(VariableNames.DataPoolDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.DataPoolDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName);
		this.setStorageSettingValue(VariableNames.DataPoolLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.DataPoolLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName);

		this.setStorageSettingValue(VariableNames.HDFSDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.HDFSDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName);
		this.setStorageSettingValue(VariableNames.HDFSLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.HDFSLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName);

		this.setStorageSettingValue(VariableNames.SQLServerDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.SQLServerDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName);
		this.setStorageSettingValue(VariableNames.SQLServerLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName);
		this.setStorageSettingValue(VariableNames.SQLServerLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName);
	}

	public setEnvironmentVariables(): void {
		this.setStorageSettingValues();
		super.setEnvironmentVariables();
	}

	public selectedProfile: BigDataClusterDeploymentProfile | undefined;
}

export enum AuthenticationMode {
	ActiveDirectory = 'ad',
	Basic = 'basic'
}
