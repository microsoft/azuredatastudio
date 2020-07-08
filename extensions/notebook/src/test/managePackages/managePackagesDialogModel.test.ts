/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import 'mocha';
import * as TypeMoq from 'typemoq';
import { IPackageManageProvider, IPackageDetails } from '../../types';
import { LocalPipPackageManageProvider } from '../../jupyter/localPipPackageManageProvider';

import { ManagePackagesDialogModel } from '../../dialog/managePackages/managePackagesDialogModel';
import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';

interface TestContext {
	provider: IPackageManageProvider;
}

describe('Manage Packages', () => {
	let jupyterServerInstallation: JupyterServerInstallation;
	beforeEach(() => {
		jupyterServerInstallation = new JupyterServerInstallation(undefined, undefined);
	});

	it('Should throw exception given undefined providers', async function (): Promise<void> {
		should.throws(() => { new ManagePackagesDialogModel(jupyterServerInstallation, undefined); }, 'Invalid list of package manager providers');
	});

	it('Should throw exception given empty providers', async function (): Promise<void> {
		let providers = new Map<string, IPackageManageProvider>();
		should.throws(() => { new ManagePackagesDialogModel(jupyterServerInstallation, providers); }, 'Invalid list of package manager providers');
	});

	it('Should have expected behavior given undefined options', async function (): Promise<void> {
		let testContext = createContext();
		testContext.provider.listPackages = () => {
			return Promise.resolve(undefined);
		};
		let provider = createProvider(testContext);
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(provider.providerId, provider);
		const model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, undefined);
		should.equal(model.currentPackageType, undefined, 'Current Package Type expected to be undefined');
		should.deepEqual(model.options, { defaultLocation: undefined, defaultProviderId: undefined }, 'Options should be default options');
		should.deepEqual(model.packageManageProviders, providers, 'Package Manage Providers should exist');
		should.equal(model.currentPackageManageProvider, undefined, 'Current Package Manage Provider should be undefined');
		should.equal(model.currentPackageType, undefined, 'Current Package Type should be undefined');
		should.deepEqual(model.targetLocationTypes, [], 'Target Location Types should be an empty array');
		should.equal(model.defaultLocation, undefined, 'Default Location should be undefined');
		should.equal(model.defaultProviderId, provider.providerId, 'Default Provider ID should be correct');
		should.deepEqual(model.getPackageTypes(), [], 'Undefined location should return empty array when calling getPackageTypes');
		should.deepEqual(model.getPackageTypes('location1'), [],'Valid location should return empty array when calling getPackageTypes');
		should.equal(model.getDefaultPackageType(), undefined, 'Default Package Type should be undefined');
		should.deepEqual(await model.listPackages(), [], 'Packages list should be empty');
		await should(model.installPackages([])).rejected();
		await should(model.uninstallPackages([])).rejected();
		should.equal(await model.getLocations(), undefined, 'Get Locations should be undefined before provider is set');
		should(model.getPackageOverview('package')).rejected();

		// Change provider and then retest functions which throw without valid provider
		model.changeProvider(provider.providerId);

		await should(model.installPackages([])).resolved();
		await should(model.uninstallPackages([])).resolved();
		should.deepEqual(await model.getLocations(), await provider.getLocations(), 'Get Locations should be valid after provider is set');
		should(model.getPackageOverview('p1')).resolved();
		model.changeLocation('location1');

	});

	it('Init should throw exception given invalid default location', async function (): Promise<void> {
		let testContext = createContext();
		let provider = createProvider(testContext);
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(provider.providerId, provider);

		let options = {
			defaultLocation: 'invalid location'
		};
		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, options);
		await should(model.init()).rejectedWith(`Invalid default location '${options.defaultLocation}`);
	});

	it('Init should throw exception given invalid default provider', async function (): Promise<void> {
		let testContext = createContext();
		let provider = createProvider(testContext);
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(provider.providerId, provider);

		let options = {
			defaultProviderId: 'invalid provider'
		};
		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, options);
		await should(model.init()).rejectedWith(`Invalid default provider id '${options.defaultProviderId}`);
	});

	it('Init should set default options given undefined', async function (): Promise<void> {
		let testContext = createContext();
		let provider = createProvider(testContext);
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(provider.providerId, provider);

		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		should.equal(model.defaultLocation, provider.packageTarget.location);
		should.equal(model.defaultProviderId, provider.providerId);
	});

	it('Init should have expected defaults given valid options', async function (): Promise<void> {
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
		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext1.provider.providerId, createProvider(testContext1));
		providers.set(testContext2.provider.providerId, createProvider(testContext2));
		let options = {
			defaultLocation: testContext2.provider.packageTarget.location,
			defaultProviderId: testContext2.provider.providerId
		};
		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, options);

		await model.init();
		should.equal(model.defaultLocation, testContext2.provider.packageTarget.location);
		should.equal(model.defaultProviderId, testContext2.provider.providerId);
		should.equal(model.getDefaultPackageType().packageType, testContext2.provider.packageTarget.packageType);
		should.equal(model.currentPackageType, testContext2.provider.packageTarget.packageType);
		should.equal(model.jupyterInstallation, jupyterServerInstallation);
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

		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		should.equal(model.defaultLocation, testContext1.provider.packageTarget.location);
		should.deepEqual(model.getPackageTypes('location1'), [{ providerId: 'providerId1', packageType: 'package-type1'}, {providerId: 'providerId2', packageType: 'package-type2'}]);
		should.deepEqual(model.getPackageTypes('location2'), [{providerId: 'providerId3', packageType: 'package-type1'}]);
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

		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		should.equal(model.defaultLocation, testContext1.provider.packageTarget.location);
		should.deepEqual(model.getPackageTypes('location1'), [{providerId: 'providerId1', packageType: 'package-type1'}]);
	});

	it('Should set default location to one set in given options', async function (): Promise<void> {
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

		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, {
			defaultLocation: testContext2.provider.packageTarget.location,
			defaultProviderId: testContext2.provider.providerId
		});

		await model.init();
		should.equal(model.defaultLocation, testContext2.provider.packageTarget.location);
		should.deepEqual(model.getPackageTypes('location1'), [{providerId: 'providerId1', packageType: 'package-type1'}]);
	});

	it('changeProvider should change current provider successfully', async function (): Promise<void> {
		let testContext1 = createContext();
		testContext1.provider.providerId = 'providerId1';
		testContext1.provider.getLocations = () => Promise.resolve([{displayName: 'location title 1', name: 'location1'}]);
		testContext1.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type1'
		};

		let testContext2 = createContext();
		testContext2.provider.providerId = 'providerId2';
		testContext2.provider.getLocations = () => Promise.resolve([{displayName: 'location title 2', name: 'location2'}]);
		testContext2.provider.packageTarget = {
			location: 'location2',
			packageType: 'package-type2'
		};

		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext1.provider.providerId, createProvider(testContext1));
		providers.set(testContext2.provider.providerId, createProvider(testContext2));

		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		model.changeProvider('providerId2');
		should.deepEqual(await model.getLocations(), [{displayName: 'location title 2', name: 'location2'}]);
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

		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, undefined);

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

		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, undefined);

		should.equal(model.currentPackageManageProvider, undefined);
		await should(model.listPackages()).resolvedWith([]);
		await should(model.installPackages(TypeMoq.It.isAny())).rejected();
		await should(model.uninstallPackages(TypeMoq.It.isAny())).rejected();
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
		testContext2.provider.getLocations = () => Promise.resolve([{displayName: 'location title 2', name: 'location2'}]);
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
		testContext1.provider.listPackages = () => {
			return Promise.resolve([{
				name: 'p3',
				version: '1.1.1.3'
			}]);
		};

		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext1.provider.providerId, createProvider(testContext1));
		providers.set(testContext2.provider.providerId, createProvider(testContext2));

		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		model.changeProvider('providerId2');

		await should(model.listPackages()).resolvedWith(packages);
		await should(model.installPackages(packages)).resolved();
		await should(model.uninstallPackages(packages)).resolved();
		await should(model.getPackageOverview('p1')).resolved();
		await should(model.getLocations()).resolvedWith([{displayName: 'location title 2', name: 'location2'}]);
	});

	it('listPackages should return packages for current location', async function (): Promise<void> {
		let testContext = createContext();
		testContext.provider.providerId = 'providerId1';
		testContext.provider.packageTarget = {
			location: 'location1',
			packageType: 'package-type1'
		};

		let packages1 = [
			{
				name: 'p1',
				version: '1.1.1.1'
			},
			{
				name: 'p2',
				version: '1.1.1.2'
			}
		];
		let packages2 = [{
			name: 'p3',
			version: '1.1.1.3'
		}];
		testContext.provider.listPackages = (location) => {
			if (location === 'location1') {
			return Promise.resolve(packages1);
			} else {
				return Promise.resolve(packages2);
			}

		};

		let providers = new Map<string, IPackageManageProvider>();
		providers.set(testContext.provider.providerId, createProvider(testContext));

		let model = new ManagePackagesDialogModel(jupyterServerInstallation, providers, undefined);

		await model.init();
		model.changeProvider('providerId1');
		model.changeLocation('location2');

		await should(model.listPackages()).resolvedWith(packages2);
	});

	function createContext(): TestContext {
		return {
			provider: {
				providerId: 'providerId',
				packageTarget: {
					location: 'location',
					packageType: 'package-type'
				},
				canUseProvider: () => { return Promise.resolve(true); },
				getLocations: () => { return Promise.resolve([{displayName: 'location-title', name: 'location'}]); },
				installPackages:() =>  { return Promise.resolve(); },
				uninstallPackages: (packages: IPackageDetails[]) => { return Promise.resolve(); },
				listPackages: () => { return Promise.resolve([]); },
				getPackageOverview: (name: string) => { return Promise.resolve(undefined); },
			}
		};
	}

	function createProvider(testContext: TestContext): IPackageManageProvider {
		let mockProvider = TypeMoq.Mock.ofType(LocalPipPackageManageProvider);
		mockProvider.setup(x => x.canUseProvider()).returns(() => testContext.provider.canUseProvider());
		mockProvider.setup(x => x.getLocations()).returns(() => testContext.provider.getLocations());
		mockProvider.setup(x => x.installPackages(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((packages, useMinVersion) => testContext.provider.installPackages(packages, useMinVersion));
		mockProvider.setup(x => x.uninstallPackages(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns((packages) => testContext.provider.uninstallPackages(packages));
		mockProvider.setup(x => x.listPackages(TypeMoq.It.isAny())).returns(() => testContext.provider.listPackages());
		mockProvider.setup(x => x.getPackageOverview(TypeMoq.It.isAny())).returns((name) => testContext.provider.getPackageOverview(name));
		mockProvider.setup(x => x.packageTarget).returns(() => testContext.provider.packageTarget);
		mockProvider.setup(x => x.providerId).returns(() => testContext.provider.providerId);
		return mockProvider.object;
	}

});
