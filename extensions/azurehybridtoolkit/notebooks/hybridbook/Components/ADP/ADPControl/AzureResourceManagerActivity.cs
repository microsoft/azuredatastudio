using Microsoft.Azure.Management.ResourceManager;
using Microsoft.Azure.Management.ResourceManager.Models;
using Microsoft.Azure.Management.Storage;
using Microsoft.Azure.Management.Storage.Models;
using Microsoft.Azure.Services.AppAuthentication;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using Microsoft.Extensions.Logging;
using Microsoft.Rest;
using Microsoft.WindowsAzure.Storage;
using Microsoft.WindowsAzure.Storage.Auth;
using Microsoft.WindowsAzure.Storage.Blob;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using static ADPControl.HttpSurface;

namespace ADPControl
{
    public static class AzureResourceManagerActivity
    {
        private const string ArmTemplateFileName = "template.json";

        private static string[] AllowedImportSubServerResourceTypes = new string[] { 
            "Microsoft.Sql/servers/firewallRules",
            "Microsoft.Sql/servers/databases",
            "Microsoft.Sql/servers/elasticPools",
            //"Microsoft.Sql/servers/keys",
            //"Microsoft.Sql/servers/databases/transparentDataEncryption",
            "Microsoft.Sql/servers/databases/backupShortTermRetentionPolicies",
            "Microsoft.Sql/servers/administrators"
        };

        // Deploy the ARM template
        [FunctionName(nameof(BeginDeployArmTemplateForImport))]
        public static async Task<string> BeginDeployArmTemplateForImport([ActivityTrigger] ImportRequest request, ILogger log)
        {
            var azureServiceTokenProvider = new AzureServiceTokenProvider();
            TokenCredentials tokenArmCredential = new TokenCredentials(await azureServiceTokenProvider.GetAccessTokenAsync("https://management.core.windows.net/"));

            ResourceManagementClient resourcesClient = new ResourceManagementClient(tokenArmCredential) { SubscriptionId = request.SubscriptionId.ToString() };
            StorageManagementClient storageMgmtClient = new StorageManagementClient(tokenArmCredential) { SubscriptionId = request.SubscriptionId.ToString() };

            // Get the storage account keys for a given account and resource group
            IList<StorageAccountKey> acctKeys = storageMgmtClient.StorageAccounts.ListKeys(request.ResourceGroupName, request.StorageAccountName).Keys;

            // Get a Storage account using account creds:
            StorageCredentials storageCred = new StorageCredentials(request.StorageAccountName, acctKeys.FirstOrDefault().Value);
            CloudStorageAccount linkedStorageAccount = new CloudStorageAccount(storageCred, true);
            CloudBlobContainer container = linkedStorageAccount
                                                .CreateCloudBlobClient()
                                                .GetContainerReference(request.ContainerName);

            CloudBlockBlob blob = container.GetBlockBlobReference(ArmTemplateFileName);
            string json = await blob.DownloadTextAsync();

            JObject originalTemplate = JObject.Parse(json);
            JObject importTemplate = UpdateArmTemplateForImport(originalTemplate, request);

            var deployParams = new Deployment
            {
                Properties = new DeploymentProperties
                {
                    Mode = DeploymentMode.Incremental,
                    Template = importTemplate
                }
            };

            string deploymentName = request.TargetSqlServerName + "_" + DateTime.UtcNow.ToFileTimeUtc();

            try
            {
                await resourcesClient.Deployments.BeginCreateOrUpdateAsync(request.TargetSqlServerResourceGroupName, deploymentName, deployParams);                
            }
            catch (Exception ex)
            {
                log.LogError(ex.ToString());
                throw ex;
            }

            return deploymentName;
        }

