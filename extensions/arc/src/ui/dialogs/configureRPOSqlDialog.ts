/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import { cssStyles } from '../../constants';
import { InitializingComponent } from '../components/initializingComponent';
import { MiaaModel, RPModel } from '../../models/miaaModel';

export class ConfigureRPOSqlDialog extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;
	protected rpoInputBox!: azdata.InputBoxComponent;
	protected retentionDaysInputBox!: azdata.InputBoxComponent;
	protected _completionPromise = new Deferred<RPModel | undefined>();
	public saveArgs: RPModel = {
		recoveryPointObjective: '',
		retentionDays: ''
	};

	constructor(protected _model: MiaaModel) {
		super();
	}

	public showDialog(dialogTitle: string, rpo: string | undefined, rd: string | undefined): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(dialogTitle);
		dialog.cancelButton.onClick(() => this.handleCancel());
		rpo = (rpo === undefined ? this._model.config?.spec?.backup?.recoveryPointObjectiveInSeconds?.toString() : rpo);
		rd = (rd === undefined ? this._model.config?.spec?.backup?.retentionPeriodInDays?.toString() : rd);
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;
			this.rpoInputBox = this.modelBuilder.inputBox()
				.withProps({
					readOnly: false,
					min: 300,
					max: 600,
					inputType: 'number',
					ariaLabel: loc.rpo,
					value: rpo
				}).component();
			this.retentionDaysInputBox = this.modelBuilder.inputBox()
				.withProps({
					readOnly: false,
					min: 1,
					max: 35,
					inputType: 'number',
					ariaLabel: loc.rd,
					value: rd
				}).component();

			const info = this.modelBuilder.text().withProps({
				value: loc.pitrInfo,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();

			const link = this.modelBuilder.hyperlink().withProps({
				label: loc.learnMore,
				url: 'https://docs.microsoft.com/azure/azure-arc/data/point-in-time-restore',
			}).component();

			const infoAndLink = this.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
			infoAndLink.addItem(this.modelBuilder.text().withProps({
				value: loc.pitr,
				CSSStyles: { ...cssStyles.title }
			}).component());
			infoAndLink.addItem(info, { CSSStyles: { 'margin-right': '5px' } });
			infoAndLink.addItem(link);

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: infoAndLink
						},
						{
							component: this.rpoInputBox,
							title: loc.rpo,
							required: false
						},
						{
							component: this.retentionDaysInputBox,
							title: loc.rd,
							required: false
						}
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.rpoInputBox.focus();
			this.retentionDaysInputBox.focus();
			this.initialized = true;
		});

		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.label = loc.apply;
		dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async validate(): Promise<boolean> {
		if (!this.rpoInputBox.value || !this.retentionDaysInputBox.value) {
			return false;
		}
		else {
			this.saveArgs.recoveryPointObjective = this.rpoInputBox.value;
			this.saveArgs.retentionDays = this.retentionDaysInputBox.value;
			this._completionPromise.resolve(this.saveArgs);
		}
		return true;
	}

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<RPModel | undefined> {
		return this._completionPromise.promise;
	}
}
