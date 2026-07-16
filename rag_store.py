import os
import time
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_mistralai import MistralAIEmbeddings

def is_pinecone_configured() -> bool:
    """
    Check if Pinecone API keys and index names are loaded in the environment.
    """
    return bool(os.getenv("PINECONE_API_KEY") and os.getenv("PINECONE_INDEX_NAME"))

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
    Initialize and return either Pinecone or Chroma vector store dynamically
    based on environment variables.
    """
    embeddings = get_embeddings(api_key)
    
    if is_pinecone_configured():
        from langchain_pinecone import PineconeVectorStore
        index_name = os.getenv("PINECONE_INDEX_NAME")
        pinecone_key = os.getenv("PINECONE_API_KEY")
        print(f"[RAG] Connecting to Cloud Vector DB: Pinecone (Index: '{index_name}')")
        return PineconeVectorStore(
            index_name=index_name,
            embedding=embeddings,
            pinecone_api_key=pinecone_key
        )
    else:
        from langchain_chroma import Chroma
        persist_directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "chroma_db")
        print(f"[RAG] Connecting to Local Vector DB: ChromaDB (Path: '{persist_directory}')")
        return Chroma(
            collection_name="research_knowledge_base",
            embedding_function=embeddings,
            persist_directory=persist_directory
        )

def save_to_knowledge_base(topic: str, report: str, scraped_content: str, api_key: str = None):
    """
    Chunk and save report and raw scraped contents to the active vector database (Pinecone or Chroma).
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
            db_type = "Pinecone" if is_pinecone_configured() else "ChromaDB"
            print(f"[RAG] Successfully stored {len(docs)} document chunks for topic '{topic}' in {db_type}.")
    except Exception as e:
        print(f"[RAG Error] Failed to save to knowledge base: {str(e)}")

def query_knowledge_base(query: str, api_key: str = None) -> str:
    """
    Search the active vector DB for relevant matching chunks and format as context.
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
        return f"Error querying knowledge base: {str(e)}"
