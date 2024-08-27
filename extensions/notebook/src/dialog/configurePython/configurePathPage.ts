/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { BasePage } from './basePage';
import * as nls from 'vscode-nls';
import * as utils from '../../common/utils';

const localize = nls.loadMessageBundle();

export class ConfigurePathPage extends BasePage {
	private readonly BrowseButtonText = localize('configurePython.browseButtonText', "Browse");
	private readonly SelectFileLabel = localize('configurePython.selectFileLabel', "Select");

	private pythonLocationDropdown: azdata.DropDownComponent;
	private pythonDropdownLoader: azdata.LoadingComponent;

	private usingCustomPath = false;
	private noPathsFound = false;

	public async initialize(): Promise<boolean> {
		let wizardDescription: string;
		if (this.model.kernelName) {
			wizardDescription = localize('configurePython.descriptionWithKernel', "The '{0}' kernel requires a Python runtime to be configured and dependencies to be installed.", this.model.kernelName);
		} else {
			wizardDescription = localize('configurePython.descriptionWithoutKernel', "Notebook kernels require a Python runtime to be configured and dependencies to be installed.");
		}
		let wizardDescriptionLabel = this.view.modelBuilder.text()
			.withProps({
				value: wizardDescription,
				CSSStyles: {
					'padding': '0px',
					'margin': '0px'
				}
			}).component();

		this.pythonLocationDropdown = this.view.modelBuilder.dropDown()
			.withProps({
				value: undefined,
				values: [],
				width: '400px'
			}).component();
		this.pythonDropdownLoader = this.view.modelBuilder.loadingComponent()
			.withItem(this.pythonLocationDropdown)
			.withProps({
				loading: true
			})
			.component();
		let browseButton = this.view.modelBuilder.button()
			.withProps({
				label: this.BrowseButtonText,
				width: '70px',
				secondary: true
			}).component();
		browseButton.onDidClick(() => this.handleBrowse());

		let selectInstallForm = this.view.modelBuilder.formContainer()
			.withFormItems([{
				component: this.pythonDropdownLoader,
				title: localize('configurePython.locationTextBoxText', "Python Location")
			}, {
				component: browseButton,
				title: ''
			}]).component();
		let selectInstallContainer = this.view.modelBuilder.divContainer()
			.withItems([selectInstallForm])
			.withProps({
				clickable: false
			}).component();

		let parentContainer = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' }).component();
		parentContainer.addItem(wizardDescriptionLabel, {
			CSSStyles: {
				'padding': '0px 30px 0px 30px'
			}
		});
		parentContainer.addItem(selectInstallContainer);

		await this.view.initializeModel(parentContainer);
		await this.updatePythonPathsDropdown();

		return true;
	}

	public async onPageEnter(): Promise<void> {
	}

	public async onPageLeave(): Promise<boolean> {
		if (this.pythonDropdownLoader.loading) {
			return false;
		}

		let pythonLocation = utils.getDropdownValue(this.pythonLocationDropdown);
		if (!pythonLocation || pythonLocation.length === 0) {
			this.instance.showErrorMessage(this.instance.InvalidLocationMsg);
			return false;
		}

		this.model.pythonLocation = pythonLocation;
		return true;
	}

	private async updatePythonPathsDropdown(): Promise<void> {
		this.instance.wizard.nextButton.enabled = false;
		this.pythonDropdownLoader.loading = true;
		try {
			let dropdownValues: azdata.CategoryValue[];
			let pythonPaths = await this.model.pythonPathLookup.getSuggestions();
			if (pythonPaths?.length > 0) {
				dropdownValues = pythonPaths.map(path => {
					return {
						displayName: localize('configurePythyon.dropdownPathLabel', "{0} (Python {1})", path.installDir, path.version),
						name: path.installDir
					};
				});
				this.noPathsFound = false;
			} else {
				dropdownValues = [];
			}

			if (this.model.pythonLocation) {
				// Filter out other matching path entries if they're already present
				dropdownValues = dropdownValues.filter(val => val.name !== this.model.pythonLocation);
				dropdownValues.unshift({
					displayName: localize('configurePythyon.existingInstance', "{0} (Current Python Instance)", this.model.pythonLocation),
					name: this.model.pythonLocation
				});
				this.noPathsFound = false;
			} else if (dropdownValues.length === 0) {
				dropdownValues = [{
					displayName: localize('configurePythyon.noVersionsFound', "No supported Python versions found."),
					name: ''
				}];
				this.noPathsFound = true;
			}

			this.usingCustomPath = false;
			await this.pythonLocationDropdown.updateProperties({
				value: dropdownValues[0],
				values: dropdownValues
			});
		} finally {
			this.instance.wizard.nextButton.enabled = true;
			this.pythonDropdownLoader.loading = false;
		}
	}

	private async handleBrowse(): Promise<void> {
		let options: vscode.OpenDialogOptions = {
			defaultUri: vscode.Uri.file(utils.getUserHome()),
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: this.SelectFileLabel
		};

		let fileUris: vscode.Uri[] = await vscode.window.showOpenDialog(options);
		if (fileUris?.length > 0 && fileUris[0]) {
			let existingValues = <azdata.CategoryValue[]>this.pythonLocationDropdown.values;
			let filePath = fileUris[0].fsPath;
			let newValue = {
				displayName: localize('configurePythyon.customPathLabel', "{0} (Custom)", filePath),
				name: filePath
			};

			if (this.usingCustomPath) {
				existingValues[0] = newValue;
			} else {
				if (this.noPathsFound) {
					// Replace "No paths found" placeholder
					existingValues[0] = newValue;
				} else {
					existingValues.unshift(newValue);
				}
				this.usingCustomPath = true;
			}

			await this.pythonLocationDropdown.updateProperties({
				value: existingValues[0],
				values: existingValues
			});
		}
	}
}
