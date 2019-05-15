/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ResourceType, ResourceTypeOption } from './interfaces';
import { ToolService } from './toolsService';

/**
 * Get the supported resource types
 */
export function getResourceTypes(): ResourceType[] {
	let pkgJson = require('../package.json') as { resourceTypes: ResourceType[] };
	return pkgJson.resourceTypes;
}

/**
 * Validate the resource types and returns validation error messages if any.
 * @param resourceTypes resource types to be validated
 */
export function validateResourceTypes(resourceTypes: ResourceType[]): string[] {
	const errorMessages: string[] = [];
	if (!resourceTypes || resourceTypes.length === 0) {
		errorMessages.push('Resource type list is empty');
	} else {
		let resourceTypeIndex = 1;
		resourceTypes.forEach(resourceType => {
			validateResourceType(resourceType, `resource type index: ${resourceTypeIndex}`, errorMessages);
			resourceTypeIndex++;
		});
	}

	return errorMessages;
}

function validateResourceType(resourceType: ResourceType, positionInfo: string, errorMessages: string[]): void {
	validateNameDisplayName(resourceType, 'resource type', positionInfo, errorMessages);
	if (!resourceType.icon || !resourceType.icon.dark || !resourceType.icon.light) {
		errorMessages.push(`Icon for resource type is not specified properly. ${positionInfo}`);
	}

	if (resourceType.options && resourceType.options.length > 0) {
		let optionIndex = 1;
		resourceType.options.forEach(option => {
			const optionInfo = `${positionInfo}, option index: ${optionIndex}`;
			validateResourceTypeOption(option, optionInfo, errorMessages);
			optionIndex++;
		});
	}

	validateProviders(resourceType, positionInfo, errorMessages);
}

function validateResourceTypeOption(option: ResourceTypeOption, positionInfo: string, errorMessages: string[]): void {
	validateNameDisplayName(option, 'option', positionInfo, errorMessages);
	if (!option.values || option.values.length === 0) {
		errorMessages.push(`Option contains no values. ${positionInfo}`);
	} else {
		let optionValueIndex = 1;
		option.values.forEach(optionValue => {
			const optionValueInfo = `${positionInfo}, option value index: ${optionValueIndex}`;
			validateNameDisplayName(optionValue, 'option value', optionValueInfo, errorMessages);
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
					errorMessages.push(`option values with same name or display name are found at the following positions: ${i + 1}, ${dupePositions.join(',')}. ${positionInfo}`);
				}
			}
		}
	}
}

function validateProviders(resourceType: ResourceType, positionInfo: string, errorMessages: string[]): void {
	if (!resourceType.providers || resourceType.providers.length === 0) {
		errorMessages.push(`no providers defined for resource type, ${positionInfo}`);
	} else {
		let providerIndex = 1;
		resourceType.providers.forEach(provider => {
			const providerPositionInfo = `${positionInfo}, provider index: ${providerIndex}`;
			if (!provider.notebook) {
				errorMessages.push(`notebook is not specified for the provider, ${providerPositionInfo}`);
			}

			if (provider.requiredTools && provider.requiredTools.length > 0) {
				provider.requiredTools.forEach(tool => {
					if (!ToolService.getTool(tool.name)) {
						errorMessages.push(`the required tool is not supported: ${tool}, ${providerPositionInfo}`);
					}
				});
			}
			providerIndex++;
		});
	}
}

function validateNameDisplayName(obj: { name: string; displayName: string }, type: string, positionInfo: string, errorMessages: string[]): void {
	if (!obj.name) {
		errorMessages.push(`Name of the ${type} is empty. ${positionInfo}`);
	}
	if (!obj.displayName) {
		errorMessages.push(`Display name of the ${type} is empty. ${positionInfo}`);
	}
}
