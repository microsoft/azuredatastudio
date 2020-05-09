/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';

import { SubFieldInfo, FieldType, FontWeight, LabelPosition, SectionInfo } from '../../interfaces';
import { createSection, DefaultInputWidth, DefaultLabelWidth, DefaultRowAlignItems, DefaultRowWidth, DefaultRowHeight } from '../modelViewUtils';
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

	public onLeave() {
		this.wizard.wizardObject.message = { text: '' };
	}

	public onEnter() {
		this.formItems.forEach(item => {
			this.form!.removeFormItem(item);
		});
		this.formItems = [];

		const rowWidth = this.pageInfo.rowWidth || this.wizard.wizardInfo.rowWidth || DefaultRowWidth;
		const rowHeight = this.pageInfo.rowHeight || this.wizard.wizardInfo.rowHeight || DefaultRowHeight;
		const rowAlignItems = this.pageInfo.rowAlignItems || this.wizard.wizardInfo.rowAlignItems || DefaultRowAlignItems;
		const labelWidth = this.pageInfo.labelWidth || this.wizard.wizardInfo.labelWidth || DefaultLabelWidth;
		const labelPosition = this.pageInfo.labelPosition || this.wizard.wizardInfo.labelPosition || LabelPosition.Left;
		const inputWidth = this.pageInfo.inputWidth || this.wizard.wizardInfo.inputWidth || DefaultInputWidth;

		this.wizard.wizardInfo.pages.filter((undefined, index) => index < this._pageIndex).forEach(pageInfo => {
			const summarySectionInfo: SectionInfo = {
				labelPosition: labelPosition,
				labelWidth: labelWidth,
				inputWidth: inputWidth,
				rowWidth: rowWidth,
				rowHeight: rowHeight,
				rowAlignItems: rowAlignItems,
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
				labelCSSStyles: { fontWeight: FontWeight.Bold }
			}]
		});
	}
}
