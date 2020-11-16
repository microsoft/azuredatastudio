using Microsoft.Azure.Batch;
using Microsoft.Azure.Batch.Auth;
using Microsoft.Azure.Batch.Common;
using Microsoft.Azure.Services.AppAuthentication;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using static ADPControl.HttpSurface;

namespace ADPControl
{
    public static class BatchActivity
    {
        // Batch resource settings
        private const string PoolVMSize = "Standard_D8s_v3";
        private const string PoolId = PoolVMSize;
        private const int PoolNodeCount = 2;
        private const string AppPackageName = "SqlPackageWrapper";
        public const string AppPackageVersion = "1";

        [FunctionName(nameof(CreateBatchPoolAndExportJob))]
        public static async Task<string> CreateBatchPoolAndExportJob([ActivityTrigger] ExportRequest request, ILogger log)
        {
            var azureServiceTokenProvider = new AzureServiceTokenProvider();

            // Get a Batch client using function identity
            BatchTokenCredentials batchCred = new BatchTokenCredentials(request.BatchAccountUrl, await azureServiceTokenProvider.GetAccessTokenAsync("https://batch.core.windows.net/"));

            string jobId = request.SourceSqlServerName + "-Export-" + DateTime.UtcNow.ToString("MMddHHmmss");
            using (BatchClient batchClient = BatchClient.Open(batchCred))
            {
                ImageReference imageReference = CreateImageReference();
                VirtualMachineConfiguration vmConfiguration = CreateVirtualMachineConfiguration(imageReference);

                await CreateBatchPoolIfNotExist(batchClient, vmConfiguration, request.VNetSubnetId);
                await CreateBatchJob(batchClient, jobId, log);
            }

            return jobId;
        }

        [FunctionName(nameof(CreateBatchPoolAndImportJob))]
        public static async Task<string> CreateBatchPoolAndImportJob([ActivityTrigger] ImportRequest request, ILogger log)
        {
            var azureServiceTokenProvider = new AzureServiceTokenProvider();

            // Get a Batch client using function identity
            BatchTokenCredentials batchCred = new BatchTokenCredentials(request.BatchAccountUrl, await azureServiceTokenProvider.GetAccessTokenAsync("https://batch.core.windows.net/"));

            string jobId = request.TargetSqlServerName + "-Import-" + DateTime.UtcNow.ToString("MMddHHmmss");
            using (BatchClient batchClient = BatchClient.Open(batchCred))
            {
                ImageReference imageReference = CreateImageReference();
                VirtualMachineConfiguration vmConfiguration = CreateVirtualMachineConfiguration(imageReference);

                await CreateBatchPoolIfNotExist(batchClient, vmConfiguration, request.VNetSubnetId);
                await CreateBatchJob(batchClient, jobId, log);
            }

            return jobId;
        }

        public static async Task<CloudJob> CreateBatchJob(BatchClient batchClient, string jobId, ILogger log)
        {
            // Create a Batch job
            log.LogInformation("Creating job [{0}]...", jobId);
            CloudJob job = null;

            try
            {
                job = batchClient.JobOperations.CreateJob(jobId, new PoolInformation { PoolId = PoolId });
                job.OnAllTasksComplete = OnAllTasksComplete.TerminateJob;

                // Commit the job to the Batch service
                await job.CommitAsync();

                log.LogInformation($"Created job {jobId}");

                // Obtain the bound job from the Batch service
                await job.RefreshAsync();
            }
            catch (BatchException be)
            {
                // Accept the specific error code JobExists as that is expected if the job already exists
                if (be.RequestInformation?.BatchError?.Code == BatchErrorCodeStrings.JobExists)
                {
                    log.LogWarning("The job {0} already existed when we tried to create it", jobId);
                }
                else
                {
                    log.LogError("Exception creating job: {0}", be.Message);
                    throw be; // Any other exception is unexpected
                }
            }

            return job;
        }

