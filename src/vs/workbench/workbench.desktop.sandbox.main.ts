/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


// #######################################################################
// ###                                                                 ###
// ### !!! PLEASE ADD COMMON IMPORTS INTO WORKBENCH.COMMON.MAIN.TS !!! ###
// ###                                                                 ###
// #######################################################################


//#region --- workbench common & sandbox

import 'vs/workbench/workbench.sandbox.main';

//#endregion


//#region --- workbench actions


//#endregion


//#region --- workbench (desktop main)

import 'vs/workbench/electron-sandbox/desktop.main';

//#endregion


//#region --- workbench services


//#endregion


//#region --- workbench contributions

// Webview (using the iframe based solution)
import 'vs/workbench/contrib/webview/browser/webview.web.contribution';

//#endregion
