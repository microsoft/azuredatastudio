/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { AuthenticationMode } from '../ui/deployClusterWizard/deployClusterWizardModel';
export const SqlServerMasterResource = 'master';
export const DataResource = 'data-0';
export const HdfsResource = 'storage-0';
export const ComputeResource = 'compute-0';
export const NameNodeResource = 'nmnode-0';
export const SparkHeadResource = 'sparkhead';
export const ZooKeeperResource = 'zookeeper';
export const SparkResource = 'spark-0';

interface ServiceEndpoint {
	port: number;
	serviceType: ServiceType;
	name: EndpointName;
	dnsName?: string;
}
type ServiceType = 'NodePort' | 'LoadBalancer';
type EndpointName = 'Controller' | 'Master' | 'Knox' | 'MasterSecondary' | 'AppServiceProxy' | 'ServiceProxy';

export interface ActiveDirectorySettings {
	organizationalUnit: string;
	domainControllerFQDNs: string;
	dnsIPAddresses: string;
	domainDNSName: string;
	realm?: string;
	clusterUsers: string;
	clusterAdmins: string;
	appReaders?: string;
	appOwners?: string;
	subdomain?: string;
	accountPrefix?: string;
}

export class BigDataClusterDeploymentProfile {
	constructor(private _profileName: string, private _bdcConfig: any, private _controlConfig: any) {
		// TODO: add validation logic for these 2 objects
		// https://github.com/microsoft/azuredatastudio/issues/7344
	}

	public get profileName(): string {
		return this._profileName;
	}

	public get clusterName(): string {
		return this._bdcConfig.metadata.name;
	}

	public set clusterName(value: string) {
		this._bdcConfig.metadata.name = value;
	}

	public get registry(): string {
		return this._controlConfig.spec.docker.registry;
	}

	public set registry(value: string) {
		this._controlConfig.spec.docker.registry = value;
	}

	public get repository(): string {
		return this._controlConfig.spec.docker.repository;
	}

	public set repository(value: string) {
		this._controlConfig.spec.docker.repository = value;
	}

	public get imageTag(): string {
		return this._controlConfig.spec.docker.imageTag;
	}

	public set imageTag(value: string) {
		this._controlConfig.spec.docker.imageTag = value;
	}

	public get bdcConfig(): any {
		return this._bdcConfig;
	}

	public get controlConfig(): any {
		return this._controlConfig;
	}

	public get sqlServerReplicas(): number {
		return this.getReplicas(SqlServerMasterResource);
	}

	public set sqlServerReplicas(replicas: number) {
		this.setReplicas(SqlServerMasterResource, replicas);
	}

	public get hdfsNameNodeReplicas(): number {
		return this.getReplicas(NameNodeResource);
	}

	public set hdfsNameNodeReplicas(replicas: number) {
		this.setReplicas(NameNodeResource, replicas);
	}

	public get sparkHeadReplicas(): number {
		return this.getReplicas(SparkHeadResource);
	}

	public set sparkHeadReplicas(replicas: number) {
		this.setReplicas(SparkHeadResource, replicas);
	}

	public get dataReplicas(): number {
		return this.getReplicas(DataResource);
	}

	public set dataReplicas(replicas: number) {
		this.setReplicas(SparkHeadResource, replicas);
	}

	public get hdfsReplicas(): number {
		return this.getReplicas(HdfsResource);
	}

	public set hdfsReplicas(replicas: number) {
		this.setReplicas(HdfsResource, replicas);
	}

	public get zooKeeperReplicas(): number {
		return this.getReplicas(ZooKeeperResource);
	}

	public set zooKeeperReplicas(replicas: number) {
		this.setReplicas(ZooKeeperResource, replicas);
	}

	public get computeReplicas(): number {
		return this.getReplicas(ComputeResource);
	}

	public set computeReplicas(replicas: number) {
		this.setReplicas(ComputeResource, replicas);
	}

	public get sparkReplicas(): number {
		return this._bdcConfig.spec.resources[SparkResource] ? this.getReplicas(SparkResource) : 0;
	}

