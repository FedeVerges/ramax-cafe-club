#Requires -Version 7.2
#Requires -RunAsAdministrator
param(
  [string]$HostName = $env:COMPUTERNAME.ToLower(),
  [int]$Port = 3443,
  [string]$BackupDirectory = "C:\ProgramData\Ramax\backups",
  [string]$PostgresBin = "C:\Program Files\PostgreSQL\17\bin"
)
$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$config = Join-Path $projectRoot ".env.production"
if (!(Test-Path $config)) { throw "Creá .env.production siguiendo docs/OPERACION_WINDOWS.md antes de instalar." }
if (!(Test-Path "$projectRoot\apps\api\dist\apps\api\src\main.js")) { throw "Ejecutá corepack pnpm build antes de instalar." }
if (!(Test-Path "$PostgresBin\pg_dump.exe")) { throw "No se encuentra PostgreSQL 17 en PostgresBin." }
$runtime = "C:\ProgramData\Ramax"
New-Item -ItemType Directory -Force -Path $runtime, $BackupDirectory, "$runtime\tls", "$runtime\logs" | Out-Null
$certFile = "$runtime\tls\server.crt"
$keyFile = "$runtime\tls\server.key"
if (!(Test-Path $certFile)) {
  $cert = New-SelfSignedCertificate -DnsName $HostName, "localhost" -CertStoreLocation "Cert:\LocalMachine\My" -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(3)
  [IO.File]::WriteAllText($certFile, $cert.ExportCertificatePem())
  $rsa = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)
  try { [IO.File]::WriteAllText($keyFile, $rsa.ExportPkcs8PrivateKeyPem()) } finally { $rsa.Dispose() }
  Export-Certificate -Cert $cert -FilePath "$runtime\tls\ramax-public.cer" | Out-Null
  Import-Certificate -FilePath "$runtime\tls\ramax-public.cer" -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null
}
$settings = @{
  NODE_ENV = "production"; PORT = "$Port"; WEB_ORIGIN = "https://${HostName}:$Port";
  WEB_DIST_DIR = "$projectRoot\apps\web\dist"; MIGRATIONS_DIR = "$projectRoot\db\migrations";
  BACKUP_DIR = $BackupDirectory; PG_BIN_DIR = $PostgresBin;
  TLS_CERT_FILE = $certFile; TLS_KEY_FILE = $keyFile;
  NODE_EXTRA_CA_CERTS = $certFile; RECOVERY_HEALTH_URL = "https://localhost:$Port/api/v1/health"
}
$content = @(Get-Content $config | Where-Object { $line = $_; !($settings.Keys | Where-Object { $line -match "^$($_)=" }) })
foreach ($name in $settings.Keys) { $content += "$name='$($settings[$name])'" }
[IO.File]::WriteAllLines($config, $content)
# Restrict secrets and writable recovery files to service and administrators.
& icacls $config /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:F' '*S-1-5-19:R' | Out-Null
& icacls "$runtime\tls" /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' '*S-1-5-19:(OI)(CI)R' | Out-Null
& icacls $BackupDirectory /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' '*S-1-5-19:(OI)(CI)M' | Out-Null
& icacls "$runtime\logs" /grant '*S-1-5-19:(OI)(CI)M' | Out-Null
& icacls $projectRoot /grant '*S-1-5-19:(OI)(CI)RX' | Out-Null
$principal = New-ScheduledTaskPrincipal -UserId "S-1-5-19" -LogonType ServiceAccount
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
foreach ($kind in @("api", "recovery")) {
  $entry = if ($kind -eq "api") { "main.js" } else { "recovery-worker.js" }
  $arguments = "--env-file=`"$config`" `"$projectRoot\apps\api\dist\apps\api\src\$entry`""
  $action = New-ScheduledTaskAction -Execute $nodeExe -Argument $arguments -WorkingDirectory $projectRoot
  Register-ScheduledTask -TaskName "Ramax-$kind" -Action $action -Trigger $trigger -Settings $taskSettings -Principal $principal -Force | Out-Null
  Start-ScheduledTask -TaskName "Ramax-$kind"
}
if (!(Get-NetFirewallRule -DisplayName "Ramax local HTTPS" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "Ramax local HTTPS" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private -RemoteAddress LocalSubnet | Out-Null
}
Write-Output "Ramax: https://${HostName}:$Port. Instalá ramax-public.cer en los dispositivos del personal. Nunca copies server.key."
