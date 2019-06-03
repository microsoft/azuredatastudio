/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ResourceType, ResourceTypeOption, DeploymentProvider } from '../interfaces';
import { IToolsService } from './toolsService';
import * as vscode from 'vscode';
import { IPlatformService } from './platformService';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export interface IResourceTypeService {
	getResourceTypes(filterByPlatform?: boolean): ResourceType[];
	validateResourceTypes(resourceTypes: ResourceType[]): string[];
}

export class ResourceTypeService implements IResourceTypeService {
	private _resourceTypes: ResourceType[] = [];

	constructor(private platformService: IPlatformService, private toolsService: IToolsService) { }

	/**
	 * Get the supported resource types
	 * @param filterByPlatform indicates whether to return the resource types supported on current platform.
	 */
	getResourceTypes(filterByPlatform: boolean = true): ResourceType[] {
		if (this._resourceTypes.length === 0) {
			const pkgJson = require('../../package.json');
			let extensionFullName: string;
			if (pkgJson && pkgJson.name && pkgJson.publisher) {
				extensionFullName = `${pkgJson.publisher}.${pkgJson.name}`;
			} else {
				const errorMessage = localize('resourceDeployment.extensionFullNameError', 'Could not find package.json or the name/publisher is not set');
				this.platformService.showErrorMessage(errorMessage);
				throw new Error(errorMessage);
			}

			// If we load package.json directly using require(path) the contents won't be localized
			this._resourceTypes = vscode.extensions.getExtension(extensionFullName)!.packageJSON.resourceTypes as ResourceType[];
			this._resourceTypes.forEach(resourceType => {
				resourceType.getProvider = (selectedOptions) => { return this.getProvider(resourceType, selectedOptions); };
			});
		}

		let resourceTypes = this._resourceTypes;
		if (filterByPlatform) {
			resourceTypes = resourceTypes.filter(resourceType => resourceType.platforms.includes(this.platformService.platform()));
		}

		return resourceTypes;
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
		if (!resourceType.icon || !resourceType.icon.dark || !resourceType.icon.light) {
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
				if (!provider.notebook) {
					errorMessages.push(`Notebook is not specified for the provider, ${providerPositionInfo}`);
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

			const expected = provider.when.replace(' ', '').split('&&').sort();
			let actual: string[] = [];
			selectedOptions.forEach(option => {
				actual.push(`${option.option}=${option.value}`);
			});
			actual = actual.sort();

			if (actual.length === expected.length) {
				let matches = true;
				for (let j = 0; j < actual.length; j++) {
					if (actual[j] !== expected[j]) {
						matches = false;
						break;
					}
				}
				if (matches) {
					return provider;
				}
			}
		}
		return undefined;
	}
}
