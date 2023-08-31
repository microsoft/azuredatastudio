/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';
import * as styles from '../../constants/styles';
import * as constants from '../../constants/strings';

export class SkuDataCollectionToolbar implements vscode.Disposable {
	private _disposables: vscode.Disposable[] = [];

	public createToolbar(view: azdata.ModelView): azdata.ToolbarContainer {
		const toolbar = view.modelBuilder.toolbarContainer()

		toolbar.addToolbarItems([
			<azdata.ToolbarComponent>{ component: this.createRefreshSKURecommendationButton(view), toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this.createStartDataCollectionButton(view), toolbarSeparatorAfter: false },
			<azdata.ToolbarComponent>{ component: this.createStopDataCollectionButton(view), toolbarSeparatorAfter: false },
			<azdata.ToolbarComponent>{ component: this.createImportPerformanceButton(view), toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this.createRecommendationParametersButton(view), toolbarSeparatorAfter: false },
		]);

		// commenting this CSS Properties, we can edit this as per requirement.
		// toolbar.withProps({
		// 	CSSStyles: {
		// 		'margin': '0',
		// 		'padding': '0',
		// 	}
		// });

		return toolbar.component();
	}

	private createRefreshSKURecommendationButton(view: azdata.ModelView): azdata.ButtonComponent {
		const refreshSKURecommendationButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.REFRESH_SKU_RECOMMENDATION_BUTTON_LABEL,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.newRefresh,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// TODO - implement onDidClick and add to disposables
		return refreshSKURecommendationButton;
	}

	private createStartDataCollectionButton(view: azdata.ModelView): azdata.ButtonComponent {
		const startDataCollectionButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.START_DATACOLLECTION_BUTTON_LABEL,
				width: 146,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.startDataCollection,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// TODO - implement onDidClick and add to disposables
		return startDataCollectionButton;
	}

	private createStopDataCollectionButton(view: azdata.ModelView): azdata.ButtonComponent {
		const stopDataCollectionButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.STOP_DATACOLLECTION_BUTTON_LABEL,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.stopDataCollection,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// TODO - implement onDidClick and add to disposables
		return stopDataCollectionButton;
	}

	private createImportPerformanceButton(view: azdata.ModelView): azdata.ButtonComponent {
		const importPerformanceButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.IMPORT_PERFORMANCEDATA_BUTTON_LABEL,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.import,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// TODO - implement onDidClick and add to disposables
		return importPerformanceButton;
	}

	private createRecommendationParametersButton(view: azdata.ModelView): azdata.ButtonComponent {
		const recommendationParametersButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.RECOMMENDATION_PARAMETERS_BUTTON_LABEL,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.settings,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// TODO - implement onDidClick and add to disposables
		return recommendationParametersButton;
	}

	public dispose(): void {
		// TODO - need to call this at the place where toolbar is initialized
		this._disposables.forEach(disposable => disposable.dispose());
		this._disposables.length = 0;
	}
}
