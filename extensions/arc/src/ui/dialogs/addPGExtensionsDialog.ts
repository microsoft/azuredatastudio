/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import { cssStyles } from '../../constants';
import { InitializingComponent } from '../components/initializingComponent';
import { PostgresModel } from '../../models/postgresModel';

export class AddPGExtensionsDialog extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;

	protected extensionsListInputBox!: azdata.InputBoxComponent;

	protected _completionPromise = new Deferred<string | undefined>();

	constructor(protected _model: PostgresModel) {
		super();
	}

	public showDialog(dialogTitle: string): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(dialogTitle);
		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;

			const info = this.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: loc.extensionsFunction,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();

			const link = this.modelBuilder.hyperlink().withProperties<azdata.HyperlinkComponentProperties>({
				label: loc.extensionsLearnMore,
				url: 'https://docs.microsoft.com/azure/azure-arc/data/using-extensions-in-postgresql-hyperscale-server-group',
			}).component();

			const infoAndLink = this.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
			infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
			infoAndLink.addItem(link);

			this.extensionsListInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: '',
					ariaLabel: loc.extensionsAddList,
					enabled: true
				}).component();

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: infoAndLink
						},
						{
							component: this.extensionsListInputBox,
							title: loc.extensionsAddList
						}
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.extensionsListInputBox.focus();
			this.initialized = true;
		});

		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.label = loc.loadExtensions;
		dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async validate(): Promise<boolean> {
		this._completionPromise.resolve(this.extensionsListInputBox.value);
		return true;
	}

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<string | undefined> {
		return this._completionPromise.promise;
	}
}
