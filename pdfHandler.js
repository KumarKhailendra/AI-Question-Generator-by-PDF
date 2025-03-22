const fs = require('fs');
const pdfParse = require('pdf-parse');
const { OllamaEmbeddings } = require("langchain/embeddings");
const { Chroma } = require("langchain/vectorstores");

// Extract text from PDF
async function extractTextFromPDF(pdfPath) {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

// Store PDF content in ChromaDB
async function storePDFContent(text) {
    const vectorStore = await Chroma.fromTexts([text], new OllamaEmbeddings(), {
        collectionName: "pdf-docs",
    });
    return vectorStore;
}

module.exports = { extractTextFromPDF, storePDFContent };
