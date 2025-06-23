# External PDF
![external-pdf-logo](https://github.com/user-attachments/assets/6ad69920-dc8e-45cb-b6c8-5b0f03e2d2fb)

**Embed external PDFs directly into your notes with full viewer controls.**

This plugin lets you embed PDF files hosted online in your Obsidian notes without storing them in your vault. It also allows embedding from local files: either relative to the Obsidian vault or by absolute path (desktop only). It works on mobile devices, too.

![external-pdf-splash |300](https://github.com/user-attachments/assets/16a41a89-adc3-4470-8b61-f21d84998a15)

## How To Use
### For External PDFs (HTTPS URLs):
````
```external-pdf
https://example.com/document.pdf
title: My Online PDF Document
heght: 500px
```
````
### For Local PDFs in Your Vault (relative path from vault root)
````
```external-pdf
Attachements/MyLocalDocument.pdf
title: My Vault PDF Document
heght: 400px
```
````
### For Local PDFs via Absolute Path (desktop only & requires enabling in settings)
````
```external-pdf
/Users/YourName/Documents/AbsolutePathDocument.pdf
title: Absolute Path PDF
heght: 900px
```
````
## Supported Options
- **title:** display name for the PDF
- **height:** viewer height (eg. 600px, 80vh, 400, 20%)

## Supported Sources
- local PDF files relative to your Obsidian vault
- local PDF files via absolute path (eg. */mnt/data/report.pdf*) - **this is only possible on desktop and requires enabling in settings**.
- Google Drive (sharing links)
- Dropbox (sharing links)
- OneDrive (sharing links)
- GitHub (raw PDF files)
- any direct Https PDF url (for example, one shared by Paperless-NGX)

## Features
- Mobile-optimised with touch gestures (for URLs and vault files).
- Keyboard navigation (arrows, space, +/-, zoom).
- Page comtrols and zoom optons.
- Fit-to-width mode.
- Pinch-to-Zoom on moble.
- Swipe gestures for page navigation.
- Security: the ability to restrict domains (for external URLs)

## Settings
Once the plugin has been enabled there are various settings that can be changed:
![settings-for-external-pdf-embed](https://github.com/user-attachments/assets/04731354-27f0-4f98-9a5e-ba49a813fb8a)

## License
MIT
