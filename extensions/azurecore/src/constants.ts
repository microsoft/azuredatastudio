'use strict';

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export const extensionConfigSectionName = 'azure';
export const ViewType = 'view';

export enum BuiltInCommands {
	SetContext = 'setContext'
}

export const extensionName = localize('extensionName', 'Azure Accounts');
