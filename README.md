 # StudyMate AI 🎓
### Your Learning Materials. Your Personal AI Tutor.

**StudyMate AI** is an AI-powered study companion designed to help students learn more effectively using their own educational materials.

Developed for the **Multimodal AI Hackathon 2026 — Track D: Personalized Tutoring & Adaptive Learning**, the project combines document-based learning, generative AI, source-grounded explanations, and interactive study tools in a unified student-focused workspace.

Our goal is simple: **make AI-powered learning more personalized, transparent, and accessible.**

---

## 1. Inspiration

Students often study from scattered resources, including lecture notes, PDF documents, Word files, and presentation slides.

Finding relevant information across these materials can be time-consuming, while general-purpose AI assistants may provide explanations that do not reflect what students are actually learning in class.

We wanted to explore a different approach: an AI study companion that could work with students' own learning materials, help them understand difficult concepts, and support more active learning.

This inspired **StudyMate AI**.

## 2. The Problem

Traditional study workflows present several challenges:

- Learning materials are scattered across different files and formats.
- Students spend time searching for explanations instead of understanding concepts.
- General AI responses may not align with uploaded coursework.
- Students need opportunities to practise and evaluate their understanding.
- Reliable, accessible learning support can be difficult to obtain.

**StudyMate AI addresses these challenges by bringing study materials and AI-assisted learning into one environment.**

## 3. Our Solution

StudyMate AI provides a personalized learning workspace where students can upload supported educational resources, ask academic questions, and explore explanations connected to their learning materials.

The learning journey follows five steps:

**Upload → Explore → Ask → Understand → Practise**

### Key Features

**Document-Based Learning**

Students can upload supported learning documents for processing and use within their study sessions.

**Smart Tutor**

A flexible tutoring mode designed to answer questions using relevant uploaded material when available, while also supporting general academic explanations.

**Grounded Study**

A source-restricted mode designed to generate answers from selected uploaded materials rather than relying on unrelated general knowledge.

**Source Grounding Inspector**

Allows students to inspect extracted passages and source information, supporting transparency and verification.

**AI-Powered Explanations**

Helps students explore concepts through structured, understandable academic explanations.

**Quiz-Based Learning**

Quiz functionality is part of the project's assessment workflow, intended to help students practise and reinforce their understanding. Its reliability and availability depend on the deployed version.

**Organized Study Workspace**

The interface follows a three-panel design philosophy:

- **Left:** Uploaded sources and learning materials.
- **Center:** Active tutoring conversation.
- **Right:** Supporting study tools and conversation history.

The design emphasizes clarity, accessibility, and reduced visual clutter.

## 4. Technology Stack

| Technology | Purpose |
|---|---|
| React | Frontend user interface |
| TypeScript | Application development |
| Vite | Frontend development and builds |
| Google Gemini API | AI-powered tutoring |
| Google AI Studio | AI experimentation and prototyping |
| Google Stitch | UI design exploration |
| GitHub | Version control and collaboration |
| Vercel | Application deployment |

The project uses additional packages documented in `package.json`.

## 5. How StudyMate AI Works

1. A student uploads supported course materials.
2. The application extracts and organizes usable document content.
3. The student selects relevant learning sources.
4. The student asks a question or requests an explanation.
5. The application identifies potentially relevant source passages.
6. The AI tutor generates a response according to the selected learning mode.
7. Available source references help the student examine supporting evidence.
8. Assessment features support further practice where implemented.

This approach is designed to make AI explanations more relevant to students' learning contexts.

---

## 6. Getting Started

### Prerequisites

Before running StudyMate AI locally, install:

- Node.js
- npm
- Git

A valid Gemini API credential is required for Gemini-powered functionality.

### Step 1: Clone the Repository

```bash
git clone https://github.com/Terence-Sseremba/Study-Mate-AI.git
```

### Step 2: Open the Project Directory

