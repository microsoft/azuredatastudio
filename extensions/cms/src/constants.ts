'use strict';

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();
export const ViewType = 'view';

export enum BuiltInCommands {
	SetContext = 'setContext'
}

export const extensionName = 'cms';
export const cmsRegisteredServersId = 'cms.cmsServers';