	public get includeSpark(): boolean {
		return <boolean>this._bdcConfig.spec.resources[HdfsResource].spec.settings.spark.includeSpark;
	}

	public set includeSpark(value: boolean) {
		this._bdcConfig.spec.resources[HdfsResource].spec.settings.spark.includeSpark = value;
	}

	public get controllerDataStorageClass(): string {
		return <string>this._controlConfig.spec.storage.data.className;
	}

	public set controllerDataStorageClass(value: string) {
		this._controlConfig.spec.storage.data.className = value;
	}

	public get controllerDataStorageSize(): number {
		return <number>this._controlConfig.spec.storage.data.size.replace('Gi', '');
	}

	public set controllerDataStorageSize(value: number) {
		this._controlConfig.spec.storage.data.size = `${value}Gi`;
	}

	public get controllerLogsStorageClass(): string {
		return <string>this._controlConfig.spec.storage.logs.className;
	}

	public set controllerLogsStorageClass(value: string) {
		this._controlConfig.spec.storage.logs.className = value;
	}

	public get controllerLogsStorageSize(): number {
		return <number>this._controlConfig.spec.storage.logs.size.replace('Gi', '');
	}

	public set controllerLogsStorageSize(value: number) {
		this._controlConfig.spec.storage.logs.size = `${value}Gi`;
	}

	public setResourceStorage(resourceName: 'data-0' | 'master' | 'storage-0', dataStorageClass: string, dataStorageSize: number, logsStorageClass: string, logsStorageSize: number) {
		this.bdcConfig.spec.resources[resourceName].spec.storage = {
			data: {
				size: `${dataStorageSize}Gi`,
				className: dataStorageClass,
				accessMode: 'ReadWriteOnce'
			},
			logs: {
				size: `${logsStorageSize}Gi`,
				className: logsStorageClass,
				accessMode: 'ReadWriteOnce'
			}
		};
	}

	public get controllerPort(): number {
		return this.getEndpointPort(this._controlConfig.spec.endpoints, 'Controller', 30080);
	}

	public setControllerEndpoint(port: number, dnsName?: string) {
		this.setEndpoint(this._controlConfig.spec.endpoints, 'Controller', port, dnsName);
	}

	public get serviceProxyPort(): number {
		return this.getEndpointPort(this._controlConfig.spec.endpoints, 'ServiceProxy', 30080);
	}

	public setServiceProxyEndpoint(port: number, dnsName?: string) {
		this.setEndpoint(this._controlConfig.spec.endpoints, 'ServiceProxy', port, dnsName);
	}

	public get appServiceProxyPort(): number {
		return this.getEndpointPort(this._bdcConfig.spec.resources.appproxy.spec.endpoints, 'AppServiceProxy', 30777);
	}

	public setAppServiceProxyEndpoint(port: number, dnsName?: string) {
		this.setEndpoint(this._bdcConfig.spec.resources.appproxy.spec.endpoints, 'AppServiceProxy', port, dnsName);
	}

	public get sqlServerPort(): number {
		return this.getEndpointPort(this._bdcConfig.spec.resources.master.spec.endpoints, 'Master', 31433);
	}

	public setSqlServerEndpoint(port: number, dnsName?: string) {
		this.setEndpoint(this._bdcConfig.spec.resources.master.spec.endpoints, 'Master', port, dnsName);
	}

	public get sqlServerReadableSecondaryPort(): number {
		return this.getEndpointPort(this._bdcConfig.spec.resources.master.spec.endpoints, 'MasterSecondary', 31436);
	}

	public setSqlServerReadableSecondaryEndpoint(port: number, dnsName?: string) {
		this.setEndpoint(this._bdcConfig.spec.resources.master.spec.endpoints, 'MasterSecondary', port, dnsName);
	}

	public get gatewayPort(): number {
		return this.getEndpointPort(this._bdcConfig.spec.resources.gateway.spec.endpoints, 'Knox', 30443);
	}

	public setGatewayEndpoint(port: number, dnsName?: string) {
		this.setEndpoint(this._bdcConfig.spec.resources.gateway.spec.endpoints, 'Knox', port, dnsName);
	}

