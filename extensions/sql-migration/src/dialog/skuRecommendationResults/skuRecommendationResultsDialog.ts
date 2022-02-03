/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel, MigrationTargetType } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';

import * as mssql from '../../../../mssql';

export class SkuRecommendationResultsDialog {

	private static readonly OpenButtonText: string = 'Close';
	private static readonly CreateTargetButtonText: string = 'Create target in portal';

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;

	// private _model: MigrationStateModel;
	// private _dialogObject!: azdata.window.Dialog;
	// private _view!: azdata.ModelView;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;
	private _disposables: vscode.Disposable[] = [];
	public title?: string;
	public targetName?: string;

	public targetRecommendations?: mssql.SkuRecommendationResultItem[];
	public instanceRequirements?: mssql.SqlInstanceRequirements;

	constructor(public model: MigrationStateModel, public _targetType: MigrationTargetType) {
		switch (this._targetType) {
			case MigrationTargetType.SQLMI:
				this.targetName = constants.AZURE_SQL_DATABASE_MANAGED_INSTANCE;
				break;

			case MigrationTargetType.SQLVM:
				this.targetName = constants.AZURE_SQL_DATABASE_VIRTUAL_MACHINE; // AZURE_SQL_DATABASE_VIRTUAL_MACHINE_SHORT
				break;

			case MigrationTargetType.SQLDB:
				this.targetName = constants.AZURE_SQL_DATABASE;
				break;
		}

		this.title = constants.RECOMMENDATIONS_TITLE(this.targetName);
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const flex = this.createContainer(view);

					this._disposables.push(view.onClosed(e => {
						this._disposables.forEach(
							d => { try { d.dispose(); } catch { } });
					}));

					await view.initializeModel(flex);
					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});

	}
	private createContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin': '8px 16px',
				'flex-direction': 'column',
			}
		}).component();

		this.targetRecommendations?.forEach(recommendation => {
			container.addItem(this.createRecommendation(_view, recommendation));
		});
		return container;
	}

	private createRecommendation(_view: azdata.ModelView, recommendationItem: mssql.SkuRecommendationResultItem): azdata.FlexContainer {

		let recommendation: mssql.IaaSSkuRecommendationResultItem | mssql.PaaSSkuRecommendationResultItem;

		let configuration;
		let storageSection;
		switch (this._targetType) {
			case MigrationTargetType.SQLVM:
				recommendation = <mssql.IaaSSkuRecommendationResultItem>recommendationItem;

				configuration = constants.VM_CONFIGURATION(recommendation.targetSku.virtualMachineSize!.azureSkuName, recommendation.targetSku.virtualMachineSize!.vCPUsAvailable);

				storageSection = this.createSqlVmTargetStorageSection(_view, recommendation);
				break;

			case MigrationTargetType.SQLMI:
			case MigrationTargetType.SQLDB:
				recommendation = <mssql.PaaSSkuRecommendationResultItem>recommendationItem;

				const serviceTier = recommendation.targetSku.category?.sqlServiceTier === mssql.AzureSqlPaaSServiceTier.GeneralPurpose
					? constants.GENERAL_PURPOSE
					: constants.BUSINESS_CRITICAL;

				const hardwareType = recommendation.targetSku.category?.hardwareType === mssql.AzureSqlPaaSHardwareType.Gen5
					? constants.GEN5
					: recommendation.targetSku.category?.hardwareType === mssql.AzureSqlPaaSHardwareType.PremiumSeries
						? constants.PREMIUM_SERIES
						: constants.PREMIUM_SERIES_MEMORY_OPTIMIZED;

				configuration = this._targetType === MigrationTargetType.SQLDB
					? constants.DB_CONFIGURATION(serviceTier, recommendation.targetSku.computeSize!)
					: constants.MI_CONFIGURATION(hardwareType, serviceTier, recommendation.targetSku.computeSize!);

				const storageLabel = _view.modelBuilder.text().withProps({
					value: constants.STORAGE_HEADER,
					CSSStyles: {
						...styles.LABEL_CSS,
					}
				}).component();
				const storageValue = _view.modelBuilder.text().withProps({
					value: constants.STORAGE_GB(recommendation.targetSku.storageMaxSizeInMb! / 1024),
					CSSStyles: {
						...styles.BODY_CSS,
					}
				}).component();

				storageSection = _view.modelBuilder.flexContainer().withLayout({
					flexFlow: 'column'
				}).withItems([
					storageLabel,
					storageValue,
				]).component();
				break;
		}
		const recommendationContainer = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin-bottom': '24px',
				'flex-direction': 'column',
			}
		}).component();

		if (this._targetType === MigrationTargetType.SQLDB) {
			const databaseNameLabel = _view.modelBuilder.text().withProps({
				value: recommendation.databaseName!,
				CSSStyles: {
					...styles.SECTION_HEADER_CSS,
				}
			}).component();
			recommendationContainer.addItem(databaseNameLabel);
		}

		// const recommendationsSection = _view.modelBuilder.text().withProps({
		// 	value: constants.RECOMMENDATIONS,
		// 	CSSStyles: {
		// 		...styles.SECTION_HEADER_CSS,
		// 		'margin-top': '4px'
		// 	}
		// }).component();

		const targetDeploymentTypeLabel = _view.modelBuilder.text().withProps({
			value: constants.TARGET_DEPLOYMENT_TYPE,
			CSSStyles: {
				...styles.LABEL_CSS,
			}
		}).component();
		const targetDeploymentTypeValue = _view.modelBuilder.text().withProps({
			value: this.targetName,
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();

		const azureConfigurationLabel = _view.modelBuilder.text().withProps({
			value: constants.AZURE_CONFIGURATION,
			CSSStyles: {
				...styles.LABEL_CSS,
			}
		}).component();
		const azureConfigurationValue = _view.modelBuilder.text().withProps({
			value: configuration,
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();

		recommendationContainer.addItems([
			// recommendationsSection,
			targetDeploymentTypeLabel,
			targetDeploymentTypeValue,

			targetDeploymentTypeLabel,
			targetDeploymentTypeValue,

			azureConfigurationLabel,
			azureConfigurationValue,

			storageSection
		]);

		const recommendationsReasonSection = _view.modelBuilder.text().withProps({
			value: constants.RECOMMENDATION_REASON,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'margin-top': '12px'
			}
		}).component();

		const reasonsContainer = _view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		const justifications: string[] = recommendation.positiveJustifications;

		justifications.forEach(text => {
			reasonsContainer.addItem(
				_view.modelBuilder.text().withProps({
					value: text,
					CSSStyles: {
						...styles.BODY_CSS,
					}
				}).component()
			);
		});

		// TO-DO: add SqlInstanceRequirements to justification text for now until we have a dedicated 'Source properties' table
		let requirements = [];
		switch (recommendation.targetSku.category.sqlTargetPlatform) {
			case mssql.AzureSqlTargetPlatform.AzureSqlManagedInstance:
			case mssql.AzureSqlTargetPlatform.AzureSqlVirtualMachine:
				requirements.push('CPU requirement: ' + this.instanceRequirements?.cpuRequirementInCores! + ' cores');
				requirements.push('Memory requirement: ' + this.instanceRequirements?.memoryRequirementInMB! / 1024 + ' GB');
				requirements.push('Data storage requirement: ' + this.instanceRequirements?.dataStorageRequirementInMB! / 1024 + ' GB');
				requirements.push('Log storage requirement: ' + this.instanceRequirements?.logStorageRequirementInMB! / 1024 + ' GB');
				requirements.push('Data IOPS requirement: ' + this.instanceRequirements?.dataIOPSRequirement! + ' IOPS');
				requirements.push('Log IOPS requirement: ' + this.instanceRequirements?.logIOPSRequirement! + ' IOPS');
				requirements.push('IO latency requirement: ' + this.instanceRequirements?.ioLatencyRequirementInMs! + ' ms');
				break;
			case mssql.AzureSqlTargetPlatform.AzureSqlDatabase:
				let db = this.instanceRequirements?.databaseLevelRequirements.filter(d => {
					return recommendation.databaseName === d.databaseName;
				})[0]!;

				requirements.push('CPU requirement: ' + db.cpuRequirementInCores! + ' cores');
				requirements.push('Memory requirement: ' + db.memoryRequirementInMB! / 1024 + ' GB');
				requirements.push('Data storage requirement: ' + db.dataStorageRequirementInMB! / 1024 + ' GB');
				requirements.push('Log storage requirement: ' + db.logStorageRequirementInMB! / 1024 + ' GB');
				requirements.push('Data IOPS requirement: ' + db.dataIOPSRequirement! + ' IOPS');
				requirements.push('Log IOPS requirement: ' + db.logIOPSRequirement! + ' IOPS');
				requirements.push('IO latency requirement: ' + db.ioLatencyRequirementInMs! + ' ms');
				break;
		}
		requirements.forEach(text => {
			reasonsContainer.addItem(
				_view.modelBuilder.text().withProps({
					value: text,
					CSSStyles: {
						...styles.BODY_CSS,
					}
				}).component()
			);
		});
		////////////

		recommendationContainer.addItems([
			recommendationsReasonSection,
			reasonsContainer,
		]);

		return recommendationContainer;
	}

	private createSqlVmTargetStorageSection(_view: azdata.ModelView, recommendation: mssql.IaaSSkuRecommendationResultItem): azdata.FlexContainer {

		const recommendedTargetStorageSection = _view.modelBuilder.text().withProps({
			value: constants.RECOMMENDED_TARGET_STORAGE_CONFIGURATION,
			CSSStyles: {
				...styles.SECTION_HEADER_CSS,
				'margin-top': '12px'
			}
		}).component();
		const recommendedTargetStorageInfo = _view.modelBuilder.text().withProps({
			value: constants.RECOMMENDED_TARGET_STORAGE_CONFIGURATION_INFO,
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();


		const headerCssStyle = {
			'border': 'none',
			'text-align': 'left',
			'white-space': 'nowrap',
			'text-overflow': 'ellipsis',
			'overflow': 'hidden',
			'border-bottom': '1px solid'
		};

		const rowCssStyle = {
			'border': 'none',
			'text-align': 'left',
			'white-space': 'nowrap',
			'text-overflow': 'ellipsis',
			'overflow': 'hidden',
		};

		const columnWidth = 150;
		let columns: azdata.DeclarativeTableColumn[] = [
			{
				valueType: azdata.DeclarativeDataType.string,
				displayName: constants.STORAGE_HEADER,
				isReadOnly: true,
				width: columnWidth,
				rowCssStyles: rowCssStyle,
				headerCssStyles: headerCssStyle
			},
			{
				valueType: azdata.DeclarativeDataType.string,
				displayName: constants.RECOMMENDED_STORAGE_CONFIGURATION,
				isReadOnly: true,
				width: columnWidth,
				rowCssStyles: rowCssStyle,
				headerCssStyles: headerCssStyle
			},
			{
				valueType: azdata.DeclarativeDataType.string,
				displayName: constants.CACHING,
				isReadOnly: true,
				width: columnWidth,
				rowCssStyles: rowCssStyle,
				headerCssStyles: headerCssStyle
			}
		];

		const tempTableRow: azdata.DeclarativeTableCellValue[] = [
			{ value: constants.SQL_TEMPDB },
			{
				value: recommendation.targetSku.tempDbDiskSizes!.length > 0
					? recommendation.targetSku.logDiskSizes!.length + ' x ' + recommendation.targetSku.logDiskSizes![0].size
					: constants.EPHEMERAL_TEMPDB
			},
			{
				value: recommendation.targetSku.tempDbDiskSizes!.length > 0
					? this.getCachingText(recommendation.targetSku.logDiskSizes![0].caching)
					: constants.CACHING_NA
			}
		];

		const dataDiskTableRow: azdata.DeclarativeTableCellValue[] = [
			{ value: constants.SQL_DATA_FILES },
			{ value: recommendation.targetSku.dataDiskSizes!.length + ' x ' + recommendation.targetSku.dataDiskSizes![0].size },
			{ value: this.getCachingText(recommendation.targetSku.dataDiskSizes![0].caching) }
		];

		const logDiskTableRow: azdata.DeclarativeTableCellValue[] = [
			{ value: constants.SQL_LOG_FILES },
			{ value: recommendation.targetSku.logDiskSizes!.length + ' x ' + recommendation.targetSku.logDiskSizes![0].size },
			{ value: this.getCachingText(recommendation.targetSku.logDiskSizes![0].caching) }
		];

		let storageConfigurationTableRows: azdata.DeclarativeTableCellValue[][] = [
			tempTableRow,
			dataDiskTableRow,
			logDiskTableRow,
		];

		const storageConfigurationTable: azdata.DeclarativeTableComponent = _view.modelBuilder.declarativeTable().withProps({
			ariaLabel: constants.RECOMMENDED_TARGET_STORAGE_CONFIGURATION,
			columns: columns,
			dataValues: storageConfigurationTableRows,
			width: 700
		}).component();

		const container = _view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			recommendedTargetStorageSection,
			recommendedTargetStorageInfo,
			storageConfigurationTable,
		]).component();
		return container;
	}

	private getCachingText(caching: mssql.AzureManagedDiskCaching): string {
		let text;
		switch (caching) {
			case mssql.AzureManagedDiskCaching.NotApplicable:
				text = constants.CACHING_NA;
				break;

			case mssql.AzureManagedDiskCaching.None:
				text = constants.CACHING_NONE;
				break;

			case mssql.AzureManagedDiskCaching.ReadOnly:
				text = constants.CACHING_READ_ONLY;
				break;

			case mssql.AzureManagedDiskCaching.ReadWrite:
				text = constants.CACHING_READ_WRITE;
				break;
		}

		return text;
	}

	public async openDialog(dialogName?: string, recommendations?: mssql.SkuRecommendationResult) {
		if (!this._isOpen) {
			this.instanceRequirements = recommendations?.instanceRequirements;

			switch (this._targetType) {
				case MigrationTargetType.SQLMI:
					this.targetRecommendations = recommendations?.sqlMiRecommendationResults;
					break;

				case MigrationTargetType.SQLVM:
					this.targetRecommendations = recommendations?.sqlVmRecommendationResults;
					break;

				case MigrationTargetType.SQLDB:
					this.targetRecommendations = recommendations?.sqlDbRecommendationResults;
					break;
			}

			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(this.title!, 'SkuRecommendationResultsDialog', 'medium');

			this.dialog.okButton.label = SkuRecommendationResultsDialog.OpenButtonText;
			this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));

			this.dialog.cancelButton.label = SkuRecommendationResultsDialog.CreateTargetButtonText;
			this._disposables.push(this.dialog.okButton.onClick(async () => console.log(SkuRecommendationResultsDialog.CreateTargetButtonText)));

			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));
			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);
		}
	}

	protected async execute() {
		this._isOpen = false;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
