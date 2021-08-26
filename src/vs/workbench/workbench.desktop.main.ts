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


//#region --- workbench (desktop main)

import 'vs/workbench/electron-browser/desktop.main';

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


import 'vs/workbench/services/search/electron-browser/searchService';
import 'vs/workbench/services/extensions/electron-browser/extensionService';
import 'vs/workbench/services/remote/electron-browser/tunnelServiceImpl';


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
import { IQueryHistoryService } from 'sql/workbench/services/queryHistory/common/queryHistoryService';
import { QueryHistoryService } from 'sql/workbench/services/queryHistory/common/queryHistoryServiceImpl';

registerSingleton(ISqlOAuthService, SqlOAuthService);
registerSingleton(sqlIClipboardService, sqlClipboardService);
registerSingleton(IQueryHistoryService, QueryHistoryService);
// {{SQL CARBON EDIT}} - End

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


//#region --- workbench contributions

// Webview
import 'vs/workbench/contrib/webview/electron-browser/webview.contribution';


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



// Extensions Management
import 'vs/workbench/contrib/extensions/electron-browser/extensions.contribution';



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

// {{SQL CARBON EDIT}}
// getting started
import 'sql/workbench/update/electron-browser/gettingStarted.contribution';

// query history
import 'sql/workbench/contrib/queryHistory/electron-browser/queryHistory.contribution';

// CLI
import 'sql/workbench/contrib/commandLine/electron-browser/commandLine.contribution';

//getting started
import 'sql/workbench/contrib/welcome/gettingStarted/electron-browser/gettingStarted.contribution';
