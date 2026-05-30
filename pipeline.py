from agents import build_reader_agent, build_search_agent, get_writer_chain, get_critic_chain
import os

def run_research_pipeline_generator(topic: str, api_key: str = None):
    state = {}
    
    yield {"type": "status", "step": 1, "message": "Search agent is working..."}
    search_agent = build_search_agent(api_key=api_key)
    search_result = search_agent.invoke({
        "messages" : [("user", f"Find recent, reliable and detailed information about: {topic}")]
    })
    state["search_results"] = search_result['messages'][-1].content
    yield {"type": "search_results", "data": state["search_results"]}

    yield {"type": "status", "step": 2, "message": "Reader agent is scraping top resources..."}
    reader_agent = build_reader_agent(api_key=api_key)
    reader_result = reader_agent.invoke({
        "messages": [("user",
            f"Based on the following search results about '{topic}', "
            f"pick the most relevant URL and scrape it for deeper content.\n\n"
            f"Search Results:\n{state['search_results'][:800]}"
        )]
    })
    state["scraped_content"] = reader_result['messages'][-1].content
    yield {"type": "scraped_content", "data": state["scraped_content"]}

    yield {"type": "status", "step": 3, "message": "Writer is drafting the report..."}
    research_combined = (
        f"SEARCH RESULTS : \n {state['search_results']} \n\n"
        f"DETAILED SCRAPED CONTENT : \n {state['scraped_content']}"
    )
    writer_chain = get_writer_chain(api_key=api_key)
    state["report"] = writer_chain.invoke({
        "topic" : topic,
        "research" : research_combined
    })
    yield {"type": "report", "data": state["report"]}

    yield {"type": "status", "step": 4, "message": "Critic is reviewing the report..."}
    critic_chain = get_critic_chain(api_key=api_key)
    state['feedback'] = critic_chain.invoke({
        "report": state['report']
    })
    yield {"type": "feedback", "data": state['feedback']}
    yield {"type": "complete", "state": state}

def run_research_pipeline(topic:str, api_key: str = None) -> dict:
    final_state = {}
    for event in run_research_pipeline_generator(topic, api_key=api_key):

        if event["type"] == "status":
            print("\n" + " ="*50)
            print(f"step {event['step']} - {event['message']}")
            print("="*50)
        elif event["type"] == "search_results":
            print("\n search result ", event["data"])
        elif event["type"] == "scraped_content":
            print("\nscraped content: \n", event["data"])
        elif event["type"] == "report":
            print("\n Final Report\n", event["data"])
        elif event["type"] == "feedback":
            print("\n critic report \n", event["data"])
        elif event["type"] == "complete":
            final_state = event["state"]
    return final_state

if __name__ == "__main__":
    topic = input("\n Enter a research topic : ")
    run_research_pipeline(topic)