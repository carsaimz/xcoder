# Windows code signing — XCoder desktop

The Windows installer (`XCoder-setup.exe`) and the portable exe can be
signed automatically in CI. Signing removes the SmartScreen
"Unknown publisher" warning and lets Windows verify the binary has not
been tampered with since release.

## How it works

`desktop.yml` checks two repository secrets before building:

| Secret | Content |
| --- | --- |
| `WINDOWS_CSC_LINK` | Your code-signing certificate, **base64-encoded PFX** (`.pfx`/`.p12`) |
| `WINDOWS_CSC_KEY_PASSWORD` | The PFX private-key password |

* Secrets **set** → `electron-builder` signs both Windows artifacts with
  signtool (SHA-256) during the build. Nothing else changes.
* Secrets **absent** → the unsigned build path runs. CI never fails
  because of a missing certificate.

`electron-builder.yml` carries the matching configuration
(`signingHashAlgorithms: [sha256]`, `forceCodeSigning: false`).

## Getting a certificate

1. Buy an **OV or EV Code Signing Certificate** (Sectigo, DigiCert,
   GlobalSign, Certum…). OV certificates ship as a PFX file; EV
   certificates use a hardware token or a cloud HSM (see below).
2. Export the certificate to PFX if your CA gave you separate
   `.crt`/`.key` files:

   ```bash
   openssl pkcs12 -export -out xcoder-codesign.pfx \
     -inkey private.key -in certificate.crt -certfile ca-bundle.crt
   ```

3. Base64-encode it (the value goes into the secret):

   ```bash
   base64 -w0 xcoder-codesign.pfx   # Linux/macOS
   certutil -encode xcoder-codesign.pfx encoded.txt   # Windows (copy the block between BEGIN/END)
   ```

4. On GitHub: **Settings → Secrets and variables → Actions → New
   repository secret** — add `WINDOWS_CSC_LINK` (the base64 string) and
   `WINDOWS_CSC_KEY_PASSWORD`.
5. Re-run the **Desktop** workflow (Actions → Desktop → Run
   workflow, tick *Attach artifacts to release*). The release now
   carries signed exes.

## Verifying a signed release

On any Windows machine:

```powershell
Get-AuthenticodeSignature .\XCoder-1.8.23-setup.exe | FormatList
# Status should be "Valid"; check the signer and timestamp
signtool verify /pa /all .\XCoder-1.8.23-setup.exe
```

## EV certificates / cloud signing (optional)

electron-builder also supports:

* **Azure Trusted Signing** — set `win.azureSignConfig` in
  `desktop/electron-builder.yml` and provide the Azure secrets; or
* **Hardware-token EV certs** — signing must happen on a machine with
  the token; use a self-hosted runner or sign manually:

  ```powershell
  signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 ^
    /a XCoder-setup.exe
  ```

## Timestamping

CI signs with an RFC 3161 timestamp by default when the PFX route is
used (`signtoolOptions.timeStampServer` can override it in
`electron-builder.yml`). Timestamps keep signatures valid after the
certificate expires — do not remove them.