        // Create the Compute Pool of the Batch Account
        public static async Task CreateBatchPoolIfNotExist(BatchClient batchClient, VirtualMachineConfiguration vmConfiguration, string vnetSubnetId)
        {
            Console.WriteLine("Creating pool [{0}]...", PoolId);

            try
            {
                CloudPool pool = batchClient.PoolOperations.CreatePool(
                    poolId: PoolId,
                    targetDedicatedComputeNodes: PoolNodeCount,
                    virtualMachineSize: PoolVMSize,
                    virtualMachineConfiguration: vmConfiguration);

                // Specify the application and version to install on the compute nodes
                pool.ApplicationPackageReferences = new List<ApplicationPackageReference>
                {
                    new ApplicationPackageReference {
                        ApplicationId = AppPackageName,
                        Version = AppPackageVersion }
                };

                // Initial the first data disk for each VM in the pool
                StartTask startTask = new StartTask("cmd /c Powershell -command \"Get-Disk | Where partitionstyle -eq 'raw' | sort number | Select-Object -first 1 |" +
                    " Initialize-Disk -PartitionStyle MBR -PassThru | New-Partition -UseMaximumSize -DriveLetter F |" +
                    " Format-Volume -FileSystem NTFS -NewFileSystemLabel data1 -Confirm:$false -Force\"");

                startTask.MaxTaskRetryCount = 1;
                startTask.UserIdentity = new UserIdentity(new AutoUserSpecification(AutoUserScope.Pool, ElevationLevel.Admin));
                startTask.WaitForSuccess = true;

                pool.StartTask = startTask;

                // Create the Pool within the vnet subnet if it's specified.
                if (vnetSubnetId != null)
                {
                    pool.NetworkConfiguration = new NetworkConfiguration();
                    pool.NetworkConfiguration.SubnetId = vnetSubnetId;
                }

                await pool.CommitAsync();
                await pool.RefreshAsync();
            }
            catch (BatchException be)
            {
                // Accept the specific error code PoolExists as that is expected if the pool already exists
                if (be.RequestInformation?.BatchError?.Code == BatchErrorCodeStrings.PoolExists)
                {
                    Console.WriteLine("The pool {0} already existed when we tried to create it", PoolId);
                }
                else
                {
                    throw; // Any other exception is unexpected
                }
            }
        }

        public static VirtualMachineConfiguration CreateVirtualMachineConfiguration(ImageReference imageReference)
        {
            VirtualMachineConfiguration config = new VirtualMachineConfiguration(
                imageReference: imageReference,
                nodeAgentSkuId: "batch.node.windows amd64");

            config.DataDisks = new List<DataDisk>();
            config.DataDisks.Add(new DataDisk(0, 2048, CachingType.ReadOnly, StorageAccountType.PremiumLrs));

            return config;
        }

        public static ImageReference CreateImageReference()
        {
            return new ImageReference(
                publisher: "MicrosoftWindowsServer",
                offer: "WindowsServer",
                sku: "2019-datacenter-smalldisk",
                version: "latest");
        }

        public static void CreateBatchTasks(string action, string jobId, string containerUrl, string batchAccountUrl, string sqlServerName, string accessToken, dynamic databases, ILogger log)
        {
            // Get a Batch client using function identity
            log.LogInformation("CreateBatchTasks: entering");
            var azureServiceTokenProvider = new AzureServiceTokenProvider();
            BatchTokenCredentials batchCred = new BatchTokenCredentials(batchAccountUrl, azureServiceTokenProvider.GetAccessTokenAsync("https://batch.core.windows.net/").Result);
            using (BatchClient batchClient = BatchClient.Open(batchCred))
            {
                // For each database, submit the Exporting job to Azure Batch Compute Pool.
                log.LogInformation("CreateBatchTasks: enumerating databases");
                List<CloudTask> tasks = new List<CloudTask>();
                foreach (var db in databases)
                {
                    string serverDatabaseName = db.name.ToString();
                    string logicalDatabase = serverDatabaseName.Remove(0, sqlServerName.Length + 1);

                    log.LogInformation("CreateBatchTasks: creating task for database {0}", logicalDatabase);
                    string taskId = sqlServerName + "_" + logicalDatabase;
                    string command = string.Format("cmd /c %AZ_BATCH_APP_PACKAGE_{0}#{1}%\\BatchWrapper {2}", AppPackageName.ToUpper(), AppPackageVersion, action);
                    command += string.Format(" {0} {1} {2} {3} {4}", sqlServerName, logicalDatabase, accessToken, AppPackageName.ToUpper(), AppPackageVersion);
                    string taskCommandLine = string.Format(command);

                    CloudTask singleTask = new CloudTask(taskId, taskCommandLine);
                    singleTask.EnvironmentSettings = new[] { new EnvironmentSetting("JOB_CONTAINER_URL", containerUrl) };

                    Console.WriteLine(string.Format("Adding task {0} to job ...", taskId));
                    tasks.Add(singleTask);
                }

                // Add all tasks to the job.
                batchClient.JobOperations.AddTask(jobId, tasks);
            }
            log.LogInformation("CreateBatchTasks: exiting");
        }
    }
}
