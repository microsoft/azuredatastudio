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
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace ADPControl
{
    public static class StorageActivity
    {
        private const string ArmTemplateFileName = "template.json";

        [FunctionName(nameof(GettingJobContainerUrl))]
        public static string GettingJobContainerUrl([ActivityTrigger] (Guid, string, string, string) input, ILogger log)
        {
            Guid SubscriptionId = input.Item1;
            String ResourceGroupName = input.Item2;
            String StorageAccountName = input.Item3;
            String ContainerName = input.Item4;

            var azureServiceTokenProvider = new AzureServiceTokenProvider();
            TokenCredentials tokenArmCredential = new TokenCredentials(azureServiceTokenProvider.GetAccessTokenAsync("https://management.core.windows.net/").Result);
            StorageManagementClient storageMgmtClient = new StorageManagementClient(tokenArmCredential) { SubscriptionId = SubscriptionId.ToString() };

            // Get the storage account keys for a given account and resource group
            IList<StorageAccountKey> acctKeys = storageMgmtClient.StorageAccounts.ListKeys(ResourceGroupName, StorageAccountName).Keys;

            // Get a Storage account using account creds:
            StorageCredentials storageCred = new StorageCredentials(StorageAccountName, acctKeys.FirstOrDefault().Value);
            CloudStorageAccount linkedStorageAccount = new CloudStorageAccount(storageCred, true);

            bool createContainer = false;
            // Normalize the container name for the Export action.
            if (ContainerName.Contains("-Export-"))
            {
                ContainerName = ContainerName.Replace("Export-", "");
                createContainer = true;
            }

            CloudBlobContainer container = linkedStorageAccount.CreateCloudBlobClient().GetContainerReference(ContainerName);

            if(createContainer) 
                container.CreateIfNotExistsAsync().Wait();

            string containerUrl = container.Uri.ToString() +
                                        container.GetSharedAccessSignature(new SharedAccessBlobPolicy()
                                        {
                                            Permissions = SharedAccessBlobPermissions.Write | SharedAccessBlobPermissions.Read | SharedAccessBlobPermissions.List,
                                            SharedAccessExpiryTime = DateTime.UtcNow.AddDays(7)
                                        });
            return containerUrl;
        }

        [FunctionName(nameof(UploadingArmTemplate))]
        public static void UploadingArmTemplate([ActivityTrigger] (string, string) input, ILogger log)
        {
            string containerUrl = input.Item1;
            string json = input.Item2;

            CloudBlobContainer container = new CloudBlobContainer(new Uri(containerUrl));
            CloudBlockBlob blob = container.GetBlockBlobReference(ArmTemplateFileName);
            blob.Properties.ContentType = "application/json";
            using (Stream stream = new MemoryStream(Encoding.UTF8.GetBytes(json)))
            {
                blob.UploadFromStreamAsync(stream).Wait();
            }
        }
    }
}
