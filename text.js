import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import pdfParse from "pdf-parse/lib/pdf-parse.js"; // Change the import to use direct file
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import multer from "multer";

const genAI = new GoogleGenerativeAI("AIzaSyDpF5tCp4je2A9lyuJc9m9mgZFgdN-Uglw");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PDF Reader API Documentation",
      version: "1.0.0",
      description: "API documentation for PDF Reader and MCQ Generator",
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
    ],
  },
  apis: ["./text.js"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Configure multer for file upload
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed!"), false);
    }
  },
});

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

let currentPdfPath = null; // Store the path of the currently loaded PDF

// ✅ Extract text from PDF
async function extractTextFromPDF(pdfPath) {
  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found at ${pdfPath}`);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    let pdfData = null;
    
    try {
      pdfData = await pdfParse(dataBuffer, {
        // Add options to skip test file check
        version: 'default',
        max: 0,
      });
    } catch (parseError) {
      console.error('PDF Parse Error:', parseError);
      throw new Error('Failed to parse PDF file');
    }

    if (!pdfData || !pdfData.text) {
      throw new Error('Failed to extract text from PDF');
    }

    return pdfData.text;
  } catch (error) {
    console.error('PDF Reading Error:', error);
    throw error;
  }
}

async function generateMCQs(pdfText, question, retryCount = 1) {
  // Extract number of questions from user's message
  const numQuestionsMatch = question.match(/(\d+)\s*(?:mcq|questions?)/i);
  const requestedQuestions = numQuestionsMatch ? parseInt(numQuestionsMatch[1]) : 5;
  const numberOfQuestions = Math.min(Math.max(requestedQuestions, 5), 20); // Min 5, Max 20

  const prompt = `You are a professional quiz generator. Generate multiple choice questions based on the provided PDF content and user's request.

Topic/Focus: "${question}"

Instructions:
1. Generate exactly ${numberOfQuestions} MCQs that are specifically focused on the user's question/topic
2. Each question must have exactly 4 distinct options
3. Make questions progressively harder (easy to difficult)
4. Ensure questions are directly related to the PDF content
5. Format output as a JSON array with this structure:
[
  {
    "id": "1",
    "question": "Clear, focused question text?",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctAnswer": "Must match one option exactly"
  }
]

PDF Content: ${pdfText.substring(0, 3000)}

Important:
- Return ONLY the JSON array with exactly ${numberOfQuestions} questions
- No explanations or additional text
- Ensure correctAnswer matches one option exactly
- Questions must be based on PDF content only`;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const response = await model.generateContent(prompt);
      const textResponse = response.response.text().trim();

      console.log("Raw AI Response:", textResponse);

      // Clean the response to ensure valid JSON
      let jsonStr = textResponse;
      // Remove any text before the first [
      jsonStr = jsonStr.substring(jsonStr.indexOf("["));
      // Remove any text after the last ]
      jsonStr = jsonStr.substring(0, jsonStr.lastIndexOf("]") + 1);

      let mcqData;
      try {
        mcqData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        throw new Error("Failed to parse JSON response");
      }

      // Validate MCQ structure
      if (!Array.isArray(mcqData)) {
        throw new Error("Response is not an array");
      }

      // Validate question count
      if (mcqData.length < numberOfQuestions) {
        throw new Error(`Not enough questions generated. Expected ${numberOfQuestions}, got ${mcqData.length}`);
      }
      mcqData = mcqData.slice(0, numberOfQuestions);

      // Validate and format each MCQ
      const validatedMcqs = mcqData.map((mcq, index) => {
        // Ensure all required fields exist
        if (
          !mcq.question ||
          !Array.isArray(mcq.options) ||
          !mcq.correctAnswer
        ) {
          throw new Error(`Question ${index + 1} is missing required fields`);
        }

        // Ensure exactly 4 options
        if (mcq.options.length !== 4) {
          throw new Error(`Question ${index + 1} must have exactly 4 options`);
        }

        // Ensure correctAnswer is one of the options
        if (!mcq.options.includes(mcq.correctAnswer)) {
          throw new Error(`Question ${index + 1} has invalid correct answer`);
        }

        return {
          id: (index + 1).toString(),
          question: mcq.question.trim(),
          options: mcq.options.map((opt) => opt.trim()),
          correctAnswer: mcq.correctAnswer.trim(),
        };
      });

      return validatedMcqs;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt === retryCount) {
        throw new Error(`Failed to generate valid MCQs: ${error.message}`);
      }
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

/**
 * @swagger
 * /upload-pdf:
 *   post:
 *     summary: Upload a PDF file
 *     description: Upload a PDF file for MCQ generation
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: PDF uploaded successfully
 *       400:
 *         description: Invalid file type or no file provided
 *       500:
 *         description: Server error
 */
app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate PDF by trying to read it
    try {
      await extractTextFromPDF(req.file.path);
      currentPdfPath = req.file.path;
      res.json({ message: "PDF uploaded successfully", path: req.file.path });
    } catch (error) {
      // Delete invalid PDF
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("Error deleting invalid PDF:", unlinkError);
      }
      throw new Error("Invalid or corrupted PDF file");
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /generate-mcqs:
 *   post:
 *     summary: Generate MCQs from PDF content
 *     description: Generates multiple choice questions based on PDF content and user query
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: User's question or topic for MCQ generation
 *     responses:
 *       200:
 *         description: Successfully generated MCQs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mcqs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       question:
 *                         type: string
 *                       options:
 *                         type: array
 *                         items:
 *                           type: string
 *                       correctAnswer:
 *                         type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
// ✅ API to Generate MCQs from PDF
app.post("/generate-mcqs", async (req, res) => {
  try {
    const { message } = req.body;
    console.log("Received question:", message);
    
    if (!currentPdfPath) {
      return res.status(400).json({ error: "Please upload a PDF file first" });
    }

    if (!fs.existsSync(currentPdfPath)) {
      return res.status(404).json({ error: "PDF file no longer exists. Please upload again." });
    }

    try {
      const text = await extractTextFromPDF(currentPdfPath);
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: "Could not extract text from PDF" });
      }

      console.log("Extracted text length:", text.length);
      const mcqs = await generateMCQs(text, message);
      console.log("Generated MCQs:", JSON.stringify(mcqs, null, 2));

      if (!mcqs || !Array.isArray(mcqs)) {
        throw new Error("Invalid MCQ generation result");
      }

      res.json({ mcqs });
    } catch (error) {
      // Delete corrupt/invalid PDF file
      try {
        fs.unlinkSync(currentPdfPath);
        currentPdfPath = null;
      } catch (unlinkError) {
        console.error("Error deleting invalid PDF:", unlinkError);
      }
      throw error;
    }
  } catch (error) {
    console.error("Error in generate-mcqs:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Start server
app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
