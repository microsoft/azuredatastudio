/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { selectDropDownIndex } from '../../api/utils';
import { SKURecommendationPage } from '../../wizard/skuRecommendationPage';
import * as mssql from 'mssql';

export class GenerateArmTemplateDialog {
	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

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
		const description1 = _view.modelBuilder.text().withProps({
			value: constants.AZURE_RECOMMENDATION_DESCRIPTION,
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();
		const description2 = _view.modelBuilder.text().withProps({
			value: constants.AZURE_RECOMMENDATION_DESCRIPTION2,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-top': '8px',
			}
		}).component();
		container.addItems([
			description1,
			description2,
		]);
		return container;
	}

	public async openDialog(dialogName?: string, recommendations?: mssql.SkuRecommendationResult) {
		if (!this._isOpen){
			this._isOpen = true;
		}
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

}
