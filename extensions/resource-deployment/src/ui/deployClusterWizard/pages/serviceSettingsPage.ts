/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { initializeWizardPage, Validator, InputComponents } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import { MasterSQLServerScale_VariableName, ComputePoolScale_VariableName, DataPoolScale_VariableName, StoragePoolScale_VariableName, SparkPoolScale_VariableName } from '../constants';
const localize = nls.loadMessageBundle();

export class ServiceSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};
	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.ServiceSettingsPageTitle', "Service settings"), '', wizard);
	}
	public initialize(): void {
		const validators: Validator[] = [];
		const poolScaleSection: SectionInfo = {
			title: localize('deployCluster.scaleConfigurationSection', "Scale"),
			labelWidth: '150px',
			inputWidth: '200px',
			rows: [
				{
					fields: [
						{
							type: FieldType.Number,
							label: localize('deployCluster.MasterSqlScale', "Master SQL Server"),
							min: 1,
							max: 9,
							required: true,
							variableName: MasterSQLServerScale_VariableName,
						}, {
							type: FieldType.Number,
							label: localize('deployCluster.ComputePoolScale', "Compute"),
							min: 1,
							max: 100,
							required: true,
							variableName: ComputePoolScale_VariableName,
						}
					]
				}, {
					fields: [
						{
							type: FieldType.Number,
							label: localize('deployCluster.DataPoolScale', "Data"),
							min: 1,
							max: 100,
							required: true,
							variableName: DataPoolScale_VariableName,
						}, {
							type: FieldType.Number,
							label: localize('deployCluster.StoragePoolScale', "Storage"),
							min: 1,
							max: 100,
							required: true,
							variableName: StoragePoolScale_VariableName,
						}
					]
				}, {
					fields: [
						{
							type: FieldType.Number,
							label: localize('deployCluster.SparkPoolSize', "Spark"),
							min: 1,
							max: 100,
							required: true,
							variableName: SparkPoolScale_VariableName
						}
					]
				}
			]
		};
		initializeWizardPage(this.pageObject, this.wizard.wizardObject, [poolScaleSection], validators, this.inputComponents, this.wizard.toDispose);
	}
}
