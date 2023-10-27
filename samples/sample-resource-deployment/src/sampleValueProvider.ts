/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rd from 'resource-deployment';

/**
 * This is a sample value provider used to demonstrate how values are received and can be used to generate the return value.
 */
export class SampleValueProvider implements rd.IValueProvider {
	/**
	 * This ID corresponds to the `providerId` property in the `valueProvider` properties of the package.json definitions.
	 */
	readonly id = 'sample-resource-deployment.sample-value-provider';

	/**
	 *
	 * @param triggerValues This is an object whose keys correspond to the `variableName` (or `label` if no `variableName` is given) property of the trigger fields.
	 * This will contain an entry for every trigger field defined in the `valueProvider` property on the target field - even if those values are empty/undefined.
	 * @returns The calculated input type to return. This is expected to match the type of the target field (so string for text, boolean for checkbox, etc)
	 */
	public async getValue(triggerValues: { [key: string]: rd.InputValueType; }): Promise<rd.InputValueType> {
		Object.values(triggerValues)
		// Because this example is used by two different fields we have logic here to handle determining which one it came from.
		// If you are making a generic provider that you don't want to have know about each field that uses it you can use
		// Object.values(triggerValues) to get the array of values and operate on those directly.
		if (triggerValues['AZDATA_NB_VAR_SAMPLE_VALUE_PROVIDER_MULTIPLE_PLACE'] !== undefined) {
			return `Hello ${triggerValues['AZDATA_NB_VAR_SAMPLE_VALUE_PROVIDER_MULTIPLE_NAME']} from ${triggerValues['AZDATA_NB_VAR_SAMPLE_VALUE_PROVIDER_MULTIPLE_PLACE']}!`;
		} else {
			return `Hello ${triggerValues['AZDATA_NB_VAR_SAMPLE_VALUE_PROVIDER_SINGLE_NAME']}!`;
		}
	}
}
