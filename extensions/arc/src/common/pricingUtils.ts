/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputValueType } from 'resource-deployment';
import * as loc from '../localizedConstants';

export const SqlManagedInstanceGeneralPurpose = {
	tierName: loc.generalPurposeLabel,
	basePricePerCore: 80,
	licenseIncludedPricePerCore: 153,
	maxMemorySize: 128,
	maxVCores: 24,
	replicaOptions: [
		{
			text: loc.replicaOne,
			value: 1,
		}
	],
	defaultReplicaValue: 1
};

const SqlManagedInstanceBusinessCritical = {
	tierName: loc.businessCriticalLabel,
	basePricePerCore: 160,
	licenseIncludedPricePerCore: 434,
	replicaOptions: [
		{
			text: loc.replicaTwo,
			value: 2,
		},
		{
			text: loc.replicaThree,
			value: 3,
		}
	],
	defaultReplicaValue: 3
};

export const SqlManagedInstancePricingLink: string = 'https://aka.ms/ArcSQLBilling';

export const serviceTierVarName = 'AZDATA_NB_VAR_SQL_SERVICE_TIER';
export const devUseVarName = 'AZDATA_NB_VAR_SQL_DEV_USE';
export const vcoresLimitVarName = 'AZDATA_NB_VAR_SQL_CORES_LIMIT';
export const licenseTypeVarName = 'AZDATA_NB_VAR_SQL_LICENSE_TYPE';
export const readableSecondaries = 'AZDATA_NB_VAR_SQL_READABLE_SECONDARIES';

// Gets number of replicas charged
export function numBillableReplicas(mapping: { [key: string]: InputValueType }): number {
	return 1 + Math.max(0, <number>mapping[readableSecondaries] - 1);
}

// Estimated base price for one vCore.
export function estimatedBasePriceForOneVCore(mapping: { [key: string]: InputValueType }): number {
	let price = 0;
	if (mapping[devUseVarName] === 'true') {
		price = 0;
	} else if (mapping[devUseVarName] === 'false') {
		if (mapping[serviceTierVarName] === SqlManagedInstanceGeneralPurpose.tierName) {
			price = SqlManagedInstanceGeneralPurpose.basePricePerCore;
		} else if (mapping[serviceTierVarName] === SqlManagedInstanceBusinessCritical.tierName) {
			price = SqlManagedInstanceBusinessCritical.basePricePerCore;
		}
	}
	return price;
}

// Estimated SQL server license price for one vCore.
export function estimatedSqlServerLicensePriceForOneVCore(mapping: { [key: string]: InputValueType }): number {
	let price = 0;
	if (mapping[devUseVarName] === 'true') {
		price = 0;
	} else if (mapping[devUseVarName] === 'false') {
		if (mapping[serviceTierVarName] === SqlManagedInstanceGeneralPurpose.tierName) {
			price = SqlManagedInstanceGeneralPurpose.licenseIncludedPricePerCore - SqlManagedInstanceGeneralPurpose.basePricePerCore;
		} else if (mapping[serviceTierVarName] === SqlManagedInstanceBusinessCritical.tierName) {
			price = SqlManagedInstanceBusinessCritical.licenseIncludedPricePerCore - SqlManagedInstanceBusinessCritical.basePricePerCore;
		}
	}
	return price;
}

// Full price for one vCore. This is shown on the cost summary card.
export function fullPriceForOneVCore(mapping: { [key: string]: InputValueType }): number {
	return estimatedBasePriceForOneVCore(mapping) + estimatedSqlServerLicensePriceForOneVCore(mapping);
}

// Gets number of vCores limit specified
export function numCores(mapping: { [key: string]: InputValueType }): number {
	return mapping[vcoresLimitVarName] ? <number>mapping[vcoresLimitVarName] : 0;
}

// Full price for all selected vCores.
export function vCoreFullPriceForAllCores(mapping: { [key: string]: InputValueType }): number {
	return fullPriceForOneVCore(mapping) * numCores(mapping) * numBillableReplicas(mapping);
}

// SQL Server License price for all vCores. This is shown on the cost summary card if customer has SQL server license.
export function vCoreSqlServerLicensePriceForAllCores(mapping: { [key: string]: InputValueType }): number {
	return estimatedSqlServerLicensePriceForOneVCore(mapping) * numCores(mapping) * numBillableReplicas(mapping);
}

// If the customer doesn't already have SQL Server License, AHB discount is set to zero because the price will be included
// in the total cost. If they already have it (they checked the box), then a discount will be applied.
export function azureHybridBenefitDiscount(mapping: { [key: string]: InputValueType }): number {
	if (mapping[licenseTypeVarName] === 'true') {
		return vCoreSqlServerLicensePriceForAllCores(mapping);
	} else {
		return 0;
	}
}

// Total price that will be charged to a customer. Is shown on the cost summary card.
export function total(mapping: { [key: string]: InputValueType }): number {
	return vCoreFullPriceForAllCores(mapping) - azureHybridBenefitDiscount(mapping);
}
