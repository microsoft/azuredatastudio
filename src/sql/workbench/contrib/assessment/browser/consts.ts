/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum AssessmentTargetType {
	Server = 1,
	Database = 2
}

export enum AssessmentType {
	AvailableRules = 1,
	InvokeAssessment = 2
}

export const TELEMETRY_VIEW_EVENT = 'Asmt.View';
