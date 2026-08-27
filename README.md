# CIHE SmartAssist

CIHE SmartAssist is an AI-powered student support assistant designed to help students quickly find information from CIHE’s student and academic resources.

Instead of manually searching through large student handbooks and documents, students can ask questions in natural language. SmartAssist searches the available CIHE documents, identifies the most relevant information, and uses it to generate a helpful response.

What Does CIHE SmartAssist Do?

CIHE SmartAssist acts as an intelligent first point of contact for students.

Students can ask questions such as:

* “Where can I find information about my courses?”
* “What are the requirements for this subject?”
* “What does the student handbook say about this?”
* “Who should I contact if I need further help?”

The system searches its collection of CIHE documents and retrieves the information most relevant to the student’s question.

If the system cannot find sufficiently relevant information, it avoids making up an answer and instead directs the student to Student Services.

How It Works

CIHE SmartAssist uses a Retrieval-Augmented Generation (RAG) approach.

The basic process is:

1. Student asks a question
2. Question is converted into an embedding
3. Relevant document content is retrieved
4. The retrieved information is provided to the AI
5. AI generates an answer based on the retrieved content
6. The source document is provided with the response

This approach helps keep responses grounded in the information available in the CIHE documents rather than allowing the AI to freely guess.

Key Features

# AI Student Assistant

Students can interact with SmartAssist using natural-language questions.

# Document-Based Answers

The system uses CIHE-provided documents as its knowledge source.

# Semantic Search

SmartAssist uses embeddings and similarity search to find information that is semantically related to a student’s question.

# RAG Architecture

The Retrieval-Augmented Generation architecture combines document retrieval with AI-generated responses.

# Source Awareness

Responses can identify the document from which the relevant information was retrieved.

# Hallucination Control

When a question does not have a sufficiently relevant match in the available documents, SmartAssist can avoid generating an unsupported answer and direct the student to Student Services.

# Dashboard

The backend includes a dashboard for tracking basic query information, including total queries, answered queries, indexed documents, and recent questions.

Technology

The project currently uses:

* Python
* FastAPI – Backend API
* React – Frontend
* Sentence Transformers – Text embeddings
* FAISS – Similarity search and document retrieval
* RAG – Retrieval-Augmented Generation
* Pydantic – API request validation

Project Structure

CiheSMARTASSIST/
│
├── client/              # React frontend
├── server/              # Server-side components
├── documents/           # CIHE knowledge documents
│
├── main.py              # FastAPI application
├── rag_engine.py        # Document processing and retrieval
├── generator.py         # AI response generation
├── moodle_loader.py     # Moodle/document loading
├── test_*.py            # Project tests
└── generator.py

Purpose

The goal of CIHE SmartAssist is to make student support information:

* Faster to access
* Easier to understand
* Available through natural-language questions
* Grounded in official CIHE resources

SmartAssist is intended to reduce the time students spend searching through documents and provide a convenient first step when they need information.

Project Status

# Currently in development

The project is being developed incrementally, with future improvements planned for the assistant, knowledge sources, user experience, security, and student-support functionality.

Repository

The project source code is available on GitHub:

https://github.com/Aashutosh-bot/CiheSMARTASSIST
