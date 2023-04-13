/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


//#region --- workbench common & sandbox

import 'vs/workbench/workbench.sandbox.main';

//#endregion


//#region --- workbench services


// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

import 'vs/workbench/services/extensions/electron-browser/extensionService';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//
// NOTE: Please do NOT register services here. Use `registerSingleton()`
//       from `workbench.common.main.ts` if the service is shared between
//       desktop and web or `workbench.sandbox.main.ts` if the service
//       is desktop only.
//
//       The `node` & `electron-browser` layer is deprecated for workbench!
//
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


//#endregion
// {{SQL CARBON EDIT}} - SQL-specific services
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ISqlOAuthService } from 'sql/platform/oAuth/common/sqlOAuthService';
import { SqlOAuthService } from 'sql/platform/oAuth/electron-browser/sqlOAuthServiceImpl';
import { IClipboardService as sqlIClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ClipboardService as sqlClipboardService } from 'sql/platform/clipboard/electron-browser/clipboardService';
import { IAzureBlobService } from 'sql/platform/azureBlob/common/azureBlobService';
import { AzureBlobService } from 'sql/workbench/services/azureBlob/browser/azureBlobService';
import { IAzureAccountService } from 'sql/platform/azureAccount/common/azureAccountService';
import { AzureAccountService } from 'sql/workbench/services/azureAccount/browser/azureAccountService';

registerSingleton(ISqlOAuthService, SqlOAuthService);
registerSingleton(sqlIClipboardService, sqlClipboardService);
registerSingleton(IAzureBlobService, AzureBlobService);
registerSingleton(IAzureAccountService, AzureAccountService);
// {{SQL CARBON EDIT}} - End

// {{SQL CARBON EDIT}}
// getting started
import 'sql/workbench/update/electron-browser/gettingStarted.contribution';

// CLI
import 'sql/workbench/contrib/commandLine/electron-browser/commandLine.contribution';

//getting started
import 'sql/workbench/contrib/welcome/gettingStarted/electron-browser/gettingStarted.contribution';
