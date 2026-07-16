import os
import time
from langchain_chroma import Chroma
from langchain_mistralai import MistralAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

def get_embeddings(api_key: str = None):
    """
    Initialize MistralAIEmbeddings. Use API key if provided,
    otherwise rely on environment variable MISTRAL_API_KEY.
    """
    if api_key:
        return MistralAIEmbeddings(model="mistral-embed", mistral_api_key=api_key)
    return MistralAIEmbeddings(model="mistral-embed")

def get_vector_store(api_key: str = None):
    """
    Initialize and return Chroma vector store wrapper.
    """
    persist_directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "chroma_db")
    embeddings = get_embeddings(api_key)
    return Chroma(
        collection_name="research_knowledge_base",
        embedding_function=embeddings,
        persist_directory=persist_directory
    )

def save_to_knowledge_base(topic: str, report: str, scraped_content: str, api_key: str = None):
    """
    Chunk and save report and raw scraped contents to the vector database.
    """
    try:
        db = get_vector_store(api_key)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        docs = []
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

        # Chunk the generated report
        report_chunks = text_splitter.split_text(report)
        for i, chunk in enumerate(report_chunks):
            docs.append(Document(
                page_content=chunk,
                metadata={
                    "topic": topic,
                    "type": "report",
                    "chunk_index": i,
                    "timestamp": timestamp
                }
            ))

        # Chunk the scraped content if it exists
        if scraped_content:
            scraped_chunks = text_splitter.split_text(scraped_content)
            for i, chunk in enumerate(scraped_chunks):
                docs.append(Document(
                    page_content=chunk,
                    metadata={
                        "topic": topic,
                        "type": "scraped_content",
                        "chunk_index": i,
                        "timestamp": timestamp
                    }
                ))

        if docs:
            db.add_documents(docs)
            print(f"[RAG] Successfully stored {len(docs)} document chunks for topic '{topic}' to knowledge base.")
    except Exception as e:
        print(f"[RAG Error] Failed to save to knowledge base: {str(e)}")

def query_knowledge_base(query: str, api_key: str = None) -> str:
    """
    Search the local vector DB for relevant matching chunks and format as context.
    """
    try:
        db = get_vector_store(api_key)
        results = db.similarity_search(query, k=4)
        
        if not results:
            return "No relevant past research found in the local knowledge base."

        formatted_results = []
        for i, doc in enumerate(results):
            meta = doc.metadata
            doc_type = meta.get("type", "unknown").upper()
            topic = meta.get("topic", "unknown")
            timestamp = meta.get("timestamp", "unknown")
            formatted_results.append(
                f"=== Past Context {i+1} ===\n"
                f"Topic: {topic}\n"
                f"Type: {doc_type}\n"
                f"Date Saved: {timestamp}\n"
                f"Content Snippet:\n{doc.page_content}\n"
            )
        
        return "\n".join(formatted_results)
    except Exception as e:
        return f"Error querying local knowledge base: {str(e)}"
