$r = Invoke-WebRequest -Uri 'https://resume.uchitparashar.in/sitemap.xml' -UseBasicParsing
Write-Output "Status: $($r.StatusCode)"
Write-Output "Cache-Control: $($r.Headers['Cache-Control'])"
Write-Output "X-Robots-Tag: $($r.Headers['X-Robots-Tag'])"
Write-Output "Content-Type: $($r.Headers['Content-Type'])"
