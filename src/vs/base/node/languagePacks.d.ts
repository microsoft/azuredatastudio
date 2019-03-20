/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface NLSConfiguration {
	locale: string;
	availableLanguages: {
		[key: string]: string;
	};
	pseudo?: boolean;
}

export interface InternalNLSConfiguration extends NLSConfiguration {
	_languagePackId: string;
	_translationsConfigFile: string;
	_cacheRoot: string;
	_resolvedLanguagePackCoreLocation: string;
	_corruptedFile: string;
	_languagePackSupport?: boolean;
}

export function getNLSConfiguration(commit: string, userDataPath: string, metaDataFile: string, locale: string): Promise<NLSConfiguration>;
