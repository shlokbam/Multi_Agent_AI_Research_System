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

@app.post("/api/research")
async def research(request: Request):
    body = await request.json()
    topic = body.get("topic")
    if not topic:
        return {"error": "Topic is required"}
    
    async def event_generator():
        loop = asyncio.get_event_loop()
        gen = run_research_pipeline_generator(topic)
        
        while True:
            try:
                # Run the blocking next() call in the executor to keep the event loop responsive
                event = await loop.run_in_executor(None, next, gen)
                yield f"data: {json.dumps(event)}\n\n"
            except StopIteration:
                break
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                break
                
    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
