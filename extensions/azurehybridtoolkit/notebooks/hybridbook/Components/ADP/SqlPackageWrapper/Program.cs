using Microsoft.Azure.Batch.Conventions.Files;
using Microsoft.WindowsAzure.Storage.Blob;
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace SqlPackageWrapper
{
    public static class Program
    {
        private static string dataDirectory = "F:\\data";
        private static string tempDirectory = "F:\\temp";
        private static string[] directories = { dataDirectory, tempDirectory };

        private static readonly TimeSpan stdoutFlushDelay = TimeSpan.FromSeconds(3);

        private static void WriteLine(string message) => WriteLineInternal(Console.Out, message);
        private static void WriteErrorLine(string message) => WriteLineInternal(Console.Error, message);
        private static void WriteLineInternal(TextWriter writer, string message)
        {
            var lines = message?.Split('\n') ?? new string[0];
            foreach (var line in lines)
            {
                writer.WriteLine($"[{DateTime.UtcNow:u}] {line?.TrimEnd()}");
            }
        }

        public static async Task<int> Main(string[] args)
        {
            var assembly = typeof(Program).Assembly;
            WriteLine($"{assembly.ManifestModule.Name} v{assembly.GetName().Version.ToString(3)}");

            // Get the command payload 
            var payload = new Payload();

            if (args.Length > 0)
            {
                payload.Action = (ActionType)Enum.Parse(typeof(ActionType), args[0]);
                payload.LogicalServerName = args[1] + ".database.windows.net";
                payload.DatabaseName = args[2];
                payload.Username = args[3];
                payload.Password = args[4];
                payload.SqlPackageVersion = args[5];
            }

            // Cleanup folders
            foreach (string dir in directories)
            {
                if (Directory.Exists(dir))
                {
                    Directory.Delete(dir, true);
                }

                Directory.CreateDirectory(dir);
            }

            string sqlPackageDataPath = Path.Combine(dataDirectory, payload.DatabaseName + ".bacpac");
            string sqlPackageLogPath = Path.Combine(dataDirectory, payload.DatabaseName + ".log");

            var targetDir = Environment.GetEnvironmentVariable($"{Constants.EnvironmentVariableNames.SqlPackageLocation}#{payload.SqlPackageVersion}");
            var workingDir = Environment.GetEnvironmentVariable(Constants.EnvironmentVariableNames.TaskWorkingDir);

            string taskId = Environment.GetEnvironmentVariable(Constants.EnvironmentVariableNames.AzBatchTaskId);
            string jobContainerUrl = Environment.GetEnvironmentVariable(Constants.EnvironmentVariableNames.JobContainerUrl);

            // Build the import/export command
            var cmdBuilder = new StringBuilder();
            cmdBuilder.Append($"/Action:{payload.Action}");
            cmdBuilder.Append(" /MaxParallelism:16");
            cmdBuilder.Append(String.Format(" /DiagnosticsFile:{0}", sqlPackageLogPath));
            cmdBuilder.Append(" /p:CommandTimeout=86400");

            switch (payload.Action)
            {
                case ActionType.Export:
                    cmdBuilder.Append($" /SourceServerName:{payload.LogicalServerName}");
                    cmdBuilder.Append($" /SourceDatabaseName:{payload.DatabaseName}");
                    cmdBuilder.Append($" /SourceUser:{payload.Username}");
                    cmdBuilder.Append($" /SourcePassword:{payload.Password}");
                    cmdBuilder.Append($" /TargetFile:{sqlPackageDataPath}");
                    cmdBuilder.Append(String.Format(" /p:TempDirectoryForTableData=\"{0}\"", tempDirectory));
                    cmdBuilder.Append(" /p:VerifyFullTextDocumentTypesSupported=false");
                    break;

                case ActionType.Import:
                    cmdBuilder.Append($" /TargetServerName:{payload.LogicalServerName}");
                    cmdBuilder.Append($" /TargetDatabaseName:{payload.DatabaseName}");
                    cmdBuilder.Append($" /TargetUser:{payload.Username}");
                    cmdBuilder.Append($" /TargetPassword:{payload.Password}");
                    cmdBuilder.Append($" /SourceFile:{sqlPackageDataPath}");
                    break;

                default:
                    throw new ArgumentException($"Invalid action type: {payload.Action}");
            }

            if (payload.Action == ActionType.Import)
            {
                WriteLine(string.Format("Downloading {0} bacpac file to {1}", payload.DatabaseName, sqlPackageDataPath));
                CloudBlobContainer container = new CloudBlobContainer(new Uri(jobContainerUrl));
                CloudBlockBlob blob = container.GetBlockBlobReference(String.Format("$JobOutput/{0}.bacpac", payload.DatabaseName));
                await blob.DownloadToFileAsync(sqlPackageDataPath, FileMode.CreateNew);
                WriteLine(string.Format("Downloaded {0} bacpac file to {1}", payload.DatabaseName, sqlPackageDataPath));
                
                await Task.Delay(stdoutFlushDelay);
            }

            // Perform the import/export process
            var startTime = DateTimeOffset.UtcNow;
            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    WorkingDirectory = workingDir,
                    FileName = Path.Combine(targetDir, "sqlpackage.exe"),
                    Arguments = cmdBuilder.ToString(),
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                }
            };
            process.OutputDataReceived += (s, e) => WriteLine(e.Data);
            process.ErrorDataReceived += (s, e) => WriteErrorLine(e.Data);
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            process.WaitForExit();

            WriteLine(String.Format("SqlPackage.exe exited with code: {0}", process.ExitCode));

            if (payload.Action == ActionType.Export)
            {
                // Persist the Job Output 
                JobOutputStorage jobOutputStorage = new JobOutputStorage(new Uri(jobContainerUrl));

                await jobOutputStorage.SaveAsync(JobOutputKind.JobOutput, sqlPackageLogPath, payload.DatabaseName + ".log");
                WriteLine(String.Format("Uploaded {0} to job account", sqlPackageLogPath));

                await jobOutputStorage.SaveAsync(JobOutputKind.JobOutput, sqlPackageDataPath, payload.DatabaseName + ".bacpac");
                WriteLine(String.Format("Uploaded {0} to job account", sqlPackageDataPath));

                // We are tracking the disk file to save our standard output, but the node agent may take
                // up to 3 seconds to flush the stdout stream to disk. So give the file a moment to catch up.
                await Task.Delay(stdoutFlushDelay);
            }

            // Cleanup folders
            foreach (string dir in directories)
            {
                if (Directory.Exists(dir))
                {
                    Directory.Delete(dir, true);
                }
            }

            return process.ExitCode;
        }
    }
}
