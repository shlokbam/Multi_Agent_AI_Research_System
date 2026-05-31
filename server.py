import json
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pipeline import run_research_pipeline_generator

app = FastAPI(title="Multi-Agent AI Research System API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "healthy", "service": "ResearchOS Multi-Agent Backend"}

def safe_next(generator):
    try:
        return next(generator)
    except StopIteration:
        return None

@app.post("/api/validate-key")
async def validate_key(request: Request):
    body = await request.json()
    api_key = body.get("apiKey")
    if not api_key:
        return {"valid": False, "error": "API Key is required"}
    
    try:
        from langchain_mistralai import ChatMistralAI
        # Create mistral client with this key and do a quick check
        llm = ChatMistralAI(model="mistral-small", mistral_api_key=api_key)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, 
            lambda: llm.invoke("Hello, quick key check. Respond only with 'ok'.", max_tokens=2)
        )
        return {"valid": True}
    except Exception as e:
        return {"valid": False, "error": str(e)}

@app.post("/api/research")
async def research(request: Request):
    body = await request.json()
    topic = body.get("topic")
    api_key = body.get("apiKey") # Optional custom API key from user
    if not topic:
        return {"error": "Topic is required"}
    
    async def event_generator():
        loop = asyncio.get_event_loop()
        gen = run_research_pipeline_generator(topic, api_key=api_key)
        
        while True:
            try:
                # Run the blocking safe_next() call safely in the executor
                event = await loop.run_in_executor(None, safe_next, gen)
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                break


                
    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
