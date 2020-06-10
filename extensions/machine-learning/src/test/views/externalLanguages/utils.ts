/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../../common/apiWrapper';
import { LanguageViewBase } from '../../../views/externalLanguages/languageViewBase';
import * as mssql from '../../../../../mssql';
import { LanguageService } from '../../../externalLanguage/languageService';
import { createViewContext } from '../utils';

export interface TestContext {
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	view: azdata.ModelView;
	languageExtensionService: mssql.ILanguageExtensionService;
	onClick: vscode.EventEmitter<any>;
	dialogModel: TypeMoq.IMock<LanguageService>;
}

export class ParentDialog extends LanguageViewBase {
	public reset(): Promise<void> {
		return Promise.resolve();
	}
	constructor(
		apiWrapper: ApiWrapper) {
		super(apiWrapper, '');
	}
}

export function createContext(): TestContext {

	let viewTestContext = createViewContext();
	let connection = new azdata.connection.ConnectionProfile();
	viewTestContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
	viewTestContext.apiWrapper.setup(x => x.getUriForConnection(TypeMoq.It.isAny())).returns(() => { return Promise.resolve('connectionUrl'); });

	let languageExtensionService: mssql.ILanguageExtensionService = {
		listLanguages: () => { return Promise.resolve([]); },
		deleteLanguage: () => { return Promise.resolve(); },
		updateLanguage: () => { return Promise.resolve(); }
	};

	return {
		apiWrapper: viewTestContext.apiWrapper,
		view: viewTestContext.view,
		languageExtensionService: languageExtensionService,
		onClick: viewTestContext.onClick,
		dialogModel: TypeMoq.Mock.ofType(LanguageService)
	};
}
