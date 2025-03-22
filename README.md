# 📚 PDF MCQ Generator API

A Node.js backend service that generates Multiple Choice Questions (MCQs) from PDF documents using Google's Generative AI.

## ✨ Features

- 📄 PDF text extraction
- 🤖 AI-powered MCQ generation
- 🎯 Customizable question count (5-20 questions)
- 📝 Smart question validation
- 🌐 Swagger API documentation
- 📂 PDF file upload handling

## 🛠️ Tech Stack

- **Node.js & Express.js**: Server framework
- **Google Generative AI (Gemini)**: Question generation
- **Multer**: File upload handling
- **PDF-Parse**: PDF text extraction
- **Swagger UI**: API documentation
- **CORS**: Cross-origin support

## 🚀 Quick Start

1. **Clone & Install:**
   ```bash
   git clone <repository-url>
   cd pdfreader
   npm install
   ```

2. **Environment Setup:**
   Create `.env` file:
   ```env
   GOOGLE_API_KEY=your_gemini_api_key
   PORT=5000
   ```

3. **Start Server:**
   ```bash
   npm start
   ```

## 📡 API Endpoints

### Upload PDF
```http
POST /upload-pdf
Content-Type: multipart/form-data

file: PDF_FILE
```

### Generate MCQs
```http
POST /generate-mcqs
Content-Type: application/json

{
  "message": "generate 10 questions about chapter 1"
}
```

## 📖 API Documentation

Access Swagger documentation at: `http://localhost:5000/api-docs`

## ⚙️ Configuration Options

### PDF Upload
```javascript
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});
```

### MCQ Generation
- Minimum questions: 5
- Maximum questions: 20
- Format: JSON array
- Each MCQ contains:
  - Question text
  - 4 options
  - Correct answer

## 🔒 Error Handling

The API includes robust error handling for:
- Invalid file types
- Missing files
- PDF parsing errors
- AI generation failures
- JSON validation errors

## 📊 Response Format

### Successful MCQ Generation
```json
{
  "mcqs": [
    {
      "id": "1",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A"
    }
    // ... more questions
  ]
}
```

## 🛡️ Dependencies

```json
{
  "@google/generative-ai": "^0.1.3",
  "express": "^4.21.2",
  "multer": "^1.4.5-lts.1",
  "pdf-parse": "^1.1.1",
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1"
}
```

## 💡 Usage Example

```bash
# Upload PDF
curl -X POST -F "pdf=@./sample.pdf" http://localhost:5000/upload-pdf

# Generate MCQs
curl -X POST -H "Content-Type: application/json" \
  -d '{"message":"generate 10 questions"}' \
  http://localhost:5000/generate-mcqs
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

---
Made with ❤️ using Node.js and Google Generative AI
