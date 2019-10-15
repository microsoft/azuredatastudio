/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const SqlServerMasterResource = 'master';
export const DataResource = 'data-0';
export const HdfsResource = 'storage-0';
export const ComputeResource = 'compute-0';
export const NameNodeResource = 'nmnode-0';
export const SparkHeadResource = 'sparkhead';
export const ZooKeeperResource = 'zookeeper';
export const SparkResource = 'spark-0';
export const HadrEnabledSetting = 'hadr.enabled';

interface ServiceEndpoint {
	port: number;
	serviceType: ServiceType;
	name: EndpointName;
}
type ServiceType = 'NodePort' | 'LoadBalancer';
type EndpointName = 'Controller' | 'Master' | 'Knox' | 'MasterSecondary';

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

	public get hadrEnabled(): boolean {
		const value = this._bdcConfig.spec.resources[SqlServerMasterResource].spec.settings.sql[HadrEnabledSetting];
		return value === true || value === 'true';
	}

	public set hadrEnabled(value: boolean) {
		this._bdcConfig.spec.resources[SqlServerMasterResource].spec.settings.sql[HadrEnabledSetting] = value;
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
		this.bdcConfig.spec.resources[resourceName]['storage'] = {
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

	public set controllerPort(port: number) {
		this.setEndpointPort(this._controlConfig.spec.endpoints, 'Controller', port);
	}

	public get sqlServerPort(): number {
		return this.getEndpointPort(this._bdcConfig.spec.resources.master.spec.endpoints, 'Master', 31433);
	}

	public set sqlServerPort(port: number) {
		this.setEndpointPort(this._bdcConfig.spec.resources.master.spec.endpoints, 'Master', port);
	}

	public get sqlServerReadableSecondaryPort(): number {
		return this.getEndpointPort(this._bdcConfig.spec.resources.master.spec.endpoints, 'MasterSecondary', 31436);
	}

	public set sqlServerReadableSecondaryPort(port: number) {
		this.setEndpointPort(this._bdcConfig.spec.resources.master.spec.endpoints, 'MasterSecondary', port);
	}

	public get gatewayPort(): number {
		return this.getEndpointPort(this._bdcConfig.spec.resources.gateway.spec.endpoints, 'Knox', 30443);
	}

	public set gatewayPort(port: number) {
		this.setEndpointPort(this._bdcConfig.spec.resources.gateway.spec.endpoints, 'Knox', port);
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
		// TODO: Implement AD authentication
		return false;
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

	private setEndpointPort(endpoints: ServiceEndpoint[], name: EndpointName, port: number): void {
		const endpoint = endpoints.find(endpoint => endpoint.name === name);
		if (endpoint) {
			endpoint.port = port;
		} else {
			endpoints.push({
				name: name,
				serviceType: 'NodePort',
				port: port
			});
		}
	}
}
