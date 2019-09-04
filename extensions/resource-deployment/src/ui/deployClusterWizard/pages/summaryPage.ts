/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { createSection } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import { ClusterName_VariableName } from '../constants';
const localize = nls.loadMessageBundle();

export class SummaryPage extends WizardPageBase<DeployClusterWizard> {
	private formItems: azdata.FormComponent[] = [];
	private form: azdata.FormBuilder | undefined;
	private view: azdata.ModelView | undefined;
	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.summaryPageTitle', "Summary"), '', wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			this.view = view;
			this.form = view.modelBuilder.formContainer().withFormItems([]);
			return view.initializeModel(this.form!.withLayout({ width: '100%' }).component());
		});
	}

	onEnter() {
		this.formItems.forEach(item => {
			this.form!.removeFormItem(item);
		});
		this.formItems = [];
		const basicSection: SectionInfo = {
			labelOnLeft: true,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.ClusterInformationSection', "Cluster information"),
			rows: [
				{
					fields: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.ClusterNameField', "Cluster name"),
							required: false,
							variableName: '',
							defaultValue: this.wizard.model[ClusterName_VariableName],
						}
					]
				}
			]
		};
		const clusterSection = {
			title: '',
			component: createSection({
				container: this.wizard.wizardObject,
				sectionInfo: basicSection,
				view: this.view!,
				onNewDisposableCreated: () => { },
				onNewInputComponentCreated: () => { },
				onNewValidatorCreated: () => { }
			})
		};

		this.formItems.push(clusterSection);
		this.form!.addFormItem(clusterSection);
	}
}
