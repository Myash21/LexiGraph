import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { Document } from "@langchain/core/documents";

type LoadResult = { text: string; metadata: Record<string, any> };

// ─── PDF ────────────────────────────────────────────────────────────────────
export async function loadPDF(data: any): Promise<LoadResult> {
    const buffer = await data.toBuffer();
    const blob = new Blob([buffer]);
    const loader = new WebPDFLoader(blob, { splitPages: false });
    const docs = await loader.load();

    return {
        text: docs.map(d => d.pageContent).join('\n'),
        metadata: { source: data.filename, ...(docs[0]?.metadata || {}) },
    };
}

// ─── TXT ────────────────────────────────────────────────────────────────────
export async function loadTXT(data: any): Promise<LoadResult> {
    const buffer = await data.toBuffer();
    const text = buffer.toString('utf-8');

    return {
        text,
        metadata: { source: data.filename, type: 'txt' },
    };
}

// ─── DOCX ───────────────────────────────────────────────────────────────────
export async function loadDOCX(data: any): Promise<LoadResult> {
    // LangChain's DocxLoader needs a file path, so we write to a temp file
    const { DocxLoader } = await import("@langchain/community/document_loaders/fs/docx");
    const os = await import('os');
    const path = await import('path');
    const fs = await import('fs/promises');

    const buffer = await data.toBuffer();
    const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}.docx`);

    try {
        await fs.writeFile(tmpPath, buffer);
        const loader = new DocxLoader(tmpPath);
        const docs = await loader.load();

        return {
            text: docs.map(d => d.pageContent).join('\n'),
            metadata: { source: data.filename, type: 'docx', ...(docs[0]?.metadata || {}) },
        };
    } finally {
        await fs.unlink(tmpPath).catch(() => { }); // always clean up
    }
}

// ─── Web Page ────────────────────────────────────────────────────────────────
export async function loadWebPage(url: string): Promise<LoadResult> {
    const loader = new CheerioWebBaseLoader(url, {
        // Target only the main content — avoids nav/footer noise
        selector: "article, main, .content, body",
    });
    const docs = await loader.load();

    return {
        text: docs.map(d => d.pageContent).join('\n').replace(/\s+/g, ' ').trim(),
        metadata: { source: url, type: 'webpage', ...(docs[0]?.metadata || {}) },
    };
}

// ─── Router ──────────────────────────────────────────────────────────────────
export async function loadFile(data: any): Promise<LoadResult> {
    const filename: string = (data.filename ?? '').toLowerCase();

    if (filename.endsWith('.pdf')) return loadPDF(data);
    if (filename.endsWith('.txt')) return loadTXT(data);
    if (filename.endsWith('.docx')) return loadDOCX(data);

    // fallback: try treating it as plain text
    const buffer = await data.toBuffer();
    return {
        text: buffer.toString('utf-8'),
        metadata: { source: data.filename, type: 'unknown' },
    };
}