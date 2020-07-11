/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';

import { SubFieldInfo, FieldType, FontWeight, LabelPosition, SectionInfo } from '../../interfaces';
import { createSection, DefaultInputWidth, DefaultLabelWidth, DefaultFieldAlignItems, DefaultFieldWidth, DefaultFieldHeight } from '../modelViewUtils';
import { NotebookWizard } from './notebookWizard';
import { NotebookWizardPage } from './notebookWizardPage';

const localize = nls.loadMessageBundle();

export class NotebookWizardAutoSummaryPage extends NotebookWizardPage {
	private formItems: azdata.FormComponent[] = [];
	private form!: azdata.FormBuilder;
	private view!: azdata.ModelView;

	constructor(wizard: NotebookWizard, _pageIndex: number) {
		super(wizard,
			_pageIndex,
			wizard.wizardInfo.pages[_pageIndex].title || localize('notebookWizard.autoSummaryPageTitle', "Review your configuration"),
			wizard.wizardInfo.pages[_pageIndex].description || ''
		);
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			this.view = view;
			this.form = view.modelBuilder.formContainer();
			return view.initializeModel(this.form!.withLayout({ width: '100%' }).component());
		});
	}

	public onLeave(): void {
		this.wizard.wizardObject.message = { text: '' };
	}

	public async onEnter(): Promise<void> {
		this.formItems.forEach(item => {
			this.form!.removeFormItem(item);
		});
		this.formItems = [];

		const fieldWidth = this.pageInfo.fieldWidth || this.wizard.wizardInfo.fieldWidth || DefaultFieldWidth;
		const fieldHeight = this.pageInfo.fieldHeight || this.wizard.wizardInfo.fieldHeight || DefaultFieldHeight;
		const fieldAlignItems = this.pageInfo.fieldAlignItems || this.wizard.wizardInfo.fieldAlignItems || DefaultFieldAlignItems;
		const labelWidth = this.pageInfo.labelWidth || this.wizard.wizardInfo.labelWidth || DefaultLabelWidth;
		const labelPosition = this.pageInfo.labelPosition || this.wizard.wizardInfo.labelPosition || LabelPosition.Left;
		const inputWidth = this.pageInfo.inputWidth || this.wizard.wizardInfo.inputWidth || DefaultInputWidth;

		const filteredPages = this.wizard.wizardInfo.pages.filter((undefined, index) => index < this._pageIndex);
		for (const pageInfo of filteredPages) {
			const summarySectionInfo: SectionInfo = {
				labelPosition: labelPosition,
				labelWidth: labelWidth,
				inputWidth: inputWidth,
				fieldWidth: fieldWidth,
				fieldHeight: fieldHeight,
				fieldAlignItems: fieldAlignItems,
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
					component: await createSection({
						container: this.wizard.wizardObject,
						inputComponents: this.wizard.inputComponents,
						sectionInfo: summarySectionInfo,
						view: this.view,
						onNewDisposableCreated: () => { },
						onNewInputComponentCreated: () => { },
						onNewValidatorCreated: () => { }
					})
				};
				this.formItems.push(formComponent);
			}
		}
		this.form.addFormItems(this.formItems);

	}

	private addSummaryForVariable(summarySectionInfo: SectionInfo, fieldInfo: SubFieldInfo) {
		summarySectionInfo!.rows!.push({
			items: [{
				type: FieldType.ReadonlyText,
				label: fieldInfo.label,
				defaultValue: this.wizard.model.getStringValue(fieldInfo.variableName!),
				labelCSSStyles: { fontWeight: FontWeight.Bold }
			}]
		});
	}
}
