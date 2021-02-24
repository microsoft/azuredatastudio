/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createWriteStream, promises as fs } from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DeploymentProvider, instanceOfAzureSQLVMDeploymentProvider, instanceOfAzureSQLDBDeploymentProvider, instanceOfCommandDeploymentProvider, instanceOfDialogDeploymentProvider, instanceOfDownloadDeploymentProvider, instanceOfNotebookBasedDialogInfo, instanceOfNotebookDeploymentProvider, instanceOfNotebookWizardDeploymentProvider, instanceOfWebPageDeploymentProvider, instanceOfWizardDeploymentProvider, NotebookInfo, NotebookPathInfo, ResourceType, ResourceTypeOption, ResourceSubType, AgreementInfo, HelpText, InitialVariableValues } from '../interfaces';
import { AzdataService } from './azdataService';
import { KubeService } from './kubeService';
import { INotebookService } from './notebookService';
import { IPlatformService } from './platformService';
import { IToolsService } from './toolsService';
import * as loc from './../localizedConstants';
import { ResourceTypeWizard } from '../ui/resourceTypeWizard';
import { deepClone } from '../common/utils';

const localize = nls.loadMessageBundle();

/**
 * Used to filter the specific optionValues that the deployment wizard shows
 */
export interface OptionValuesFilter {
	[key: string]: Record<string, string[]>
}

export interface IResourceTypeService {
	getResourceTypes(filterByPlatform?: boolean): ResourceType[];
	validateResourceTypes(resourceTypes: ResourceType[]): string[];
	startDeployment(resourceType: ResourceType, optionValuesFilter?: OptionValuesFilter, initialVariableValues?: InitialVariableValues): void;
}

export class ResourceTypeService implements IResourceTypeService {
	private _resourceTypes: ResourceType[] = [];

	constructor(private platformService: IPlatformService, private toolsService: IToolsService, private notebookService: INotebookService) { }

	/**
	 * Get the supported resource types
	 * @param filterByPlatform indicates whether to return the resource types supported on current platform.
	 */
	getResourceTypes(filterByPlatform: boolean = true): ResourceType[] {
		if (this._resourceTypes.length === 0) {
			vscode.extensions.all.forEach((extension) => {
				const extensionResourceTypes = extension.packageJSON.contributes?.resourceDeploymentTypes as ResourceType[];
				extensionResourceTypes?.forEach((extensionResourceType: ResourceType) => {
					// Clone the object - we modify it by adding complex types and so if we modify the original contribution then
					// we can break VS Code functionality since it will sometimes pass this object over the RPC layer which requires
					// stringifying it - which can break with some of the complex types we add.
					const resourceType = deepClone(extensionResourceType);
					this.updatePathProperties(resourceType, extension.extensionPath);
					resourceType.getProvider = (selectedOptions) => { return this.getProvider(resourceType, selectedOptions); };
					resourceType.getOkButtonText = (selectedOptions) => { return this.getOkButtonText(resourceType, selectedOptions); };
					resourceType.getAgreementInfo = (selectedOptions) => { return this.getAgreementInfo(resourceType, selectedOptions); };
					resourceType.getHelpText = (selectedOptions) => { return this.getHelpText(resourceType, selectedOptions); };
					this.getResourceSubTypes(resourceType);
					this._resourceTypes.push(resourceType);
				});

			});
		}

		let resourceTypes = this._resourceTypes;
		if (filterByPlatform) {
			resourceTypes = resourceTypes.filter(resourceType => (typeof resourceType.platforms === 'string' && resourceType.platforms === '*') || resourceType.platforms.includes(this.platformService.platform()));
		}

		return resourceTypes;
	}

	private updatePathProperties(resourceType: ResourceType, extensionPath: string): void {
		if (typeof resourceType.icon === 'string') {
			resourceType.icon = path.join(extensionPath, resourceType.icon);
		} else {
			resourceType.icon.dark = path.join(extensionPath, resourceType.icon.dark);
			resourceType.icon.light = path.join(extensionPath, resourceType.icon.light);
		}
		resourceType.providers.forEach((provider) => {
			this.updateProviderPathProperties(provider, extensionPath);
		});
	}

