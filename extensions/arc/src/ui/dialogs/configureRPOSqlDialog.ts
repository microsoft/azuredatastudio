/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import { cssStyles } from '../../constants';
import { InitializingComponent } from '../components/initializingComponent';
import { MiaaModel } from '../../models/miaaModel';

export class ConfigureRPOSqlDialog extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;

	protected rpoInputBox!: azdata.InputBoxComponent;
	protected retentionDaysSlider!: azdata.SliderComponent;

	protected _completionPromise = new Deferred<string | undefined>();

	constructor(protected _model: MiaaModel) {
		super();
	}

	public showDialog(dialogTitle: string): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(dialogTitle);
		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;
			this.rpoInputBox = this.modelBuilder.inputBox()
				.withProps({
					readOnly: false,
					min: 5,
					max: 10,
					inputType: 'number',
					ariaLabel: loc.rpo
				}).component();
			this.retentionDaysSlider = this.modelBuilder.slider()
				.withProps({
					min: 1,
					max: 35,
					step: 1,
					showTicks: true,
					ariaLabel: loc.rd
				}).component();

			const info = this.modelBuilder.text().withProps({
				value: loc.pitrInfo,
				CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
			}).component();

			const link = this.modelBuilder.hyperlink().withProps({
				label: loc.learnMore,
				url: '',
			}).component();

			const infoAndLink = this.modelBuilder.flexContainer().withLayout({ flexWrap: 'wrap' }).component();
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
							required: true
						},
						{
							component: this.retentionDaysSlider,
							title: loc.rd,
							required: true
						}
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.rpoInputBox.focus();
			this.retentionDaysSlider.focus();
			this.initialized = true;
		});

		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.label = loc.apply;
		dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async validate(): Promise<boolean> {
		this._completionPromise.resolve(this.rpoInputBox.value?.toString());
		this._completionPromise.resolve(this.retentionDaysSlider.value?.toString());
		return true;
	}

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<string | undefined> {
		return this._completionPromise.promise;
	}
}
