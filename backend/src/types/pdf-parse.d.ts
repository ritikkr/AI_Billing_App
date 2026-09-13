// Minimal type declarations for pdf-parse (CommonJS package without its own types).
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
    text: string;
  }
  export default function pdfParse(data: Uint8Array | Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>;
}