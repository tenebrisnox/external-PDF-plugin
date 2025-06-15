// Save this entire file as: main.ts
import { Plugin, MarkdownPostProcessorContext, requestUrl, App, PluginSettingTab, Setting, TFile, Platform } from 'obsidian';

// Node.js module types - these won't be available at runtime on mobile
// but are useful for typings during development for desktop.
declare let require: any; // Allow `require` for Node.js modules on desktop

interface ExternalPDFPluginSettings {
    defaultHeight: string;
    restrictDomains: boolean;
    allowedDomains: string[];
    showPDFPreview: boolean;
    enableQuickActions: boolean;
    maxFileSize: number; // in MB
    pdfJsWorkerUrl: string;
    defaultScale: number;
    allowAbsolutePaths: boolean; // New setting
}

const DEFAULT_SETTINGS: ExternalPDFPluginSettings = {
    defaultHeight: '600px',
    restrictDomains: false,
    allowedDomains: ['drive.google.com', 'dropbox.com', 'onedrive.live.com', 'github.com'],
    showPDFPreview: true,
    enableQuickActions: true,
    maxFileSize: 50, // 50MB
    pdfJsWorkerUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    defaultScale: 1.2,
    allowAbsolutePaths: false, // Default to false for security
};

class ExternalPDFSettingTab extends PluginSettingTab {
    plugin: ExternalPDFPlugin;

