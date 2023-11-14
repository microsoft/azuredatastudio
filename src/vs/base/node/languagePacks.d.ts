/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface NLSConfiguration {
	locale: string;
	osLocale: string;
	availableLanguages: {
		[key: string]: string;
	};
	pseudo?: boolean;
	_languagePackSupport?: boolean;
}

export interface InternalNLSConfiguration extends NLSConfiguration {
	_languagePackId: string;
	_translationsConfigFile: string;
	_cacheRoot: string;
	_resolvedLanguagePackCoreLocation: string;
	_corruptedFile: string;
	_languagePackSupport?: boolean;
}

export function getNLSConfiguration(commit: string | undefined, userDataPath: string, metaDataFile: string, locale: string, osLocale: string): Promise<NLSConfiguration>;
