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
			<azdata.ToolbarComponent>{ component: this.createStartPerformanceCollectionButton(view), toolbarSeparatorAfter: false },
			<azdata.ToolbarComponent>{ component: this.createStopPerformanceCollectionButton(view), toolbarSeparatorAfter: false },
			<azdata.ToolbarComponent>{ component: this.createImportPerformanceDataButton(view), toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this.createRecommendationParametersButton(view), toolbarSeparatorAfter: false },
		]);

		return toolbar.component();
	}

	private createRefreshSKURecommendationButton(view: azdata.ModelView): azdata.ButtonComponent {
		const refreshSKURecommendationButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.REFRESH,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.refresh,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// TODO - implement onDidClick and add to disposables
		return refreshSKURecommendationButton;
	}

	private createStartPerformanceCollectionButton(view: azdata.ModelView): azdata.ButtonComponent {
		const startPerformanceCollectionButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.START_PERFORMANCE_COLLECTION,
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
		return startPerformanceCollectionButton;
	}

	private createStopPerformanceCollectionButton(view: azdata.ModelView): azdata.ButtonComponent {
		const stopPerformanceCollectionButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.STOP_PERFORMANCE_COLLECTION,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.stopDataCollection,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		stopPerformanceCollectionButton.enabled = false;
		// TODO - implement onDidClick and add to disposables
		return stopPerformanceCollectionButton;
	}

	private createImportPerformanceDataButton(view: azdata.ModelView): azdata.ButtonComponent {
		const importPerformanceDataButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.IMPORT_PERFORMANCE_DATA,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.import,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();
		// TODO - implement onDidClick and add to disposables
		return importPerformanceDataButton;
	}

	private createRecommendationParametersButton(view: azdata.ModelView): azdata.ButtonComponent {
		const recommendationParametersButton = view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.RECOMMENDATION_PARAMETERS,
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
