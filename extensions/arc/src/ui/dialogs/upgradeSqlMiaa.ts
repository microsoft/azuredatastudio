/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import * as vscode from 'vscode';
import { cssStyles } from '../../constants';
import { InitializingComponent } from '../components/initializingComponent';
import { UpgradeModel } from '../../models/miaaModel';
import { ControllerModel } from '../../models/controllerModel';

export class UpgradeSqlMiaa extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;
	private pitrSettings: UpgradeModel = [];
	private upgradeMiaaDialogName = 'UpgradeSqlMiaaDialog';

	protected _completionPromise = new Deferred<UpgradeModel | undefined>();
	protected disposables: vscode.Disposable[] = [];
	constructor(protected _controllerModel: ControllerModel) {
		super();
	}

	public showDialog(dialogTitle: string): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(dialogTitle, this.upgradeMiaaDialogName, 'narrow', 'flyout');
		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;
			const areYouSure = this.modelBuilder.text().withProps({
				value: loc.areYouSure,
				CSSStyles: { ...cssStyles.title, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' },
			}).component();
			const areYouSureInfo = this.modelBuilder.text().withProps({
				value: loc.upgradeDialogMiaa,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'max-width': 'auto' }
			}).component();
			const upgradeDialog = this.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();

			upgradeDialog.addItem(areYouSureInfo, { CSSStyles: { 'margin-right': '5px' } });

			const monitorUpgradeInfo = this.modelBuilder.text().withProps({
				value: loc.monitorUpgrade,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'max-width': 'auto' }
			}).component();

			upgradeDialog.addItem(monitorUpgradeInfo, { CSSStyles: { 'margin-right': '5px' } });

			const monitorUpgradeCommandInfo = this.modelBuilder.text().withProps({
				value: 'kubectl get sqlmi -A',
				CSSStyles: { ...cssStyles.code, 'margin-block-start': '0px', 'max-width': 'auto' }
			}).component();

			upgradeDialog.addItem(monitorUpgradeCommandInfo, { CSSStyles: { 'margin-right': '5px' } });

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: areYouSure
						},
						{
							component: upgradeDialog
						}
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.initialized = true;
		});

		dialog.okButton.label = loc.upgrade;
		dialog.cancelButton.label = loc.cancel;
		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.onClick(() => {
			this._completionPromise.resolve(this.pitrSettings);
		});
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async validate(): Promise<boolean> {
		return true;
	}

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<UpgradeModel | undefined> {
		return this._completionPromise.promise;
	}
}