	private updateProviderPathProperties(provider: DeploymentProvider, extensionPath: string): void {
		if (instanceOfNotebookDeploymentProvider(provider)) {
			this.updateNotebookPath(provider, extensionPath);
		} else if (instanceOfDialogDeploymentProvider(provider) && instanceOfNotebookBasedDialogInfo(provider.dialog)) {
			this.updateNotebookPath(provider.dialog, extensionPath);
		}
		else if ('bdcWizard' in provider) {
			this.updateNotebookPath(provider.bdcWizard, extensionPath);
		}
		else if ('notebookWizard' in provider) {
			this.updateNotebookPath(provider.notebookWizard, extensionPath);
		}
		else if ('azureSQLVMWizard' in provider) {
			this.updateNotebookPath(provider.azureSQLVMWizard, extensionPath);
		}
		else if ('azureSQLDBWizard' in provider) {
			this.updateNotebookPath(provider.azureSQLDBWizard, extensionPath);
		}
	}

	private updateNotebookPath(objWithNotebookProperty: { notebook: string | NotebookPathInfo | NotebookInfo[] } | undefined, extensionPath: string): void {
		if (objWithNotebookProperty && objWithNotebookProperty.notebook) {
			if (typeof objWithNotebookProperty.notebook === 'string') {
				objWithNotebookProperty.notebook = path.join(extensionPath, objWithNotebookProperty.notebook);
			} else if (Array.isArray(objWithNotebookProperty.notebook)) {
				objWithNotebookProperty.notebook.forEach(nb => {
					nb.path = path.join(extensionPath, nb.path);
				});
			} else {
				if (objWithNotebookProperty.notebook.darwin) {
					objWithNotebookProperty.notebook.darwin = path.join(extensionPath, objWithNotebookProperty.notebook.darwin);
				}
				if (objWithNotebookProperty.notebook.win32) {
					objWithNotebookProperty.notebook.darwin = path.join(extensionPath, objWithNotebookProperty.notebook.win32);
				}
				if (objWithNotebookProperty.notebook.linux) {
					objWithNotebookProperty.notebook = path.join(extensionPath, objWithNotebookProperty.notebook.linux);
				}
			}
		}
	}

	private getResourceSubTypes(resourceType: ResourceType): void {
		const resourceSubTypes: ResourceSubType[] = [];
		vscode.extensions.all.forEach((extension) => {
			const extensionResourceSubTypes = extension.packageJSON.contributes?.resourceDeploymentSubTypes as ResourceSubType[];
			extensionResourceSubTypes?.forEach((extensionResourceSubType: ResourceSubType) => {
				const resourceSubType = deepClone(extensionResourceSubType);
				if (resourceSubType.resourceName === resourceType.name) {
					this.updateProviderPathProperties(resourceSubType.provider, extension.extensionPath);
					resourceSubTypes.push(resourceSubType);
					const tagSet = new Set(resourceType.tags);
					resourceSubType.tags?.forEach(tag => tagSet.add(tag));
					resourceType.tags = Array.from(tagSet);
					resourceType.providers.push(resourceSubType.provider);
					if (resourceSubType.okButtonText) {
						resourceType.okButtonText?.push(resourceSubType.okButtonText!);
					}
					if (resourceSubType.options) {
						resourceType.options.forEach((roption) => {
							resourceSubType.options.forEach((soption) => {
								if (roption.name === soption.name) {
									roption.values = roption.values.concat(soption.values);
								}
							});
						});
					}
					if (resourceSubType.agreement) {
						resourceType.agreements?.push(resourceSubType.agreement!);
					}
					if (resourceSubType.helpText) {
						resourceType.helpTexts.push(resourceSubType.helpText);
					}
				}
			});
		});
	}

	/**
	 * Validate the resource types and returns validation error messages if any.
	 * @param resourceTypes resource types to be validated
	 */
	validateResourceTypes(resourceTypes: ResourceType[]): string[] {
		// NOTE: The validation error messages do not need to be localized as it is only meant for the developer's use.
		const errorMessages: string[] = [];
		if (!resourceTypes || resourceTypes.length === 0) {
			errorMessages.push('Resource type list is empty');
		} else {
			let resourceTypeIndex = 1;
			resourceTypes.forEach(resourceType => {
				this.validateResourceType(resourceType, `resource type index: ${resourceTypeIndex}`, errorMessages);
				resourceTypeIndex++;
			});
		}

		return errorMessages;
	}

