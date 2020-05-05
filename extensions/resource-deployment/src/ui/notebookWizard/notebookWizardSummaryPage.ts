/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';

import { SubFieldInfo, FieldType, FontWeight, LabelPosition, SectionInfo } from '../../interfaces';
import { createSection, DefaultInputComponentWidth, DefaultLabelComponentWidth } from '../modelViewUtils';
import { WizardPageBase } from '../wizardPageBase';
import { NotebookWizard } from './notebookWizard';

const localize = nls.loadMessageBundle();

export class NotebookWizardSummaryPage extends WizardPageBase<NotebookWizard> {
	private formItems: azdata.FormComponent[] = [];
	private form!: azdata.FormBuilder;
	private view!: azdata.ModelView;

	constructor(wizard: NotebookWizard) {
		super(localize('notebookWizard.summaryPageTitle', "Review your configuration"), '', wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			this.view = view;
			this.form = view.modelBuilder.formContainer();
			return view.initializeModel(this.form!.withLayout({ width: '100%' }).component());
		});
	}

	public onLeave() {
		this.wizard.wizardObject.message = { text: '' };
	}

	public onEnter() {
		this.formItems.forEach(item => {
			this.form!.removeFormItem(item);
		});
		this.formItems = [];

		const inputWidth = this.wizard.wizardInfo.inputWidth || (this.wizard.wizardInfo.summaryPage && this.wizard.wizardInfo.summaryPage.inputWidth) || DefaultInputComponentWidth;
		const labelWidth = this.wizard.wizardInfo.labelWidth || (this.wizard.wizardInfo.summaryPage && this.wizard.wizardInfo.summaryPage.labelWidth) || DefaultLabelComponentWidth;
		const labelPosition = this.wizard.wizardInfo.labelPosition || (this.wizard.wizardInfo.summaryPage && this.wizard.wizardInfo.summaryPage.labelPosition) || LabelPosition.Left;

		this.wizard.wizardInfo.pages.forEach(pageInfo => {
			const summarySectionInfo: SectionInfo = {
				labelPosition: labelPosition,
				labelWidth: labelWidth,
				inputWidth: inputWidth,
				title: '',
				rows: []
			};
			pageInfo.sections.forEach(sectionInfo => {
				sectionInfo.fields!.forEach(fieldInfo => {
					if (fieldInfo.variableName) {
						this.addSummaryForVariable(summarySectionInfo, fieldInfo);
					}
					if (fieldInfo.subFields) {
						fieldInfo.subFields.forEach(subFieldInfo => {
							this.addSummaryForVariable(summarySectionInfo, subFieldInfo);
						});
					}
				});
			});
			if (summarySectionInfo!.rows!.length > 0) {
				const formComponent: azdata.FormComponent = {
					title: pageInfo.title,
					component: createSection({
						container: this.wizard.wizardObject,
						sectionInfo: summarySectionInfo,
						view: this.view,
						onNewDisposableCreated: () => { },
						onNewInputComponentCreated: () => { },
						onNewValidatorCreated: () => { }
					})
				};
				this.formItems.push(formComponent);
			}
		});
		this.form.addFormItems(this.formItems);

	}

	private addSummaryForVariable(summarySectionInfo: SectionInfo, fieldInfo: SubFieldInfo) {
		summarySectionInfo!.rows!.push({
			fields: [{
				type: FieldType.ReadonlyText,
				label: fieldInfo.label,
				defaultValue: this.wizard.model.getStringValue(fieldInfo.variableName!),
				labelFontWeight: FontWeight.Bold
			}]
		});
	}
}
