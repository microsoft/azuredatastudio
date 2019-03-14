/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import 'mocha';

import * as extensionMain from '../main';

describe('buildSsmsMinCommandArgs Method Tests', () => {
    it('Should be built correctly with all params and UseAAD as false', function (): void {
        let params: extensionMain.LaunchSsmsDialogParams = {
            action: 'myAction',
            server: 'myServer',
            database: 'myDatabase',
            user: 'user',
            password: 'password',
            useAad: false,
            urn: 'Server\\Database\\Table'
        };
        let args = extensionMain.buildSsmsMinCommandArgs(params);
        should(args).equal('-a "myAction" -S "myServer" -D "myDatabase" -U "user" -u "Server\\Database\\Table"');
    });

    it('Should be built correctly with all params and UseAAD as true', function (): void {
        let params: extensionMain.LaunchSsmsDialogParams = {
            action: 'myAction',
            server: 'myServer',
            database: 'myDatabase',
            user: 'user',
            password: 'password',
            useAad: true,
            urn: 'Server\\Database\\Table'
        };
        let args = extensionMain.buildSsmsMinCommandArgs(params);
        // User is omitted since UseAAD is true
        should(args).equal('-a "myAction" -S "myServer" -D "myDatabase" -G -u "Server\\Database\\Table"');
    });

    it('Should be built correctly and names escaped correctly', function (): void {
        let params: extensionMain.LaunchSsmsDialogParams = {
            action: 'myAction\'"/\\[]tricky',
            server: 'myServer\'"/\\[]tricky',
            database: 'myDatabase\'"/\\[]tricky',
            user: 'user\'"/\\[]tricky',
            password: 'password',
            useAad: true,
            urn: 'Server\\Database[\'myDatabase\'\'"/\\[]tricky\']\\Table["myTable\'""/\\[]tricky"]'
        };
        let args = extensionMain.buildSsmsMinCommandArgs(params);
        // User is omitted since UseAAD is true
        should(args).equal('-a "myAction\'\\"/\\[]tricky" -S "myServer\'\\"/\\[]tricky" -D "myDatabase\'\\"/\\[]tricky" -G -u "Server\\Database[\'myDatabase\'\'\\"/\\[]tricky\']\\Table[\\"myTable\'\\"\\"/\\[]tricky\\"]"');
    });

    it('Should be built correctly with only action and server', function (): void {

        let params: extensionMain.LaunchSsmsDialogParams = {
            action: 'myAction',
            server: 'myServer'
        };
        let args = extensionMain.buildSsmsMinCommandArgs(params);
        should(args).equal('-a "myAction" -S "myServer"');
    });
});