	private validateResourceType(resourceType: ResourceType, positionInfo: string, errorMessages: string[]): void {
		this.validateNameDisplayName(resourceType, 'resource type', positionInfo, errorMessages);
		if (!resourceType.icon || (typeof resourceType.icon === 'object' && (!resourceType.icon.dark || !resourceType.icon.light))) {
			errorMessages.push(`Icon for resource type is not specified properly. ${positionInfo} `);
		}

		if (resourceType.options && resourceType.options.length > 0) {
			let optionIndex = 1;
			resourceType.options.forEach(option => {
				const optionInfo = `${positionInfo}, option index: ${optionIndex} `;
				this.validateResourceTypeOption(option, optionInfo, errorMessages);
				optionIndex++;
			});
		}

		this.validateProviders(resourceType, positionInfo, errorMessages);
	}

	private validateResourceTypeOption(option: ResourceTypeOption, positionInfo: string, errorMessages: string[]): void {
		this.validateNameDisplayName(option, 'option', positionInfo, errorMessages);
		if (!option.values || option.values.length === 0) {
			errorMessages.push(`Option contains no values.${positionInfo} `);
		} else {
			let optionValueIndex = 1;
			option.values.forEach(optionValue => {
				const optionValueInfo = `${positionInfo}, option value index: ${optionValueIndex} `;
				this.validateNameDisplayName(optionValue, 'option value', optionValueInfo, errorMessages);
				optionValueIndex++;
			});

			// Make sure the values are unique
			for (let i = 0; i < option.values.length; i++) {
				if (option.values[i].name && option.values[i].displayName) {
					let dupePositions = [];
					for (let j = i + 1; j < option.values.length; j++) {
						if (option.values[i].name === option.values[j].name
							|| option.values[i].displayName === option.values[j].displayName) {
							// +1 to make the position 1 based.
							dupePositions.push(j + 1);
						}
					}

					if (dupePositions.length !== 0) {
						errorMessages.push(`Option values with same name or display name are found at the following positions: ${i + 1}, ${dupePositions.join(',')}.${positionInfo} `);
						errorMessages.push(JSON.stringify(option));
					}
				}
			}
		}
	}

	private validateProviders(resourceType: ResourceType, positionInfo: string, errorMessages: string[]): void {
		if (!resourceType.providers || resourceType.providers.length === 0) {
			errorMessages.push(`No providers defined for resource type, ${positionInfo}`);
		} else {
			let providerIndex = 1;
			resourceType.providers.forEach(provider => {
				const providerPositionInfo = `${positionInfo}, provider index: ${providerIndex} `;
				if (!instanceOfWizardDeploymentProvider(provider)
					&& !instanceOfNotebookWizardDeploymentProvider(provider)
					&& !instanceOfDialogDeploymentProvider(provider)
					&& !instanceOfNotebookDeploymentProvider(provider)
					&& !instanceOfDownloadDeploymentProvider(provider)
					&& !instanceOfWebPageDeploymentProvider(provider)
					&& !instanceOfCommandDeploymentProvider(provider)
					&& !instanceOfAzureSQLVMDeploymentProvider(provider)
					&& !instanceOfAzureSQLDBDeploymentProvider(provider)) {
					errorMessages.push(`No deployment method defined for the provider, ${providerPositionInfo}`);
				}

				if (provider.requiredTools && provider.requiredTools.length > 0) {
					provider.requiredTools.forEach(tool => {
						if (!this.toolsService.getToolByName(tool.name)) {
							errorMessages.push(`The tool is not supported: ${tool.name}, ${providerPositionInfo} `);
						}
					});
				}
				providerIndex++;
			});
		}
	}

	private validateNameDisplayName(obj: { name: string; displayName: string }, type: string, positionInfo: string, errorMessages: string[]): void {
		if (!obj.name) {
			errorMessages.push(`Name of the ${type} is empty.${positionInfo} `);
		}
		if (!obj.displayName) {
			errorMessages.push(`Display name of the ${type} is empty.${positionInfo} `);
		}
	}

