/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import 'mocha';
import * as TypeMoq from 'typemoq';
import { IPackageManageProvider, IPackageDetails } from '../../types';
import { LocalPipPackageManageProvider } from '../../jupyter/localPipPackageManageProvider';

import { ManagePackageDialogModel } from '../../dialog/managePackages/managePackagesDialogModel';
import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';

interface testContext {
	provider: IPackageManageProvider;
}

describe('Manage Packages', () => {
	let jupyterServerInstallation: JupyterServerInstallation;
	beforeEach(() => {
		jupyterServerInstallation = new JupyterServerInstallation(undefined, undefined, undefined, undefined);
	});

	it('Should throw exception given undefined providers', async function (): Promise<void> {
		should.throws(() => { new ManagePackageDialogModel(jupyterServerInstallation, undefined); }, 'Invalid list of package manager providers');
	});

	it('Should throw exception given empty providers', async function (): Promise<void> {
		let providers = new Map<string, IPackageManageProvider>();
		should.throws(() => { new ManagePackageDialogModel(jupyterServerInstallation, providers); }, 'Invalid list of package manager providers');
	});

	it('Should not throw exception given undefined options', async function (): Promise<void> {
		let testContext = createContext();
		testContext.provider.listPackages = () => {
			return Promise.resolve(undefined);
		};
		let provider = createProvider(testContext);
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(provider.providerId, provider);

		should.doesNotThrow(() => { new ManagePackageDialogModel(jupyterServerInstallation, providers, undefined); });
	});

	it('Init should throw exception given invalid default location', async function (): Promise<void> {
		let testContext = createContext();
		let provider = createProvider(testContext);
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(provider.providerId, provider);

		let options = {
			multiLocations: true,
			defaultLocation: 'invalid location'
		};
		let model = new ManagePackageDialogModel(jupyterServerInstallation, providers, options);
		should(model.init()).rejectedWith(`Invalid default location '${options.defaultLocation}`);
	});

	it('Init should throw exception not given valid default location for single location mode', async function (): Promise<void> {
		let testContext = createContext();
		let provider = createProvider(testContext);
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(provider.providerId, provider);

		let options = {
			multiLocations: false
		};
		let model = new ManagePackageDialogModel(jupyterServerInstallation, providers, options);
		should(model.init()).rejectedWith(`Default location not specified for single location mode`);
	});

	it('Init should set default options given undefined', async function (): Promise<void> {
		let testContext = createContext();
		let provider = createProvider(testContext);
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(provider.providerId, provider);

		let model = new ManagePackageDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		should.equal(model.multiLocationMode, true);
		should.equal(model.defaultLocation, provider.packageTarget.location);
	});

	it('Should create a cache for multiple providers successfully', async function (): Promise<void> {
		let testContext1 = createContext();
		testContext1.provider.providerId = 'providerId1';
		testContext1.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type1'
		};

		let testContext2 = createContext();
		testContext2.provider.providerId = 'providerId2';
		testContext2.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type2'
		};

		let testContext3 = createContext();
		testContext3.provider.providerId = 'providerId3';
		testContext3.provider.packageTarget = {
			location: 'location2',
			packageType: 'package-type1'
		};
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext1.provider.providerId, createProvider(testContext1));
		providers.set(testContext2.provider.providerId, createProvider(testContext2));
		providers.set(testContext3.provider.providerId, createProvider(testContext3));

		let model = new ManagePackageDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		should.equal(model.defaultLocation, testContext1.provider.packageTarget.location);
		should.deepEqual(model.getPackageTypes('location1'), [['providerId1', 'package-type1'], ['providerId2', 'package-type2']]);
		should.deepEqual(model.getPackageTypes('location2'), [['providerId3', 'package-type1']]);
	});

	it('Should not include a provider that can not be used in current context', async function (): Promise<void> {
		let testContext1 = createContext();
		testContext1.provider.providerId = 'providerId1';
		testContext1.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type1'
		};

		let testContext2 = createContext();
		testContext2.provider.providerId = 'providerId2';
		testContext2.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type2'
		};
		testContext2.provider.canUseProvider = () => { return Promise.resolve(false); };

		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext1.provider.providerId, createProvider(testContext1));
		providers.set(testContext2.provider.providerId, createProvider(testContext2));

		let model = new ManagePackageDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		should.equal(model.defaultLocation, testContext1.provider.packageTarget.location);
		should.deepEqual(model.getPackageTypes('location1'), [['providerId1', 'package-type1']]);
	});

	it('changeProvider should change current provider successfully', async function (): Promise<void> {
		let testContext1 = createContext();
		testContext1.provider.providerId = 'providerId1';
		testContext1.provider.getLocationTitle = () => 'location title 1';
		testContext1.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type1'
		};

		let testContext2 = createContext();
		testContext2.provider.providerId = 'providerId2';
		testContext2.provider.getLocationTitle = () => 'location title 2';
		testContext2.provider.packageTarget = {
			location: 'location2',
			packageType: 'package-type2'
		};

		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext1.provider.providerId, createProvider(testContext1));
		providers.set(testContext2.provider.providerId, createProvider(testContext2));

		let model = new ManagePackageDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		model.changeProvider('providerId2');
		should.deepEqual(model.getLocationTitle(), 'location title 2');
	});

	it('changeProvider should throw exception given invalid provider', async function (): Promise<void> {
		let testContext1 = createContext();
		testContext1.provider.providerId = 'providerId1';
		testContext1.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type1'
		};

		let testContext2 = createContext();
		testContext2.provider.providerId = 'providerId2';
		testContext2.provider.packageTarget = {
			location: 'location2',
			packageType: 'package-type2'
		};

		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext1.provider.providerId, createProvider(testContext1));
		providers.set(testContext2.provider.providerId, createProvider(testContext2));

		let model = new ManagePackageDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		should.throws(() => model.changeProvider('providerId3'));
	});


	it('currentPackageManageProvider should return undefined if current provider is not set', async function (): Promise<void> {
		let testContext1 = createContext();
		testContext1.provider.providerId = 'providerId1';
		testContext1.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type1'
		};

		let testContext2 = createContext();
		testContext2.provider.providerId = 'providerId2';
		testContext2.provider.packageTarget = {
			location: 'location2',
			packageType: 'package-type2'
		};

		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext1.provider.providerId, createProvider(testContext1));
		providers.set(testContext2.provider.providerId, createProvider(testContext2));

		let model = new ManagePackageDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		should.equal(model.currentPackageManageProvider, undefined);
		should(model.listPackage()).rejected();
		should(model.installPackages(TypeMoq.It.isAny())).rejected();
		should(model.uninstallPackages(TypeMoq.It.isAny())).rejected();
	});

	it('current provider should install and uninstall packages successfully', async function (): Promise<void> {
		let testContext1 = createContext();
		testContext1.provider.providerId = 'providerId1';
		testContext1.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type1'
		};

		let testContext2 = createContext();
		testContext2.provider.providerId = 'providerId2';
		testContext2.provider.getLocationTitle = () => 'location title 2';
		testContext2.provider.packageTarget = {
			location: 'location2',
			packageType: 'package-type2'
		};
		let packages = [
			{
				name: 'p1',
				version: '1.1.1.1'
			},
			{
				name: 'p2',
				version: '1.1.1.2'
			}
		];
		testContext2.provider.listPackages = () => {
			return Promise.resolve(packages);
		};

		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext1.provider.providerId, createProvider(testContext1));
		providers.set(testContext2.provider.providerId, createProvider(testContext2));

		let model = new ManagePackageDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		model.changeProvider('providerId2');
		should(model.listPackage()).resolvedWith(packages);
		should(model.installPackages(packages)).resolved();
		should(model.uninstallPackages(packages)).resolved();
		should.equal(model.getLocationTitle(), 'location title 2');
	});

	function createContext(): testContext {
		return {
			provider: {
				providerId: 'providerId',
				packageTarget: {
					location: 'location',
					packageType: 'package-type'
				},
				canUseProvider: () => { return Promise.resolve(true); },
				getLocationTitle: () => { return 'location-title'; },
				installPackage:() =>  { return Promise.resolve(); },
				uninstallPackage: (packages: IPackageDetails[]) => { return Promise.resolve(); },
				listPackages: () => { return Promise.resolve([]); },
			}
		};
	}

	function createProvider(testContext: testContext): IPackageManageProvider {
		let mockProvider = TypeMoq.Mock.ofType(LocalPipPackageManageProvider);
		mockProvider.setup(x => x.canUseProvider()).returns(() => testContext.provider.canUseProvider());
		mockProvider.setup(x => x.getLocationTitle()).returns(() => testContext.provider.getLocationTitle());
		mockProvider.setup(x => x.installPackage(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((packages, useMinVersion) => testContext.provider.installPackage(packages, useMinVersion));
		mockProvider.setup(x => x.uninstallPackage(TypeMoq.It.isAny())).returns((packages) => testContext.provider.uninstallPackage(packages));
		mockProvider.setup(x => x.listPackages()).returns(() => testContext.provider.listPackages());
		mockProvider.setup(x => x.packageTarget).returns(() => testContext.provider.packageTarget);
		mockProvider.setup(x => x.providerId).returns(() => testContext.provider.providerId);
		return mockProvider.object;
	}

});