```bash
cd Study-Mate-AI
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment Variables

Create a `.env.local` file in the project root.

The original Google AI Studio project documentation specifies:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Replace the placeholder with your own API credential.

**Security:** Never commit real API keys to GitHub. Keep secrets in environment variables and use server-side handling for sensitive credentials.

Depending on the current implementation, additional environment variables or backend configuration may be required. Review the application's current configuration before deployment.

### Step 5: Start the Application

```bash
npm run dev
```

Open the local development address displayed in your terminal.

If the current application uses a separate API server, ensure that the backend is also running and correctly configured.

### Step 6: Build for Production

```bash
npm run build
```

The Vite production build normally generates frontend assets in the `dist` directory.

## 7. Deployment

StudyMate AI uses GitHub for source control and Vercel for web deployment.

A typical deployment workflow involves:

1. Connecting the GitHub repository to Vercel.
2. Selecting the correct project root.
3. Configuring the Vite build.
4. Adding required environment variables securely.
5. Deploying the application.
6. Testing document uploads, tutoring modes, API connectivity, and source-grounded responses.

**Note:** A successful frontend build does not guarantee that backend API routes are functioning. The deployed application must be tested end to end.

## 8. Development Challenges

Throughout development, our team encountered several technical challenges.

### Source Grounding

Ensuring that the AI uses relevant uploaded content without forcing unrelated material into answers.

### Tutor Mode Separation

Distinguishing between flexible general tutoring and responses restricted to uploaded sources.

### Document Processing

Extracting useful information from educational documents and maintaining meaningful source references.

### API Reliability

Handling model availability, API timeouts, usage limits, and unexpected server responses.

### Interface Integration

Integrating a redesigned student-facing interface while preserving existing application functionality.

### Deployment

Moving from a development environment to a publicly accessible application and verifying production behavior.

These experiences strengthened our understanding of software testing, debugging, system integration, and responsible AI development.

## 9. What We Learned

Building StudyMate AI reinforced several lessons:

- Reliable AI systems require more than successful model responses.
- Source relevance matters as much as answer quality.
- A polished interface must be supported by working functionality.
- AI-assisted code requires human review and testing.
- Collaboration and version control are essential when working under deadlines.
- Deployment is part of development, not simply the final step.

Most importantly, we learned that **AI tools can accelerate development, but developers remain responsible for understanding and validating what they build.**

---

## 10. AI Tools & Development Transparency

StudyMate AI was developed through human-led planning, collaboration, testing, and AI-assisted development workflows.

We acknowledge the use of AI tools throughout the project.

### AI Tools Used

**ChatGPT — OpenAI**

Assisted with problem analysis, solution planning, debugging strategies, implementation instructions, documentation, and presentation preparation.

**Google AI Studio / Gemini**

Supported AI application prototyping, experimentation, and development of Gemini-powered tutoring functionality.

**Google Stitch**

Supported exploration and generation of frontend interface designs.

**Antigravity**

Supported frontend integration, code modifications, debugging, and development workflows.

**Argon**

Supported code inspection, debugging, and quality assurance during development, where used.

### Human Contributions

The StudyMate AI team was responsible for:

- Identifying and understanding the learning problem.
- Selecting and refining the project concept.
- Planning features and prioritizing implementation.
- Directing AI-assisted development.
- Reviewing and testing generated outputs.
- Investigating and resolving application problems.
- Making interface and product decisions.
- Coordinating development and deployment.
- Preparing the hackathon submission.

### Responsible AI Development

AI assistance was used to accelerate development, not to eliminate human oversight.

Our team takes responsibility for the submitted implementation and acknowledges that AI-generated code and recommendations require review, testing, and verification.

This disclosure is provided in accordance with the hackathon's AI-tool transparency requirements.

---

## 11. Future Improvements

StudyMate AI is an evolving project.

Potential improvements include:

- Stronger document retrieval and citation accuracy.
- More reliable grounded tutoring.
- Improved topic organization.
- Enhanced adaptive quizzes.
- Personalized learning progress tracking.
- Better support for mobile devices.
- Optimizations for low-bandwidth learning environments.
- Expanded support for educational content formats.

These are development goals rather than claims about currently completed functionality.

## 12. Project Team

**Project:** StudyMate AI

**Hackathon:** Multimodal AI Hackathon 2026

**Track:** Track D — Personalized Tutoring & Adaptive Learning

**Project Lead:** Terence Sseremba

**Team Members:** [Lule Aaron,Nabuufu Tina Linah,Antengorit Anne Grace]

StudyMate AI was developed collaboratively through human creativity, technical experimentation, and responsible use of AI-assisted development tools.

## 13. Copyright & Ownership

**Copyright © 2026 StudyMate AI Contributors. All rights reserved.**

StudyMate AI is developed by its contributors.

Original source code, documentation, branding, and other original project materials are subject to applicable copyright protections.

Unless otherwise specified by an applicable license, no permission is granted to copy, modify, redistribute, or commercially exploit original project materials without authorization from the respective rights holders.

Third-party libraries, dependencies, and assets remain subject to their own licenses.

The public availability of this repository does not automatically grant a general license to reuse its contents.

---

### StudyMate AI — Study Smarter. Understand Deeper.

*Built through collaboration, experimentation, and a shared commitment to making learning more accessible.*
