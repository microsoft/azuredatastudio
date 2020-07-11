/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionRecommendations, ExtensionRecommendation } from 'vs/workbench/contrib/extensions/browser/extensionRecommendations';
import { IProductService } from 'vs/platform/product/common/productService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { localize } from 'vs/nls';
import { IExtensionRecommendation } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { IExtensionManagementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionType } from 'vs/platform/extensions/common/extensions';
import { visualizerExtensions } from 'sql/workbench/contrib/extensions/common/constants';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { InstallRecommendedExtensionsByScenarioAction, ShowRecommendedExtensionsByScenarioAction } from 'sql/workbench/contrib/extensions/browser/extensionsActions';
import { IStorageKeysSyncRegistryService } from 'vs/platform/userDataSync/common/storageKeys';

const choiceNever = localize('neverShowAgain', "Don't Show Again");

export class ScenarioRecommendations extends ExtensionRecommendations {

	readonly _recommendations: ExtensionRecommendation[] = [];
	get recommendations(): ReadonlyArray<ExtensionRecommendation> { return this._recommendations; }

	constructor(
		isExtensionAllowedToBeRecommended: (extensionId: string) => boolean,
		@IProductService private readonly productService: IProductService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService configurationService: IConfigurationService,
		@INotificationService notificationService: INotificationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IStorageService storageService: IStorageService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IAdsTelemetryService private readonly adsTelemetryService: IAdsTelemetryService,
		@IStorageKeysSyncRegistryService storageKeysSyncRegistryService: IStorageKeysSyncRegistryService
	) {
		super(isExtensionAllowedToBeRecommended, instantiationService, configurationService, notificationService, telemetryService, storageService, storageKeysSyncRegistryService);

		// this._recommendations = productService.recommendedExtensionsByScenario.map(r => ({ extensionId: r, reason: { reasonId: ExtensionRecommendationReason.Application, reasonText: localize('defaultRecommendations', "This extension is recommended by Azure Data Studio.") }, source: 'application' }));
	}

	protected async doActivate(): Promise<void> {
		return;
	}

	// {{SQL CARBON EDIT}}
	promptRecommendedExtensionsByScenario(scenarioType: string): void {
		const storageKey = 'extensionAssistant/RecommendationsIgnore/' + scenarioType;

		if (this.storageService.getBoolean(storageKey, StorageScope.GLOBAL, false)) {
			return;
		}

		const visualizerExtensionNotificationService = 'VisualizerExtensionNotificationService';

		let recommendationMessage = localize('ExtensionsRecommended', "Azure Data Studio has extension recommendations.");
		if (scenarioType === visualizerExtensions) {
			recommendationMessage = localize('VisualizerExtensionsRecommended', "Azure Data Studio has extension recommendations for data visualization.\nOnce installed, you can select the Visualizer icon to visualize your query results.");
		}
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		Promise.all([this.getRecommendedExtensionsByScenario(scenarioType), this.extensionManagementService.getInstalled(ExtensionType.User)]).then(([recommendations, localExtensions]) => {
			if (!recommendations.every(rec => { return localExtensions.findIndex(local => local.identifier.id.toLocaleLowerCase() === rec.extensionId.toLocaleLowerCase()) !== -1; })) {
				this.notificationService.prompt(
					Severity.Info,
					recommendationMessage,
					[{
						label: localize('installAll', "Install All"),
						run: () => {
							this.adsTelemetryService.sendActionEvent(
								TelemetryKeys.TelemetryView.ExtensionRecommendationDialog,
								TelemetryKeys.TelemetryAction.Click,
								'InstallButton',
								visualizerExtensionNotificationService
							);
							const installAllAction = this.instantiationService.createInstance(InstallRecommendedExtensionsByScenarioAction, scenarioType, recommendations);
							installAllAction.run();
							installAllAction.dispose();
						}
					}, {
						label: localize('showRecommendations', "Show Recommendations"),
						run: () => {
							this.adsTelemetryService.sendActionEvent(
								TelemetryKeys.TelemetryView.ExtensionRecommendationDialog,
								TelemetryKeys.TelemetryAction.Click,
								'ShowRecommendationsButton',
								visualizerExtensionNotificationService
							);
							const showAction = this.instantiationService.createInstance(ShowRecommendedExtensionsByScenarioAction, scenarioType);
							showAction.run();
							showAction.dispose();
						}
					}, {
						label: choiceNever,
						isSecondary: true,
						run: () => {
							this.adsTelemetryService.sendActionEvent(
								TelemetryKeys.TelemetryView.ExtensionRecommendationDialog,
								TelemetryKeys.TelemetryAction.Click,
								'NeverShowAgainButton',
								visualizerExtensionNotificationService
							);
							this.storageService.store(storageKey, true, StorageScope.GLOBAL);
						}
					}],
					{
						sticky: true,
						onCancel: () => {
							this.adsTelemetryService.sendActionEvent(
								TelemetryKeys.TelemetryView.ExtensionRecommendationDialog,
								TelemetryKeys.TelemetryAction.Click,
								'CancelButton',
								visualizerExtensionNotificationService
							);
						}
					}
				);
			}
		});
	}

	getRecommendedExtensionsByScenario(scenarioType: string): Promise<IExtensionRecommendation[]> {
		if (!scenarioType) {
			return Promise.reject(new Error(localize('scenarioTypeUndefined', 'The scenario type for extension recommendations must be provided.')));
		}
		return Promise.resolve((this.productService.recommendedExtensionsByScenario[scenarioType] || [])
			.filter(extensionId => this.isExtensionAllowedToBeRecommended(extensionId))
			.map(extensionId => (<IExtensionRecommendation>{ extensionId, sources: ['application'] })));
	}
}
