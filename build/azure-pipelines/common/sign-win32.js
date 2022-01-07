"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const sign_1 = require("./sign");
const path = require("path");
(0, sign_1.main)([
    process.env['EsrpCliDllPath'],
    'windows',
    process.env['ESRPPKI'],
    process.env['ESRPAADUsername'],
    process.env['ESRPAADPassword'],
    path.dirname(process.argv[2]),
    path.basename(process.argv[2])
]);
