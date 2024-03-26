/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as contracts from '../../service/contracts';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';
import { MigrationTargetType } from '../../api/utils';
import * as fs from 'fs';
import path = require('path');

export class SkuRecommendationResultsDialog {

	private static readonly OpenButtonText: string = 'Close';
	// private static readonly CreateTargetButtonText: string = 'Create target in portal';

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;
	private migrationStateModel: MigrationStateModel;

	// Dialog Name for Telemetry
	public dialogName: string | undefined;
	private _disposables: vscode.Disposable[] = [];
	public title?: string;
	public targetName?: string;
	private _saveButton!: azdata.window.Button;

	public targetRecommendations?: contracts.SkuRecommendationResultItem[];
	public instanceRequirements?: contracts.SqlInstanceRequirements;

	constructor(public model: MigrationStateModel, public _targetType: MigrationTargetType) {
		switch (this._targetType) {
			case MigrationTargetType.SQLMI:
				this.targetName = constants.SKU_RECOMMENDATION_MI_TARGET_TEXT;
				break;
			case MigrationTargetType.SQLVM:
				this.targetName = constants.SKU_RECOMMENDATION_VM_TARGET_TEXT;
				break;
			case MigrationTargetType.SQLDB:
				this.targetName = constants.SKU_RECOMMENDATION_SQLDB_TARGET_TEXT;
				break;
		}

		this.title = constants.RECOMMENDATIONS_TITLE(this.targetName);
		this.migrationStateModel = model;
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

		this.targetRecommendations?.forEach((recommendation, index) => {
			if (index > 0) {
				const separator = _view.modelBuilder.separator()
					.withProps({ width: 750 })
					.component();
				container.addItem(separator);
			}

			container.addItem(this.createRecommendation(_view, recommendation));
		});
		return container;
	}

