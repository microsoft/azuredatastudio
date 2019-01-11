/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as TelemetryUtils from 'sql/common/telemetryUtilities';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { TelemetryServiceStub } from 'sqltest/stubs/telemetryServiceStub';
import * as TypeMoq from 'typemoq';
import { TPromise } from 'vs/base/common/winjs.base';
import * as assert from 'assert';

suite('SQL Telemetry Utilities tests', () => {
	let telemetryService: TypeMoq.Mock<ITelemetryService>;
	let none: void;
	let providerName: string = 'provider name';
	let telemetryKey: string = 'tel key';

	let connectionProfile = {
		connectionName: '',
		databaseName: '',
		serverName: '',
		authenticationType: '',
		getOptionsKey: () => '',
		matches: undefined,
		groupFullName: '',
		groupId: '',
		id: '',
		options: {},
		password: '',
		providerName: providerName,
		savePassword: true,
		saveProfile: true,
		userName: ''
	};

	setup(() => {
		telemetryService = TypeMoq.Mock.ofType(TelemetryServiceStub, TypeMoq.MockBehavior.Strict);
		telemetryService.setup(x => x.publicLog(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(x => TPromise.as(none));
	});

	test('addTelemetry should add provider id using the connection', (done) => {
		let data: TelemetryUtils.IConnectionTelemetryData = {
		};

		TelemetryUtils.addTelemetry(telemetryService.object, telemetryKey, data, connectionProfile).then(() => {
			telemetryService.verify(x => x.publicLog(TypeMoq.It.is(a => a === telemetryKey), TypeMoq.It.is(b => b.provider === providerName)), TypeMoq.Times.once());
			done();
		}).catch(err => {
			assert.fail(err);
			done(err);
		});
	});

	test('addTelemetry should pass the telemetry data to telemetry service', (done) => {
		let data: TelemetryUtils.IConnectionTelemetryData = {
			target: 'target',
			from: 'from'
		};
		data.test1 = '1';

		TelemetryUtils.addTelemetry(telemetryService.object, telemetryKey, data, connectionProfile).then(() => {
			telemetryService.verify(x => x.publicLog(
				TypeMoq.It.is(a => a === telemetryKey),
				TypeMoq.It.is(b => b.provider === providerName
					&& b.from === data.from
					&& b.target === data.target
					&& b.test1 === data.test1
					&& b.connection === undefined)), TypeMoq.Times.once());
			done();
		}).catch(err => {
			assert.fail(err);
			done(err);
		});
	});

	test('addTelemetry should not crash not given data', (done) => {
		TelemetryUtils.addTelemetry(telemetryService.object, telemetryKey).then(() => {
			telemetryService.verify(x => x.publicLog(
				TypeMoq.It.is(a => a === telemetryKey),
				TypeMoq.It.is(b => b !== undefined)), TypeMoq.Times.once());
			done();
		}).catch(err => {
			assert.fail(err);
			done(err);
		});
	});

	test('addTelemetry should try to get the provider name from data first', (done) => {
		let data: TelemetryUtils.IConnectionTelemetryData = {
			connection: connectionProfile
		};
		data.provider = providerName + '1';

		TelemetryUtils.addTelemetry(telemetryService.object, telemetryKey, data, connectionProfile).then(() => {
			telemetryService.verify(x => x.publicLog(TypeMoq.It.is(a => a === telemetryKey), TypeMoq.It.is(b => b.provider === data.provider)), TypeMoq.Times.once());
			done();
		}).catch(err => {
			assert.fail(err);
			done(err);
		});
	});
});