        // Get the ARM deployment status
        [FunctionName(nameof(GetArmDeploymentForImport))]
        public static async Task<string> GetArmDeploymentForImport([ActivityTrigger] (Guid, string, string) input)
        {
            Guid subscriptionId = input.Item1;
            string resourceGroupName = input.Item2;
            string deploymentName = input.Item3;

            var azureServiceTokenProvider = new AzureServiceTokenProvider();
            TokenCredentials tokenArmCredential = new TokenCredentials(await azureServiceTokenProvider.GetAccessTokenAsync("https://management.core.windows.net/"));
            ResourceManagementClient resourcesClient = new ResourceManagementClient(tokenArmCredential) { SubscriptionId = subscriptionId.ToString() };

            DeploymentExtended result = await resourcesClient.Deployments.GetAsync(resourceGroupName, deploymentName);
            return result.Properties.ProvisioningState;
        }

        // Get the ARM template without the parameter of the resource name
        [FunctionName(nameof(GetArmTemplateForExportSkipParameterization))]
        public static async Task<dynamic> GetArmTemplateForExportSkipParameterization([ActivityTrigger] ExportRequest request, ILogger log)
        {
            log.LogInformation("GetArmTemplateForExportSkipParameterization: entering");

            var azureServiceTokenProvider = new AzureServiceTokenProvider();
            TokenCredentials tokenArmCredential = new TokenCredentials(await azureServiceTokenProvider.GetAccessTokenAsync("https://management.core.windows.net/"));
            if (tokenArmCredential != null)
            {
                log.LogInformation("GetArmTemplateForExportSkipParameterization: acquired access token");
                ResourceManagementClient resourcesClient = new ResourceManagementClient(tokenArmCredential) { SubscriptionId = request.SubscriptionId.ToString() };

                string sourceSqlServerResourceId = string.Format("/subscriptions/{0}/resourceGroups/{1}/providers/Microsoft.Sql/servers/{2}", request.SubscriptionId, request.SourceSqlServerResourceGroupName, request.SourceSqlServerName);
                ResourceGroupExportResult exportedTemplate = resourcesClient.ResourceGroups.ExportTemplate(request.SourceSqlServerResourceGroupName, new ExportTemplateRequest(new List<string> { sourceSqlServerResourceId }, "SkipResourceNameParameterization"));

                log.LogInformation("GetArmTemplateForExportSkipParameterization: server template exported.  Size: {0} bytes", exportedTemplate.Template.ToString().Length);
                dynamic template = (dynamic)exportedTemplate.Template;

                // Filtering the list of databases
                dynamic databases = template.resources.SelectTokens("$.[?(@.type == 'Microsoft.Sql/servers/databases')]");
                int numberOfDatabases = 0;
                foreach (var db in databases)
                {
                    numberOfDatabases++;
                }
                log.LogInformation("GetArmTemplateForExportSkipParameterization: exiting with database list.  Databases count: {0}", numberOfDatabases);

                return databases;
            }

            log.LogInformation("GetArmTemplateForExportSkipParameterization: exiting with empty database list");
            return null;
        }

        // Get the ARM template without the parameter of the resource name
        [FunctionName(nameof(GetArmTemplateForImportSkipParameterization))]
        public static async Task<dynamic> GetArmTemplateForImportSkipParameterization([ActivityTrigger] ImportRequest request, ILogger log)
        {
            var azureServiceTokenProvider = new AzureServiceTokenProvider();
            TokenCredentials tokenArmCredential = new TokenCredentials(await azureServiceTokenProvider.GetAccessTokenAsync("https://management.core.windows.net/"));
            if (tokenArmCredential != null)
            {
                log.LogInformation("GetArmTemplateForImportSkipParameterization: acquired access token");
                ResourceManagementClient resourcesClient = new ResourceManagementClient(tokenArmCredential) { SubscriptionId = request.SubscriptionId.ToString() };

                string sourceSqlServerResourceId = string.Format("/subscriptions/{0}/resourceGroups/{1}/providers/Microsoft.Sql/servers/{2}", request.SubscriptionId, request.TargetSqlServerResourceGroupName, request.TargetSqlServerName);
                ResourceGroupExportResult exportedTemplate = resourcesClient.ResourceGroups.ExportTemplate(request.TargetSqlServerResourceGroupName, new ExportTemplateRequest(new List<string> { sourceSqlServerResourceId }, "SkipResourceNameParameterization"));
                
                log.LogInformation("GetArmTemplateForImportSkipParameterization: server template exported.  Size: {0} bytes", exportedTemplate.Template.ToString().Length);
                dynamic template = (dynamic)exportedTemplate.Template;

                // Filtering the list of databases
                dynamic databases = template.resources.SelectTokens("$.[?(@.type == 'Microsoft.Sql/servers/databases')]");
                
                int numberOfDatabases = 0;
                foreach (var db in databases)
                {
                    numberOfDatabases++;
                }
                log.LogInformation("GetArmTemplateForExportSkipParameterization: exiting with database list.  Databases count: {0}", numberOfDatabases);
                return databases;
            }

            return null;
        }