    constructor(app: App, plugin: ExternalPDFPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'External PDF Plugin' });

        const infoDiv = containerEl.createEl('div', { cls: 'external-pdf-info' });
        infoDiv.innerHTML = `
            <p><strong>Embed external PDFs, local vault PDFs, and local absolute path PDFs (desktop only) directly in your notes with full viewer controls.</strong></p>

            <h3>📖 How to Use</h3>
            <p>Add a code block with <code>external-pdf</code> language and provide the source:</p>

            <p><strong>For external PDFs (HTTPS URLs):</strong></p>
            <pre><code>\`\`\`external-pdf
https://example.com/document.pdf
title: My Online Document
height: 500px
\`\`\`</code></pre>

            <p><strong>For local PDFs in your vault (relative path from vault root):</strong></p>
            <pre><code>\`\`\`external-pdf
Attachments/MyLocalDocument.pdf
title: Vault PDF
height: 400px
\`\`\`</code></pre>

            <p><strong>For local PDFs via absolute path (Desktop Only, requires enabling below):</strong></p>
            <pre><code>\`\`\`external-pdf
${Platform.isWin ? 'C:/Users/YourName/Documents/AbsoluteDoc.pdf' : '/Users/YourName/Documents/AbsoluteDoc.pdf'}
title: Absolute Path PDF
\`\`\`</code></pre>

            <h3>🔧 Supported Options</h3>
            <ul>
                <li><strong>title:</strong> Display name for the PDF</li>
                <li><strong>height:</strong> Viewer height (e.g., 600px, 80vh, 400)</li>
            </ul>

            <h3>🌐 Supported Sources</h3>
            <ul>
                <li>Local PDF files from your Obsidian vault (e.g., <code>Attachments/MyReport.pdf</code>)</li>
                <li>Local PDF files via absolute path (e.g., <code>${Platform.isWin ? 'D:\\\\Docs\\\\report.pdf' : '/mnt/data/report.pdf'}</code>) - <strong>Desktop Only, requires enabling in settings.</strong></li>
                <li>Google Drive (sharing links)</li>
                <li>Dropbox (sharing links)</li>
                <li>OneDrive (sharing links)</li>
                <li>GitHub (raw PDF files)</li>
                <li>Any direct HTTPS PDF URL</li>
            </ul>

            <h3>📱 Features</h3>
            <ul>
                <li>Mobile-optimized with touch gestures (for URLs and vault files)</li>
                <li>Keyboard navigation (arrows, space, +/- zoom)</li>
                <li>Page controls and zoom options</li>
                <li>Fit-to-width mode</li>
                <li>Pinch-to-zoom on mobile</li>
                <li>Swipe gestures for page navigation</li>
            </ul>
        `;

        containerEl.createEl('h3', { text: 'Settings' });

        new Setting(containerEl)
            .setName('Default height')
            .setDesc('Default height for PDF viewers (e.g., 600px, 70vh)')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.defaultHeight)
                .setValue(this.plugin.settings.defaultHeight)
                .onChange(async (value) => {
                    this.plugin.settings.defaultHeight = value || DEFAULT_SETTINGS.defaultHeight;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Allow absolute local file paths (Desktop Only)')
            .setDesc('Enable embedding PDFs using absolute file paths (e.g., /path/to/file.pdf or C:\\path\\to\\file.pdf). Use with caution: granting access to arbitrary file paths can have security implications if untrusted content is processed. This feature only works on Obsidian desktop.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.allowAbsolutePaths)
                .onChange(async (value) => {
                    this.plugin.settings.allowAbsolutePaths = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));
        if (this.plugin.settings.allowAbsolutePaths && !Platform.isDesktop) {
            containerEl.createEl('p', {text: 'Warning: Absolute paths are only functional on the Obsidian desktop application.', cls: 'external-pdf-warning'});
        }


        new Setting(containerEl)
            .setName('Restrict domains (for external URLs)')
            .setDesc('If enabled, only allow PDFs from specified external domains. This does not apply to local vault files or absolute path files.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.restrictDomains)
                .onChange(async (value) => {
                    this.plugin.settings.restrictDomains = value;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.restrictDomains) {
            new Setting(containerEl)
                .setName('Allowed external domains')
                .setDesc('Comma-separated list of allowed external domains (e.g., drive.google.com, dropbox.com).')
                .addTextArea(text => text
                    .setPlaceholder(DEFAULT_SETTINGS.allowedDomains.join(', '))
                    .setValue(this.plugin.settings.allowedDomains.join(', '))
                    .onChange(async (value) => {
                        this.plugin.settings.allowedDomains = value
                            .split(',')
                            .map(domain => domain.trim().toLowerCase())
                            .filter(domain => domain.length > 0);
                        await this.plugin.saveSettings();
                    }));
        }

        new Setting(containerEl)
            .setName('Maximum file size (MB)')
            .setDesc('Maximum allowed PDF file size for all sources (local vault, absolute path, external URL).')
            .addSlider(slider => slider
                .setLimits(1, 200, 5)
                .setValue(this.plugin.settings.maxFileSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxFileSize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default zoom scale')
            .setDesc('Default zoom level for PDFs (1.0 = 100%). Applies when not on mobile or fit-to-width.')
            .addSlider(slider => slider
                .setLimits(0.5, 3.0, 0.1)
                .setValue(this.plugin.settings.defaultScale)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.defaultScale = value;
                    await this.plugin.saveSettings();
                }));
    }
}

declare global {
    interface Window {
        pdfjsLib: any;
    }
}

export default class ExternalPDFPlugin extends Plugin {
    settings: ExternalPDFPluginSettings;
    private pdfJsLoaded = false;
    private loadingPromise: Promise<void> | null = null;
    private nodeFs: any = null;
    private nodePath: any = null;

    async onload() {
        await this.loadSettings();

        if (Platform.isDesktop && typeof require !== 'undefined') {
            try {
                this.nodeFs = require('fs');
                this.nodePath = require('path');
            } catch (e) {
                console.warn("External PDF Plugin: Could not load Node.js 'fs' or 'path' module. Absolute path functionality will be limited.", e);
            }
        }

        this.addSettingTab(new ExternalPDFSettingTab(this.app, this));
        this.registerMarkdownCodeBlockProcessor('external-pdf', (source, el, ctx) => {
            this.renderExternalPDF(source, el, ctx);
        });
        console.log('External PDF Plugin loaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async loadPDFJS(): Promise<void> {
        if (this.pdfJsLoaded) return this.loadingPromise || Promise.resolve();
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const pdfJsBaseUrl = this.settings.pdfJsWorkerUrl.substring(0, this.settings.pdfJsWorkerUrl.lastIndexOf('/') + 1);
            script.src = pdfJsBaseUrl + 'pdf.min.js';

            script.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = this.settings.pdfJsWorkerUrl;
                    this.pdfJsLoaded = true;
                    resolve();
                } else {
                    this.pdfJsLoaded = false;
                    reject(new Error('PDF.js library failed to load onto window.pdfjsLib.'));
                }
            };
            script.onerror = (err) => {
                this.pdfJsLoaded = false;
                console.error('Failed to load PDF.js script:', err);
                reject(new Error(`Failed to load PDF.js script from ${script.src}`));
            };
            document.head.appendChild(script);
        });

        try {
            await this.loadingPromise;
        } catch(e) {
            this.loadingPromise = null;
            throw e;
        }
        return this.loadingPromise;
    }

    private isMobileDevice(): boolean {
        return Platform.isMobile;
    }

    private isValidURL(urlString: string): boolean {
        try {
            const url = new URL(urlString);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch { return false; }
    }

    private isPotentiallyAbsolutePath(pathString: string): boolean {
        if (!pathString) return false;
        if (Platform.isWin) {
            return /^[a-zA-Z]:[\\\/]/.test(pathString) || pathString.startsWith('\\\\');
        } else {
            return pathString.startsWith('/');
        }
    }

    private isDomainAllowed(urlString: string): boolean {
        if (!this.isValidURL(urlString)) return false;
        const url = new URL(urlString);
        if (url.protocol !== 'https:') return false;

        if (!this.settings.restrictDomains) return true;

        try {
            const hostname = url.hostname.toLowerCase();
            return this.settings.allowedDomains.some(domain =>
                hostname === domain || hostname.endsWith('.' + domain)
            );
        } catch { return false; }
    }

    private async fetchExternalPDFData(url: string): Promise<ArrayBuffer> {
        const directUrl = this.getDirectDownloadURL(url);
        const response = await requestUrl({ url: directUrl, method: 'GET', headers: { 'Accept': 'application/pdf,*/*' } });
        if (!response.arrayBuffer) throw new Error('No PDF data received from URL');
        this.checkFileSize(response.arrayBuffer.byteLength, `External PDF from ${url}`);
        return response.arrayBuffer;
    }

    private async fetchLocalPDFData(file: TFile): Promise<ArrayBuffer> {
        const fileData = await this.app.vault.readBinary(file);
        this.checkFileSize(fileData.byteLength, `Local vault PDF ${file.path}`);
        return fileData;
    }

    private async fetchAbsoluteLocalPDFData(filePath: string): Promise<ArrayBuffer> {
        if (!Platform.isDesktop || !this.nodeFs || !this.nodePath) {
            throw new Error("Absolute path access is only supported on Obsidian desktop and requires Node.js 'fs' and 'path' modules.");
        }
        try {
            const normalizedPath = this.nodePath.normalize(filePath);
            if (!this.nodeFs.existsSync(normalizedPath)) {
                 throw new Error(`File not found at absolute path: ${normalizedPath}`);
            }
            const stats = this.nodeFs.statSync(normalizedPath);
            if (!stats.isFile()) {
                throw new Error(`Path is not a file: ${normalizedPath}`);
            }

            const fileDataBuffer = this.nodeFs.readFileSync(normalizedPath);
            const arrayBuffer = fileDataBuffer.buffer.slice(fileDataBuffer.byteOffset, fileDataBuffer.byteOffset + fileDataBuffer.byteLength);
            this.checkFileSize(arrayBuffer.byteLength, `Absolute path PDF ${normalizedPath}`);
            return arrayBuffer;

        } catch (error: any) {
            console.error(`Error reading absolute local PDF file ${filePath}:`, error);
            throw new Error(`Reading file ${filePath}: ${error.message || 'Unknown fs error'}`);
        }
    }


    private checkFileSize(byteLength: number, sourceDescription: string) {
        const sizeInMB = byteLength / (1024 * 1024);
        if (sizeInMB > this.settings.maxFileSize) {
            throw new Error(`PDF file too large: ${sizeInMB.toFixed(1)}MB (max: ${this.settings.maxFileSize}MB). Source: ${sourceDescription}`);
        }
    }

    private getDirectDownloadURL(url: string): string {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            if (hostname.includes('drive.google.com')) {
                const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
                if (fileIdMatch) return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
            }
            if (hostname.includes('dropbox.com')) {
                const newUrl = new URL(url);
                newUrl.hostname = 'dl.dropboxusercontent.com';
                newUrl.searchParams.set('dl', '1');
                return newUrl.toString();
            }
            if (hostname.includes('onedrive.live.com') || hostname.includes('1drv.ms')) {
                const newUrl = new URL(url);
                if (url.includes('/embed')) newUrl.pathname = newUrl.pathname.replace('/embed', '/download');
                newUrl.searchParams.set('download', '1');
                return newUrl.toString();
            }
        } catch (e) { console.warn("Could not parse URL for direct download conversion:", url, e); }
        return url;
    }

    private parseOptions(lines: string[]): { [key: string]: string } {
        const options: { [key: string]: string } = {};
        lines.slice(1).forEach(line => {
            const trimmedLine = line.trim();
            const colonIndex = trimmedLine.indexOf(':');
            if (colonIndex > 0) {
                const key = trimmedLine.substring(0, colonIndex).trim().toLowerCase();
                const value = trimmedLine.substring(colonIndex + 1).trim();
                options[key] = value;
            }
        });
        return options;
    }

    private parseHeight(heightOption: string | undefined): string {
        if (!heightOption) return this.settings.defaultHeight;
        if (/^\d+$/.test(heightOption)) return heightOption + 'px';
        if (/^\d+(\.\d+)?(px|vh|vw|em|rem|%)$/i.test(heightOption)) return heightOption;
        return this.settings.defaultHeight;
    }

    private createErrorElement(el: HTMLElement, message: string) {
        el.empty();
        el.createEl('div', { text: message, cls: 'external-pdf-error' });
    }

    private createLoadingElement(el: HTMLElement): HTMLElement {
        el.empty();
        const loadingContainer = el.createEl('div', { cls: 'external-pdf-loading' });
        loadingContainer.createEl('div', { cls: 'external-pdf-spinner' });
        loadingContainer.createEl('div', { text: 'Loading PDF...', cls: 'external-pdf-loading-text' });
        return loadingContainer;
    }

    private async createPDFJSViewer(container: HTMLElement, pdfData: ArrayBuffer, options: { [key: string]: string }): Promise<void> {
        try {
            const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;

            const viewerContainer = container.createEl('div', { cls: 'external-pdf-viewer' });
            const controls = viewerContainer.createEl('div', { cls: 'external-pdf-controls' });

            const pageControls = controls.createEl('div', { cls: 'external-pdf-page-controls' });
            const prevBtn = pageControls.createEl('button', { text: '‹', title: 'Previous Page (ArrowLeft, PageUp)', cls: 'external-pdf-nav-btn external-pdf-prev-btn' });
            const pageDisplay = pageControls.createEl('span', { cls: 'external-pdf-page-display' });
            const nextBtn = pageControls.createEl('button', { text: '›', title: 'Next Page (ArrowRight, PageDown, Space)', cls: 'external-pdf-nav-btn external-pdf-next-btn' });

            const zoomControls = controls.createEl('div', { cls: 'external-pdf-zoom-controls' });
            const zoomOutBtn = zoomControls.createEl('button', { text: '−', title: 'Zoom Out (-)', cls: 'external-pdf-zoom-btn' });
            const zoomDisplay = zoomControls.createEl('span', { cls: 'external-pdf-zoom-display' });
            const zoomInBtn = zoomControls.createEl('button', { text: '+', title: 'Zoom In (+, =)', cls: 'external-pdf-zoom-btn' });
            const fitWidthBtn = zoomControls.createEl('button', { text: 'Fit', title: 'Fit to Width (0)', cls: 'external-pdf-fit-btn' });

            const canvasContainer = viewerContainer.createEl('div', { cls: 'external-pdf-canvas-container' });
            const heightValue = this.parseHeight(options.height);
            canvasContainer.style.maxHeight = heightValue; // Dynamic style based on options

            const canvas = canvasContainer.createEl('canvas', { cls: 'external-pdf-canvas' });
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to get canvas context');

            let currentPage = 1;
            let scale = this.isMobileDevice() ? 1.0 : this.settings.defaultScale;
            const minScale = 0.25;
            const maxScale = 5.0;
            let fitToWidth = false;

            const calculateFitToWidthScale = async (pageNum: number): Promise<number> => {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.0 });
                const containerWidth = canvasContainer.clientWidth > 0 ? canvasContainer.clientWidth - (this.isMobileDevice() ? 16 : 32) : 600 - 32;
                return Math.max(minScale, Math.min(maxScale, containerWidth / viewport.width));
            };

            const updatePageDisplay = () => { pageDisplay.textContent = `${currentPage} / ${pdf.numPages}`; prevBtn.disabled = currentPage <= 1; nextBtn.disabled = currentPage >= pdf.numPages; };
            const updateZoomDisplay = () => { const displayScale = fitToWidth ? 'Fit' : `${Math.round(scale * 100)}%`; zoomDisplay.textContent = displayScale; zoomOutBtn.disabled = !fitToWidth && scale <= minScale; zoomInBtn.disabled = !fitToWidth && scale >= maxScale; fitWidthBtn.classList.toggle('active', fitToWidth);};

            const renderPage = async (pageNum: number) => {
                try {
                    const page = await pdf.getPage(pageNum);
                    let renderScale = scale;
                    if (fitToWidth) {
                        renderScale = await calculateFitToWidthScale(pageNum);
                        if (scale !== renderScale) scale = renderScale;
                    }
                    const viewport = page.getViewport({ scale: renderScale });
                    const outputScale = window.devicePixelRatio || 1;
                    canvas.width = Math.floor(viewport.width * outputScale);
                    canvas.height = Math.floor(viewport.height * outputScale);
                    canvas.style.width = `${Math.floor(viewport.width)}px`; // Dynamic style
                    canvas.style.height = `${Math.floor(viewport.height)}px`; // Dynamic style
                    ctx.save();
                    ctx.scale(outputScale, outputScale);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0,0,viewport.width, viewport.height);
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    ctx.restore();
                } catch (renderError: any) {
                    console.error(`Error rendering page ${pageNum}:`, renderError);
                    ctx.save();
                    ctx.clearRect(0,0,canvas.width, canvas.height);
                    ctx.fillStyle = "red";
                    ctx.font = "16px sans-serif";
                    ctx.fillText(`Error rendering page: ${renderError.message}`, 10, 30);
                    ctx.restore();
                }
            };

            prevBtn.addEventListener('click', async () => { if (currentPage > 1) { currentPage--; updatePageDisplay(); await renderPage(currentPage); } });
            nextBtn.addEventListener('click', async () => { if (currentPage < pdf.numPages) { currentPage++; updatePageDisplay(); await renderPage(currentPage); } });
            zoomInBtn.addEventListener('click', async () => { if (fitToWidth) { fitToWidth = false; scale = await calculateFitToWidthScale(currentPage); } if (scale < maxScale) { scale = Math.min(scale * 1.25, maxScale); updateZoomDisplay(); await renderPage(currentPage); } });
            zoomOutBtn.addEventListener('click', async () => { if (fitToWidth) { fitToWidth = false; scale = await calculateFitToWidthScale(currentPage); } if (scale > minScale) { scale = Math.max(scale / 1.25, minScale); updateZoomDisplay(); await renderPage(currentPage); } });
            fitWidthBtn.addEventListener('click', async () => { fitToWidth = !fitToWidth; updateZoomDisplay(); await renderPage(currentPage); });

            viewerContainer.tabIndex = 0;
            viewerContainer.addEventListener('keydown', async (e: KeyboardEvent) => {
                if (e.target !== viewerContainer && !viewerContainer.contains(e.target as Node)) return;
                let preventDefault = true;
                switch (e.key) {
                    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': if (currentPage > 1) { currentPage--; updatePageDisplay(); await renderPage(currentPage); } break;
                    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': if (currentPage < pdf.numPages) { currentPage++; updatePageDisplay(); await renderPage(currentPage); } break;
                    case 'Home': if (currentPage !== 1) { currentPage = 1; updatePageDisplay(); await renderPage(currentPage); } break;
                    case 'End': if (currentPage !== pdf.numPages) { currentPage = pdf.numPages; updatePageDisplay(); await renderPage(currentPage); } break;
                    case '+': case '=': if (fitToWidth) { fitToWidth = false; scale = await calculateFitToWidthScale(currentPage); } if (scale < maxScale) { scale = Math.min(scale * 1.25, maxScale); updateZoomDisplay(); await renderPage(currentPage); } break;
                    case '-': if (fitToWidth) { fitToWidth = false; scale = await calculateFitToWidthScale(currentPage); } if (scale > minScale) { scale = Math.max(scale / 1.25, minScale); updateZoomDisplay(); await renderPage(currentPage); } break;
                    case '0': fitToWidth = true; updateZoomDisplay(); await renderPage(currentPage); break;
                    default: preventDefault = false; break;
                }
                if (preventDefault) e.preventDefault();
            });

            if (this.isMobileDevice()) {
                let startX = 0, startY = 0, startDist = 0, currentScale = scale, isPinching = false;
                const getTouchDistance = (touches: TouchList) => Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);

                canvasContainer.addEventListener('touchstart', async (e) => {
                    if (e.touches.length === 1) {
                        startX = e.touches[0].pageX; startY = e.touches[0].pageY; isPinching = false;
                    } else if (e.touches.length === 2) {
                        e.preventDefault();
                        startDist = getTouchDistance(e.touches);
                        currentScale = fitToWidth ? await calculateFitToWidthScale(currentPage) : scale;
                        isPinching = true; fitToWidth = false;
                    }
                }, { passive: false });

                canvasContainer.addEventListener('touchmove', async (e) => {
                    if (isPinching && e.touches.length === 2) {
                        e.preventDefault();
                        const dist = getTouchDistance(e.touches);
                        if (startDist > 0) {
                            const newScale = Math.max(minScale, Math.min(maxScale, currentScale * (dist / startDist)));
                            if (Math.abs(newScale - scale) > 0.02) {
                                scale = newScale;
                                updateZoomDisplay();
                                await renderPage(currentPage);
                            }
                        }
                    }
                }, { passive: false });

                canvasContainer.addEventListener('touchend', async (e) => {
                    if (e.changedTouches.length === 1 && e.touches.length === 0 && !isPinching) {
                        const endX = e.changedTouches[0].pageX;
                        const deltaX = endX - startX;
                        if (Math.abs(deltaX) > 50) {
                           if (deltaX > 0 && currentPage > 1) { currentPage--; updatePageDisplay(); await renderPage(currentPage); }
                           else if (deltaX < 0 && currentPage < pdf.numPages) { currentPage++; updatePageDisplay(); await renderPage(currentPage); }
                        }
                    }
                    if (isPinching && e.touches.length < 2) isPinching = false;
                });
            }

            updatePageDisplay(); updateZoomDisplay();
            if (this.isMobileDevice()) { fitToWidth = true; updateZoomDisplay(); }
            await renderPage(currentPage);
             if (this.isMobileDevice()) {
                const helpText = viewerContainer.createEl('div', { cls: 'external-pdf-mobile-help' });
                helpText.textContent = 'Swipe for pages • Pinch to zoom • Tap "Fit"';
            }
        } catch (error: any) {
            console.error('Error in createPDFJSViewer:', error);
            this.createErrorElement(container, `Error displaying PDF: ${error.message || 'Unknown PDF viewer error'}`);
        }
    }

    private async renderExternalPDF(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
        const lines = source.trim().split('\n');
        const sourceInput = lines[0]?.trim();
        const options = this.parseOptions(lines);
        const isMobile = this.isMobileDevice();

        const container = el.createEl('div', {
            cls: 'external-pdf-container' + (isMobile ? ' external-pdf-mobile' : '')
        });

        if (options.title) {
            container.createEl('h3', { text: options.title, cls: 'external-pdf-title' });
        }

        type PdfSource =
            | { type: 'url', url: string }
            | { type: 'vaultLocal', file: TFile }
            | { type: 'absoluteLocal', path: string }
            | { type: 'error', message: string };

        let pdfDataSource: PdfSource;

        if (!sourceInput) {
            pdfDataSource = { type: 'error', message: 'No PDF source (URL or local path) provided.' };
        } else {
            const abstractFile = this.app.vault.getAbstractFileByPath(sourceInput);
            if (abstractFile instanceof TFile && abstractFile.extension?.toLowerCase() === 'pdf') {
                pdfDataSource = { type: 'vaultLocal', file: abstractFile };
            } else if (this.isValidURL(sourceInput)) {
                if (!this.isDomainAllowed(sourceInput)) {
                    const errorMsgText = this.settings.restrictDomains
                        ? `External domain not allowed. Allowed: ${this.settings.allowedDomains.join(', ')} (or disable domain restriction).`
                        : 'Only HTTPS URLs are allowed for external PDFs for security reasons.';
                    pdfDataSource = { type: 'error', message: errorMsgText };
                } else {
                    pdfDataSource = { type: 'url', url: sourceInput };
                }
            } else if (this.isPotentiallyAbsolutePath(sourceInput)) {
                if (!this.settings.allowAbsolutePaths) {
                    pdfDataSource = { type: 'error', message: 'Absolute file paths are disabled. Enable them in plugin settings (Desktop Only).' };
                } else if (!Platform.isDesktop) {
                    pdfDataSource = { type: 'error', message: 'Absolute file paths are only supported on Obsidian desktop.' };
                } else {
                    pdfDataSource = { type: 'absoluteLocal', path: sourceInput };
                }
            }
            else {
                pdfDataSource = { type: 'error', message: `Invalid source: "${sourceInput}". Not a valid URL, vault file path, or recognizable absolute file path.` };
            }
        }

        if (pdfDataSource.type === 'error') {
            this.createErrorElement(container, pdfDataSource.message);
            return;
        }

        const loadingEl = this.createLoadingElement(container);

        try {
            await this.loadPDFJS();
            let pdfData: ArrayBuffer;

            switch(pdfDataSource.type) {
                case 'vaultLocal':
                    pdfData = await this.fetchLocalPDFData(pdfDataSource.file);
                    break;
                case 'url':
                    pdfData = await this.fetchExternalPDFData(pdfDataSource.url);
                    break;
                case 'absoluteLocal':
                    pdfData = await this.fetchAbsoluteLocalPDFData(pdfDataSource.path);
                    break;
            }

            if (loadingEl.parentNode) loadingEl.remove();
            await this.createPDFJSViewer(container, pdfData, options);

        } catch (error: any) {
            console.error('Error loading or rendering PDF:', error);
            if(loadingEl.parentNode) loadingEl.remove();

            this.createErrorElement(container, `Failed to load PDF: ${error.message || 'Unknown error'}`);

            if (pdfDataSource.type === 'url') {
                const fallbackLink = container.createEl('p', { cls: 'external-pdf-fallback' });
                fallbackLink.innerHTML = `Try opening: <a href="${pdfDataSource.url}" target="_blank" rel="noopener noreferrer">${pdfDataSource.url}</a>`;
            } else if (pdfDataSource.type === 'vaultLocal') {
                const localFileNote = container.createEl('p', { cls: 'external-pdf-fallback' });
                localFileNote.innerHTML = `Problem with vault file: <code>${pdfDataSource.file.path}</code>.`;
            } else if (pdfDataSource.type === 'absoluteLocal') {
                const absFileNote = container.createEl('p', { cls: 'external-pdf-fallback' });
                absFileNote.innerHTML = `Problem with absolute path file: <code>${pdfDataSource.path}</code>.`;
            }
        }
    }

    onunload() {
        this.pdfJsLoaded = false;
        this.loadingPromise = null;
        this.nodeFs = null;
        this.nodePath = null;
        console.log('External PDF Plugin unloaded');
    }
}