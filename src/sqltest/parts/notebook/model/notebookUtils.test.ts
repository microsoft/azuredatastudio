/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import { nb, IConnectionProfile } from 'sqlops';

import { CapabilitiesTestService } from 'sqltest/stubs/capabilitiesTestService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { formatServerNameWithDatabaseNameForAttachTo, getServerFromFormattedAttachToName, getDatabaseFromFormattedAttachToName } from 'sql/parts/notebook/notebookUtils';

suite('notebookUtils', function(): void {
    let conn: IConnectionProfile = {
        connectionName: '',
        serverName: '',
        databaseName: '',
        userName: '',
        password: '',
        authenticationType: '',
        savePassword: true,
        groupFullName: '',
        groupId: '',
        providerName: '',
        saveProfile: true,
        id: '',
        options: {},
        azureTenantId: undefined
    };

    test('Should format server and database name correctly for attach to', async function(): Promise<void> {
        let capabilitiesService = new CapabilitiesTestService();
        let connProfile = new ConnectionProfile(capabilitiesService, conn);
        connProfile.serverName = 'serverName';
        connProfile.databaseName = 'databaseName';
        let attachToNameFormatted = formatServerNameWithDatabaseNameForAttachTo(connProfile);
        should(attachToNameFormatted).equal('serverName (databaseName)');
    });

    test('Should format server name correctly for attach to', async function(): Promise<void> {
        let capabilitiesService = new CapabilitiesTestService();
        let connProfile = new ConnectionProfile(capabilitiesService, conn);
        connProfile.serverName = 'serverName';
        let attachToNameFormatted = formatServerNameWithDatabaseNameForAttachTo(connProfile);
        should(attachToNameFormatted).equal('serverName');
    });

    test('Should format server name correctly for attach to when database is undefined', async function(): Promise<void> {
        let capabilitiesService = new CapabilitiesTestService();
        let connProfile = new ConnectionProfile(capabilitiesService, conn);
        connProfile.serverName = 'serverName';
        connProfile.databaseName = undefined;
        let attachToNameFormatted = formatServerNameWithDatabaseNameForAttachTo(connProfile);
        should(attachToNameFormatted).equal('serverName');
    });

    test('Should format server name as empty string when server/database are undefined', async function(): Promise<void> {
        let capabilitiesService = new CapabilitiesTestService();
        let connProfile = new ConnectionProfile(capabilitiesService, conn);
        connProfile.serverName = undefined;
        connProfile.databaseName = undefined;
        let attachToNameFormatted = formatServerNameWithDatabaseNameForAttachTo(connProfile);
        should(attachToNameFormatted).equal('');
    });

    test('Should extract server name when no database specified', async function(): Promise<void> {
        let serverName = getServerFromFormattedAttachToName('serverName');
        let databaseName = getDatabaseFromFormattedAttachToName('serverName');
        should(serverName).equal('serverName');
        should(databaseName).equal('');
    });

    test('Should extract server and database name', async function(): Promise<void> {
        let serverName = getServerFromFormattedAttachToName('serverName (databaseName)');
        let databaseName = getDatabaseFromFormattedAttachToName('serverName (databaseName)');
        should(serverName).equal('serverName');
        should(databaseName).equal('databaseName');
    });

    test('Should extract server and database name with other parentheses', async function(): Promise<void> {
        let serverName = getServerFromFormattedAttachToName('serv()erName (databaseName)');
        let databaseName = getDatabaseFromFormattedAttachToName('serv()erName (databaseName)');
        should(serverName).equal('serv()erName');
        should(databaseName).equal('databaseName');
    });
});