        [FunctionName(nameof(GetArmTemplateForExport))]
        public static async Task<dynamic> GetArmTemplateForExport([ActivityTrigger] ExportRequest request)
        {
            var azureServiceTokenProvider = new AzureServiceTokenProvider();
            TokenCredentials tokenArmCredential = new TokenCredentials(await azureServiceTokenProvider.GetAccessTokenAsync("https://management.core.windows.net/"));

            ResourceManagementClient resourcesClient = new ResourceManagementClient(tokenArmCredential) { SubscriptionId = request.SubscriptionId.ToString() };

            string sourceSqlServerResourceId = string.Format("/subscriptions/{0}/resourceGroups/{1}/providers/Microsoft.Sql/servers/{2}", request.SubscriptionId, request.SourceSqlServerResourceGroupName, request.SourceSqlServerName);
            ResourceGroupExportResult exportedTemplate = resourcesClient.ResourceGroups.ExportTemplate(request.SourceSqlServerResourceGroupName, new ExportTemplateRequest(new List<string> { sourceSqlServerResourceId }, "IncludeParameterDefaultValue"));
            return exportedTemplate.Template;
        }

        private static JObject UpdateArmTemplateForImport(JObject originalTemplate, ImportRequest request)
        {
            string serverNameParameterName = null;

            // Go through every parameter to find the property name is like 'server_%_name'
            using (JsonTextReader reader = new JsonTextReader(new StringReader(originalTemplate["parameters"].ToString())))
            {
                while (reader.Read())
                {
                    if (reader.TokenType.ToString().Equals("PropertyName")
                       && reader.ValueType.ToString().Equals("System.String")
                       && reader.Value.ToString().StartsWith("servers_")
                       && reader.Value.ToString().EndsWith("_name"))
                    {
                        serverNameParameterName = reader.Value.ToString();
                        break;
                    }
                }
            }

            // 1. Replacing the default value to the target server name, appending to the new template
            originalTemplate["parameters"][serverNameParameterName]["defaultValue"] = request.TargetSqlServerName;
            JObject serverNameParameterValue = (JObject)originalTemplate["parameters"][serverNameParameterName];

            // 2. Cleanup all the parameters except the updated server name
            ((JObject)originalTemplate["parameters"]).RemoveAll();
            ((JObject)originalTemplate["parameters"]).Add(serverNameParameterName, serverNameParameterValue);

            // 3. Adjust the servers resource by adding password after the login
            JObject server = (JObject)originalTemplate["resources"]
                .SelectToken("$.[?(@.type == 'Microsoft.Sql/servers')]");

            server.Remove("identity");

            JObject serverProperties = (JObject)server["properties"];
            serverProperties.Property("administratorLogin")
                .AddAfterSelf(new JProperty("administratorLoginPassword", request.SqlAdminPassword));

            JArray newResources = new JArray();

            // 4. Getting the whitelisted resources and adding them to the new template later.
            foreach (string resourceType in AllowedImportSubServerResourceTypes)
            {
                List<JToken> resources = originalTemplate["resources"]
                    .SelectTokens(string.Format("$.[?(@.type == '{0}')]", resourceType)).ToList();
                newResources.Add(resources);
            }

            // 5. Clean up all the resources excepted the new server and whitelisted resource type.
            ((JArray)originalTemplate["resources"]).Clear();
            ((JArray)originalTemplate["resources"]).Add(server);

            foreach (var resource in newResources)
            {
                ((JArray)originalTemplate["resources"]).Add(resource);
            }

            return originalTemplate;
        }
    }
}