	private createRecommendation(_view: azdata.ModelView, recommendationItem: contracts.SkuRecommendationResultItem): azdata.FlexContainer {

		let recommendation: contracts.IaaSSkuRecommendationResultItem | contracts.PaaSSkuRecommendationResultItem;

		let configuration = constants.NA;
		let storageSection = _view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		switch (this._targetType) {
			case MigrationTargetType.SQLVM:
				recommendation = <contracts.IaaSSkuRecommendationResultItem>recommendationItem;

				if (recommendation.targetSku) {
					configuration = constants.VM_CONFIGURATION(
						recommendation.targetSku.virtualMachineSize!.azureSkuName,
						recommendation.targetSku.virtualMachineSize!.vCPUsAvailable);

					storageSection = this.createSqlVmTargetStorageSection(_view, recommendation);
				}
				break;

			case MigrationTargetType.SQLMI:
			case MigrationTargetType.SQLDB:
				recommendation = <contracts.PaaSSkuRecommendationResultItem>recommendationItem;

				if (recommendation.targetSku) {
					const serviceTier = recommendation.targetSku.category?.sqlServiceTier === contracts.AzureSqlPaaSServiceTier.GeneralPurpose
						? constants.GENERAL_PURPOSE
						: recommendation.targetSku.category?.sqlServiceTier === contracts.AzureSqlPaaSServiceTier.HyperScale
							? constants.HYPERSCALE :
							recommendation.targetSku.category?.sqlServiceTier === contracts.AzureSqlPaaSServiceTier.NextGenGeneralPurpose
								? constants.NEXTGEN_GENERAL_PURPOSE
								: constants.BUSINESS_CRITICAL;

					const hardwareType = recommendation.targetSku.category?.hardwareType === contracts.AzureSqlPaaSHardwareType.Gen5
						? constants.GEN5
						: recommendation.targetSku.category?.hardwareType === contracts.AzureSqlPaaSHardwareType.PremiumSeries
							? constants.PREMIUM_SERIES
							: constants.PREMIUM_SERIES_MEMORY_OPTIMIZED;

					configuration = this._targetType === MigrationTargetType.SQLDB
						? constants.SQLDB_CONFIGURATION(serviceTier, recommendation.targetSku.computeSize!)
						: constants.MI_CONFIGURATION(hardwareType, serviceTier, recommendation.targetSku.computeSize!);

					const storageLabel = _view.modelBuilder.text()
						.withProps({
							value: constants.STORAGE_HEADER,
							CSSStyles: {
								...styles.LABEL_CSS,
								'margin': '12px 0 0',
							}
						}).component();
					const storageValue = _view.modelBuilder.text()
						.withProps({
							value: constants.STORAGE_GB(recommendation.targetSku.storageMaxSizeInMb! / 1024),
							CSSStyles: { ...styles.BODY_CSS, }
						}).component();

					storageSection.addItems([
						storageLabel,
						storageValue]);
				}
				break;
		}
		const recommendationContainer = _view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'margin-bottom': '20px',
					'flex-direction': 'column',
				}
			}).component();

		if (this._targetType === MigrationTargetType.SQLDB) {
			const databaseNameLabel = _view.modelBuilder.text()
				.withProps({
					value: constants.SOURCE_DATABASE,
					CSSStyles: { ...styles.LABEL_CSS, 'margin': '0', }
				}).component();

			const databaseNameValue = _view.modelBuilder.text()
				.withProps({
					value: recommendation.databaseName!,
					CSSStyles: { ...styles.BODY_CSS, 'margin': '0', }
				}).component();
			recommendationContainer.addItem(databaseNameLabel);
			recommendationContainer.addItem(databaseNameValue);
		}

		const targetDeploymentTypeLabel = _view.modelBuilder.text()
			.withProps({
				value: constants.TARGET_DEPLOYMENT_TYPE,
				CSSStyles: { ...styles.LABEL_CSS, 'margin': '12px 0 0', }
			}).component();
		const targetDeploymentTypeValue = _view.modelBuilder.text()
			.withProps({
				value: this.targetName,
				CSSStyles: { ...styles.BODY_CSS, 'margin': '0', }
			}).component();

		const azureConfigurationLabel = _view.modelBuilder.text()
			.withProps({
				value: constants.AZURE_CONFIGURATION,
				CSSStyles: { ...styles.LABEL_CSS, 'margin': '12px 0 0', }
			}).component();
		const azureConfigurationValue = _view.modelBuilder.text()
			.withProps({
				value: configuration,
				CSSStyles: { ...styles.BODY_CSS, 'margin': '0', }
			}).component();

		recommendationContainer.addItems([
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
			CSSStyles: { ...styles.SECTION_HEADER_CSS, 'margin': '12px 0 0' }
		}).component();

		const reasonsContainer = _view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.component();

		const justifications: string[] = recommendation?.positiveJustifications?.concat(recommendation?.negativeJustifications)
			|| [constants.SKU_RECOMMENDATION_NO_RECOMMENDATION_REASON];

		justifications?.forEach(text => {
			reasonsContainer.addItem(
				_view.modelBuilder.text().withProps({
					value: text,
					CSSStyles: { ...styles.BODY_CSS, }
				}).component()
			);
		});

		const storagePropertiesContainer = this.createStoragePropertiesTable(_view, recommendation?.databaseName);

		recommendationContainer.addItems([
			recommendationsReasonSection,
			reasonsContainer,
			storagePropertiesContainer]);

		return recommendationContainer;
	}

	private createSqlVmTargetStorageSection(_view: azdata.ModelView, recommendation: contracts.IaaSSkuRecommendationResultItem): azdata.FlexContainer {
		const recommendedTargetStorageSection = _view.modelBuilder.text()
			.withProps({
				value: constants.RECOMMENDED_TARGET_STORAGE_CONFIGURATION,
				CSSStyles: { ...styles.SECTION_HEADER_CSS, 'margin-top': '12px' }
			}).component();

		const recommendedTargetStorageInfo = _view.modelBuilder.text()
			.withProps({
				value: constants.RECOMMENDED_TARGET_STORAGE_CONFIGURATION_INFO,
				CSSStyles: { ...styles.BODY_CSS, }
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
				value: recommendation.targetSku.tempDbDiskSizes!?.length > 0
					? this.getStorageConfigurationText(recommendation.targetSku.logDiskSizes)
					: constants.EPHEMERAL_TEMPDB
			},
			{
				value: recommendation.targetSku.tempDbDiskSizes!?.length > 0
					? this.getCachingText(recommendation.targetSku.logDiskSizes![0].caching)
					: constants.CACHING_NA
			}
		];

		const dataDiskTableRow: azdata.DeclarativeTableCellValue[] = [
			{ value: constants.SQL_DATA_FILES },
			{
				value: this.getStorageConfigurationText(recommendation.targetSku.dataDiskSizes)
			},
			{ value: this.getCachingText(recommendation.targetSku.dataDiskSizes![0].caching) }
		];

		const logDiskTableRow: azdata.DeclarativeTableCellValue[] = [
			{ value: constants.SQL_LOG_FILES },
			{
				value: this.getStorageConfigurationText(recommendation.targetSku.logDiskSizes)
			},
			{ value: this.getCachingText(recommendation.targetSku.logDiskSizes![0].caching) }
		];

		let storageConfigurationTableRows: azdata.DeclarativeTableCellValue[][] = [
			tempTableRow,
			dataDiskTableRow,
			logDiskTableRow,
		];

		const storageConfigurationTable: azdata.DeclarativeTableComponent = _view.modelBuilder.declarativeTable()
			.withProps({
				ariaLabel: constants.RECOMMENDED_TARGET_STORAGE_CONFIGURATION,
				columns: columns,
				dataValues: storageConfigurationTableRows,
				width: 700
			}).component();

		const container = _view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				recommendedTargetStorageSection,
				recommendedTargetStorageInfo,
				storageConfigurationTable])
			.component();
		return container;
	}

	private getCachingText(caching: contracts.AzureManagedDiskCaching): string {
		switch (caching) {
			case contracts.AzureManagedDiskCaching.NotApplicable:
				return constants.CACHING_NA;

			case contracts.AzureManagedDiskCaching.None:
				return constants.CACHING_NONE;

			case contracts.AzureManagedDiskCaching.ReadOnly:
				return constants.CACHING_READ_ONLY;

			case contracts.AzureManagedDiskCaching.ReadWrite:
				return constants.CACHING_READ_WRITE;
		}
	}

	// This method looks into Disk SKU list and returns storage configuration text.
	private getStorageConfigurationText(disks: contracts.AzureManagedDiskSku[]): string {

		const diskTypeCountMap: { [diskConfigurationText: string]: number } = {};
		if (disks!?.length > 0) {
			disks.forEach(disk => {
				const diskConfigurationText = this.GetDiskConfigurationText(disk);
				if (diskConfigurationText in diskTypeCountMap) {
					// Check if the key exists in the map
					diskTypeCountMap[diskConfigurationText]++;
				} else {
					// If the key doesn't exist, initialize it with a count of 1
					diskTypeCountMap[diskConfigurationText] = 1;
				}
			});
		}

		let storageConfigurationText: string = '';
		for (const diskConfigurationText in diskTypeCountMap) {
			if (diskTypeCountMap.hasOwnProperty(diskConfigurationText)) {
				const count: number = diskTypeCountMap[diskConfigurationText];
				storageConfigurationText = storageConfigurationText.concat(constants.STORAGE_CONFIGURATION(count, diskConfigurationText));
			}

		}

		return storageConfigurationText;
	}

	// This method returns single disk configuration text.
	private GetDiskConfigurationText(disk: contracts.AzureManagedDiskSku): string {
		return disk!?.type === contracts.AzureManagedDiskType.PremiumSSDV2 ?
			constants.DISK_CONFIGURATION(this.getDiskTypeText(disk.type), disk.maxSizeInGib, disk.maxIOPS, disk.maxThroughputInMbps) :
			disk.size;
	}

	// This method returns disk type text from enum value.
	private getDiskTypeText(type: contracts.AzureManagedDiskType): string {
		const diskTypeText = constants.DiskTypeLookup[type];
		return diskTypeText !== undefined ? diskTypeText : constants.UNKNOWN_DISK_TYPE;
	}

	private createStoragePropertiesTable(_view: azdata.ModelView, databaseName?: string): azdata.FlexContainer {
		let instanceRequirements;
		switch (this._targetType) {
			case MigrationTargetType.SQLVM:
			case MigrationTargetType.SQLMI:
				instanceRequirements = this.instanceRequirements;
				break;

			case MigrationTargetType.SQLDB:
				instanceRequirements = this.instanceRequirements?.databaseLevelRequirements
					.filter((d) => databaseName === d.databaseName)[0]!;
				break;
		}

		const storagePropertiesSection = _view.modelBuilder.text()
			.withProps({
				value: constants.SOURCE_PROPERTIES,
				CSSStyles: { ...styles.SECTION_HEADER_CSS, 'margin-top': '12px' }
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

		const columnWidth = 80;
		const columns: azdata.DeclarativeTableColumn[] = [
			{
				valueType: azdata.DeclarativeDataType.string,
				displayName: constants.DIMENSION,
				isReadOnly: true,
				width: columnWidth,
				rowCssStyles: rowCssStyle,
				headerCssStyles: headerCssStyle
			},
			{
				valueType: azdata.DeclarativeDataType.string,
				displayName: constants.VALUE,
				isReadOnly: true,
				width: columnWidth,
				rowCssStyles: rowCssStyle,
				headerCssStyles: headerCssStyle
			}
		];

		const createRow = (dimension: string, value: string) => {
			const row: azdata.DeclarativeTableCellValue[] = [
				{ value: dimension },
				{ value: value }
			];
			return row;
		};
		const cpuRow = createRow(constants.CPU_REQUIREMENT, constants.CPU_CORES(instanceRequirements?.cpuRequirementInCores!));
		const memoryRow = createRow(constants.MEMORY_REQUIREMENT, constants.GB(instanceRequirements?.memoryRequirementInMB! / 1024));
		const dataStorageRow = createRow(constants.DATA_STORAGE_REQUIREMENT, constants.GB(instanceRequirements?.dataStorageRequirementInMB! / 1024));
		const logStorageRow = createRow(constants.LOG_STORAGE_REQUIREMENT, constants.GB(instanceRequirements?.logStorageRequirementInMB! / 1024));
		const dataIOPSRow = createRow(constants.DATA_IOPS_REQUIREMENT, constants.IOPS(instanceRequirements?.dataIOPSRequirement!));
		const logsIOPSRow = createRow(constants.LOGS_IOPS_REQUIREMENT, constants.IOPS(instanceRequirements?.logIOPSRequirement!));
		const ioLatencyRow = createRow(constants.IO_LATENCY_REQUIREMENT, instanceRequirements?.ioThroughputRequirementInMBps! < 5 ? constants.NA : constants.MS(instanceRequirements?.ioLatencyRequirementInMs!));
		const storagePropertiesTableRows: azdata.DeclarativeTableCellValue[][] = [
			cpuRow,
			memoryRow,
			dataStorageRow,
			logStorageRow,
			dataIOPSRow,
			logsIOPSRow,
			ioLatencyRow,
		];

		const storagePropertiesTable: azdata.DeclarativeTableComponent = _view.modelBuilder.declarativeTable()
			.withProps({
				ariaLabel: constants.RECOMMENDED_TARGET_STORAGE_CONFIGURATION,
				columns: columns,
				dataValues: storagePropertiesTableRows,
				width: 300
			}).component();

		const container = _view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([storagePropertiesSection, storagePropertiesTable])
			.component();
		return container;
	}

	public async openDialog(dialogName?: string, recommendations?: contracts.SkuRecommendationResult) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.instanceRequirements = recommendations?.instanceRequirements;

			switch (this._targetType) {
				case MigrationTargetType.SQLMI:
					if (this.migrationStateModel._skuEnableElastic) {
						this.targetRecommendations = recommendations?.elasticSqlMiRecommendationResults;
					} else {
						this.targetRecommendations = recommendations?.sqlMiRecommendationResults;
					}
					break;

				case MigrationTargetType.SQLVM:
					// elastic model currently doesn't support SQL VM, so show the baseline model results regardless of user preference
					// this.targetRecommendations = recommendations?.elasticModelResults.sqlDbRecommendationResults;
					this.targetRecommendations = recommendations?.sqlVmRecommendationResults;
					break;

				case MigrationTargetType.SQLDB:
					if (this.migrationStateModel._skuEnableElastic) {
						this.targetRecommendations = recommendations?.elasticSqlDbRecommendationResults;
					} else {
						this.targetRecommendations = recommendations?.sqlDbRecommendationResults;
					}
					break;
			}

			this.dialog = azdata.window.createModelViewDialog(this.title!, 'SkuRecommendationResultsDialog', 'medium');

			this.dialog.okButton.label = SkuRecommendationResultsDialog.OpenButtonText;
			this.dialog.okButton.position = 'left';
			this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));

			this.dialog.cancelButton.hidden = true;
			// TO-DO: When "Create target in Portal" feature is ready, unhide cancel button and use cancelButton to direct user to Portal
			// this.dialog.cancelButton.label = SkuRecommendationResultsDialog.CreateTargetButtonText;
			// this._disposables.push(this.dialog.cancelButton.onClick(async () => console.log(SkuRecommendationResultsDialog.CreateTargetButtonText)));

			this._saveButton = azdata.window.createButton(
				constants.SAVE_RECOMMENDATION_REPORT,
				'right');
			this._disposables.push(
				this._saveButton.onClick(async () => {
					const folder = await utils.promptUserForFolder();
					if (folder) {
						if (this.model._skuRecommendationReportFilePaths) {

							let sourceFilePath: string | undefined;
							let destinationFilePath: string | undefined;

							switch (this._targetType) {
								case MigrationTargetType.SQLMI:
									sourceFilePath = this.model._skuRecommendationReportFilePaths.find(filePath => filePath.includes('SkuRecommendationReport-AzureSqlManagedInstance'));
									destinationFilePath = path.join(folder, 'SkuRecommendationReport-AzureSqlManagedInstance.html');
									break;

								case MigrationTargetType.SQLVM:
									sourceFilePath = this.model._skuRecommendationReportFilePaths.find(filePath => filePath.includes('SkuRecommendationReport-AzureSqlVirtualMachine'));
									destinationFilePath = path.join(folder, 'SkuRecommendationReport-AzureSqlVirtualMachine.html');
									break;

								case MigrationTargetType.SQLDB:
									sourceFilePath = this.model._skuRecommendationReportFilePaths.find(filePath => filePath.includes('SkuRecommendationReport-AzureSqlDatabase'));
									destinationFilePath = path.join(folder, 'SkuRecommendationReport-AzureSqlDatabase.html');
									break;
							}

							fs.copyFile(sourceFilePath!, destinationFilePath, (err) => {
								if (err) {
									console.log(err);
								} else {
									void vscode.window.showInformationMessage(constants.SAVE_RECOMMENDATION_REPORT_SUCCESS(destinationFilePath!));
								}
							});
						} else {
							console.log('recommendation report not found');
						}
					}
				}));
			this.dialog.customButtons = [this._saveButton];

			const promise = this.initializeDialog(this.dialog);
			azdata.window.openDialog(this.dialog);
			await promise;
		}
	}

	protected async execute() {
		this._isOpen = false;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
