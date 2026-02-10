param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [Parameter(Mandatory = $true)][string]$Token,
  [string]$Status = "live",
  [string]$Title = "Chip Lee Live Now",
  [string]$StreamUrl = "https://theperforma.com/live",
  [string]$Platform = "youtube",
  [bool]$SendEmail = $true,
  [bool]$SendSms = $true,
  [string]$Operator = "chip-lee"
)

$uri = "https://$ProjectRef.functions.supabase.co/go-live-blast"
$payload = @{
  status = $Status
  title = $Title
  streamUrl = $StreamUrl
  platform = $Platform
  sendEmail = $SendEmail
  sendSms = $SendSms
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri $uri `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{
    Authorization = "Bearer $Token"
    "x-operator" = $Operator
  } `
  -Body $payload

