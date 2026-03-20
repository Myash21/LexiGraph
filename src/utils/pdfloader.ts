import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";

export async function LoadPDf(data: any) {
    try {
        let text = '';
        let metadata = {};
        // 1. Get buffer and create a Blob for LangChain
        const buffer = await data.toBuffer();
        const blob = new Blob([buffer]);

        // 2. Initialize LangChain PDFLoader
        // splitPages: true is great if you want to ingest page by page
        const loader = new WebPDFLoader(blob, { splitPages: false });
        const docs = await loader.load();

        // 3. Extract text (LangChain joins pages for you if splitPages is false)
        text = docs.map(doc => doc.pageContent).join('\n');

        // 4. Capture metadata from the PDF (page numbers, etc.)
        metadata = {
            source: data.filename,
            ...(docs[0]?.metadata || {})
        };
        return { text, metadata };

    } catch (error: any) {
        throw error;
    }
}