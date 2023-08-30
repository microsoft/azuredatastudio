/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';
import * as styles from '../../constants/styles';

export class SkuDataCollectionToolbar implements vscode.Disposable {
	private _disposables: vscode.Disposable[] = [];

	public createToolbar(view: azdata.ModelView): azdata.ToolbarContainer {
		const toolbar = view.modelBuilder.toolbarContainer()

		toolbar.addToolbarItems([
			<azdata.ToolbarComponent>{ component: this.createRefreshSKURecoButton(view), toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this.createStartDataCollectionButton(view), toolbarSeparatorAfter: false },
			<azdata.ToolbarComponent>{ component: this.createStopDataCollectionButton(view), toolbarSeparatorAfter: false },
			<azdata.ToolbarComponent>{ component: this.createImportPerformanceButton(view), toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this.createRecommendationParametersButton(view), toolbarSeparatorAfter: false },
		]);

		toolbar.withProps({
			CSSStyles: {
				'margin': '0',
				'padding': '0',
			}
		});

		return toolbar.component();
	}

	private createRefreshSKURecoButton(view: azdata.ModelView): azdata.ButtonComponent {
		const refreshSKURecoButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: "Refresh",
				description: "To start SKU Recommendation",
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.newRefresh,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();

		// this._disposables.push(refreshAssessmentButton.onDidClick(async () => {
		// 	const dialog = new ImportPerformanceDataDialog();
		// 	return await dialog.openDialog();
		// }));

		return refreshSKURecoButton;
	}

	private createStartDataCollectionButton(view: azdata.ModelView): azdata.ButtonComponent {
		const startDataCollectionButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: "Start Data Collection",
				description: "To start data collection",
				width: 146,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.startDataCollection,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// this._disposables.push(startDataCollectionButton.onDidClick(async () => {
		// 	const dialog = new ImportPerformanceDataDialog();
		// 	return await dialog.openDialog();
		// }));

		return startDataCollectionButton;
	}

	private createStopDataCollectionButton(view: azdata.ModelView): azdata.ButtonComponent {
		const stopDataCollectionButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: "Stop Data Collection",
				description: "To stop data collection",
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.stopDataCollection,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// this.disposables.push(
		// 	newMigrationButton.onDidClick(async () => {
		// 		const actionId = MenuCommands.StartMigration;
		// 		const args = {
		// 			extensionId: SqlMigrationExtensionId,
		// 			issueTitle: loc.DASHBOARD_MIGRATE_TASK_BUTTON_TITLE,
		// 		};
		// 		return await vscode.commands.executeCommand(actionId, args);
		// 	}));
		return stopDataCollectionButton;
	}

	private createImportPerformanceButton(view: azdata.ModelView): azdata.ButtonComponent {
		const importPerformanceButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: "Import Performance Data",
				description: "To import performance data",
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.importData,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// this.disposables.push(
		// 	newMigrationButton.onDidClick(async () => {
		// 		const actionId = MenuCommands.StartMigration;
		// 		const args = {
		// 			extensionId: SqlMigrationExtensionId,
		// 			issueTitle: loc.DASHBOARD_MIGRATE_TASK_BUTTON_TITLE,
		// 		};
		// 		return await vscode.commands.executeCommand(actionId, args);
		// 	}));
		return importPerformanceButton;
	}

	private createRecommendationParametersButton(view: azdata.ModelView): azdata.ButtonComponent {
		const recommendationParametersButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: "Recommendation Parameters",
				description: "To edit recommendation parameters",
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.newSettings,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// this.disposables.push(
		// 	newMigrationButton.onDidClick(async () => {
		// 		const actionId = MenuCommands.StartMigration;
		// 		const args = {
		// 			extensionId: SqlMigrationExtensionId,
		// 			issueTitle: loc.DASHBOARD_MIGRATE_TASK_BUTTON_TITLE,
		// 		};
		// 		return await vscode.commands.executeCommand(actionId, args);
		// 	}));
		return recommendationParametersButton;
	}

	public dispose(): void {
		this._disposables.forEach(disposable => disposable.dispose());
		this._disposables.length = 0;
	}
}
