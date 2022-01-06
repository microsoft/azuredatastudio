/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface IPropertyData {
	classification: 'SystemMetaData' | 'CallstackOrException' | 'CustomerContent' | 'PublicNonPersonalData' | 'EndUserPseudonymizedInformation';
	purpose: 'PerformanceAndHealth' | 'FeatureInsight' | 'BusinessInsight';
	expiration?: string;
	endpoint?: string;
	isMeasurement?: boolean;
}

export interface IGDPRProperty {
	readonly [name: string]: IPropertyData | undefined | IGDPRProperty;
}

export type ClassifiedEvent<T extends IGDPRProperty> = {
	[k in keyof T]: any
};

export type StrictPropertyChecker<TEvent, TClassifiedEvent, TError> = keyof TEvent extends keyof TClassifiedEvent ? keyof TClassifiedEvent extends keyof TEvent ? TEvent : TError : TError;

export type StrictPropertyCheckError = 'Type of classified event does not match event properties';

export type StrictPropertyCheck<T extends IGDPRProperty, E> = StrictPropertyChecker<E, ClassifiedEvent<T>, StrictPropertyCheckError>;

export type GDPRClassification<T> = { [_ in keyof T]: IPropertyData | IGDPRProperty | undefined };
