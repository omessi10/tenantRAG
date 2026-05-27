import { v4 as uuidv4 } from "uuid";
import * as docRepo from "../models/document.repository.js";
import type { DocumentRecord } from "../models/types.js";
import { chunkText } from "../rag/chunker.js";
import { embedTexts } from "../rag/embeddings.js";
import { extractText, isSupportedMime } from "../rag/extractor.js";

export async function ingestDocument(
  tenantId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<DocumentRecord> {
  if (!isSupportedMime(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  const documentId = uuidv4();
  const doc = await docRepo.createDocument(documentId, tenantId, filename, mimeType);

  try {
    const text = await extractText(buffer, mimeType, filename);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await docRepo.updateDocumentStatus(documentId, tenantId, "failed", 0);
      throw new Error("No extractable text found in document");
    }

    const embeddings = await embedTexts(chunks);
    const chunkRecords = chunks.map((content, index) => ({
      id: uuidv4(),
      index,
      content,
      embedding: embeddings[index],
    }));

    await docRepo.insertChunks(tenantId, documentId, chunkRecords);
    await docRepo.updateDocumentStatus(documentId, tenantId, "ready", chunks.length);

    const updated = await docRepo.getDocument(documentId, tenantId);
    return updated ?? doc;
  } catch (err) {
    await docRepo.updateDocumentStatus(documentId, tenantId, "failed", 0);
    throw err;
  }
}