	/**
	 * Get the provider based on the selected options
	 */
	private getProvider(resourceType: ResourceType, selectedOptions: { option: string, value: string }[]): DeploymentProvider | undefined {
		for (let i = 0; i < resourceType.providers.length; i++) {
			const provider = resourceType.providers[i];
			if (processWhenClause(provider.when, selectedOptions)) {
				return provider;
			}
		}
		return undefined;
	}

	/**
	 * Get the ok button text based on the selected options
	 */
	private getOkButtonText(resourceType: ResourceType, selectedOptions: { option: string, value: string }[]): string | undefined {
		if (resourceType.okButtonText) {
			for (const possibleOption of resourceType.okButtonText) {
				if (processWhenClause(possibleOption.when, selectedOptions)) {
					return possibleOption.value;
				}
			}
		}
		return loc.select;
	}

	private getAgreementInfo(resourceType: ResourceType, selectedOptions: { option: string, value: string }[]): AgreementInfo | undefined {
		if (resourceType.agreements) {
			for (const possibleOption of resourceType.agreements) {
				if (processWhenClause(possibleOption.when, selectedOptions)) {
					return possibleOption;
				}
			}
		}
		return undefined;
	}

	private getHelpText(resourceType: ResourceType, selectedOptions: { option: string, value: string }[]): HelpText | undefined {
		if (resourceType.helpTexts) {
			for (const possibleOption of resourceType.helpTexts) {
				if (processWhenClause(possibleOption.when, selectedOptions)) {
					return possibleOption;
				}
			}
		}
		return undefined;
	}

	public startDeployment(resourceType: ResourceType, optionValuesFilter?: OptionValuesFilter, initialVariableValues?: InitialVariableValues): void {
		const wizard = new ResourceTypeWizard(resourceType, new KubeService(), new AzdataService(this.platformService), this.notebookService, this.toolsService, this.platformService, this, optionValuesFilter, initialVariableValues);
		wizard.open();
	}

	public download(url: string): Promise<string> {
		const self = this;
		const promise = new Promise<string>((resolve, reject) => {
			https.get(url, async function (response) {
				console.log('Download installer from: ' + url);
				if (response.statusCode === 301 || response.statusCode === 302) {
					// Redirect and download from new location
					console.log('Redirecting the download to: ' + response.headers.location);
					self.download(response.headers.location!).then((result) => {
						resolve(result);
					}, (err) => {
						reject(err);
					});
					return;
				}
				if (response.statusCode !== 200) {
					reject(localize('downloadError', "Download failed, status code: {0}, message: {1}", response.statusCode, response.statusMessage));
					return;
				}
				const extension = path.extname(url);
				const originalFileName = path.basename(url, extension);
				let fileName = originalFileName;
				// Download it to the user's downloads folder
				// and fall back to the user's homedir if it does not exist.
				let downloadFolder = path.join(os.homedir(), 'Downloads');
				if (!await exists(downloadFolder)) {
					downloadFolder = os.homedir();
				}
				let cnt = 1;
				while (await exists(path.join(downloadFolder, fileName + extension))) {
					fileName = `${originalFileName}-${cnt}`;
					cnt++;
				}
				fileName = path.join(downloadFolder, fileName + extension);
				const file = createWriteStream(fileName);
				response.pipe(file);
				file.on('finish', () => {
					file.close();
					resolve(fileName);
				});
				file.on('error', async (err) => {
					await fs.unlink(fileName);
					reject(err.message);
				});
			});
		});
		return promise;
	}

}

async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * processWhenClause takes in a when clause (either the word 'true' or a series of clauses in the format:
 * '<type_name>=<value_name>' joined by '&&').
 * If the when clause is true or undefined, return true as there is no clause to check.
 * It evaluates each individual when clause by comparing the equivalent selected options (sorted in alphabetical order and formatted to match).
 * If there is any selected option that doesn't match, return false.
 * Return true if all clauses match.
 */
export function processWhenClause(when: string | undefined, selectedOptions: { option: string, value: string }[]): boolean {
	if (when === undefined || when.toString().toLowerCase() === 'true') {
		return true;
	} else {
		const expected = when.replace(/\s/g, '').split('&&').sort();
		const actual = selectedOptions.map(option => `${option.option}=${option.value}`);
		for (let whenClause of expected) {
			if (actual.indexOf(whenClause) === -1) {
				return false;
			}
		}
		return true;
	}
}