	public addSparkResource(replicas: number): void {
		this._bdcConfig.spec.resources[SparkResource] = {
			metadata: {
				kind: 'Pool',
				name: 'default'
			},
			spec: {
				type: 'Spark',
				replicas: replicas
			}
		};

		this._bdcConfig.spec.services.spark.resources.push(SparkResource);
		this._bdcConfig.spec.services.hdfs.resources.push(SparkResource);
	}

	public get activeDirectorySupported(): boolean {
		// The profiles that highlight the AD authentication feature will have a security secion in the control.json for the AD settings.
		return 'security' in this._controlConfig;
	}

	public setAuthenticationMode(mode: string): void {
		// If basic authentication is picked, the security section must be removed
		// otherwise azdata will throw validation error
		if (mode === AuthenticationMode.Basic && 'security' in this._controlConfig) {
			delete this._controlConfig.security;
		}
	}

	public setActiveDirectorySettings(adSettings: ActiveDirectorySettings): void {
		const activeDirectoryObject: any = {};
		activeDirectoryObject.ouDistinguishedName = adSettings.organizationalUnit;
		activeDirectoryObject.dnsIpAddresses = this.splitByComma(adSettings.dnsIPAddresses);
		activeDirectoryObject.domainControllerFullyQualifiedDns = this.splitByComma(adSettings.domainControllerFQDNs.toLowerCase());
		activeDirectoryObject.domainDnsName = adSettings.domainDNSName;
		activeDirectoryObject.subdomain = adSettings.subdomain;
		activeDirectoryObject.accountPrefix = adSettings.accountPrefix;
		activeDirectoryObject.realm = adSettings.realm ?? adSettings.domainDNSName.toUpperCase();
		activeDirectoryObject.clusterAdmins = this.splitByComma(adSettings.clusterAdmins);
		activeDirectoryObject.clusterUsers = this.splitByComma(adSettings.clusterUsers);
		if (adSettings.appReaders) {
			activeDirectoryObject.appReaders = this.splitByComma(adSettings.appReaders);
		}
		if (adSettings.appOwners) {
			activeDirectoryObject.appOwners = this.splitByComma(adSettings.appOwners);
		}

		this._controlConfig.security.activeDirectory = activeDirectoryObject;
	}

	public getBdcJson(readable: boolean = true): string {
		return this.stringifyJson(this._bdcConfig, readable);
	}

	public getControlJson(readable: boolean = true): string {
		return this.stringifyJson(this._controlConfig, readable);
	}

	private stringifyJson(obj: any, readable: boolean): string {
		return JSON.stringify(obj, undefined, readable ? 4 : 0);
	}

	private getReplicas(resourceName: string): number {
		return <number>this._bdcConfig.spec.resources[resourceName].spec.replicas;
	}

	private setReplicas(resourceName: string, replicas: number): void {
		this._bdcConfig.spec.resources[resourceName].spec.replicas = replicas;
	}

	private getEndpointPort(endpoints: ServiceEndpoint[], name: EndpointName, defaultValue: number): number {
		const endpoint = endpoints.find(endpoint => endpoint.name === name);
		return endpoint ? endpoint.port : defaultValue;
	}

	private setEndpoint(endpoints: ServiceEndpoint[], name: EndpointName, port: number, dnsName?: string): void {
		const endpoint = endpoints.find(endpoint => endpoint.name === name);
		if (endpoint) {
			endpoint.port = port;
			endpoint.dnsName = dnsName;
		} else {
			const newEndpoint: ServiceEndpoint = {
				name: name,
				serviceType: 'NodePort',
				port: port
			};
			// for newly added endpoint, we cannot have blank value for the dnsName, only set it if it is not empty
			if (dnsName) {
				newEndpoint.dnsName = dnsName;
			}
			endpoints.push(newEndpoint);
		}
	}

	private splitByComma(value: string): string[] {
		// split by comma, then remove trailing spaces for each item and finally remove the empty values.
		return value.split(',').map(v => v && v.trim()).filter(v => v !== '' && v !== undefined);
	}
}
