import os
from langchain.agents import create_agent
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from tools import web_search , scrape_url 
from dotenv import load_dotenv

load_dotenv()

def get_llm(api_key: str = None):
    if api_key:
        return ChatMistralAI(model="mistral-small", mistral_api_key=api_key)
    return ChatMistralAI(model="mistral-small")

def build_search_agent(api_key: str = None):
    return create_agent(
        model=get_llm(api_key),
        tools=[web_search]    
    )

def build_reader_agent(api_key: str = None):
    return create_agent(
        model=get_llm(api_key),
        tools=[scrape_url]
    )

writer_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert research writer. Write clear, structured and insightful reports."),
    ("human", """Write a detailed research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report as:
- Introduction
- Key Findings (minimum 3 well-explained points)
- Conclusion
- Sources (list all URLs found in the research)

Be detailed, factual and professional."""),
])

def get_writer_chain(api_key: str = None):
    return writer_prompt | get_llm(api_key) | StrOutputParser()

# Keep legacy globals for compatibility
writer_chain = get_writer_chain()

critic_prompt = ChatPromptTemplate.from_messages([
     ("system", "You are a sharp and constructive research critic. Be honest and specific."),
    ("human", """Review the research report below and evaluate it strictly.

Report:
{report}

Respond in this exact format:

Score: X/10

Strengths:
- ...
- ...

Areas to Improve:
- ...
- ...

One line verdict:
..."""),
])

def get_critic_chain(api_key: str = None):
    return critic_prompt | get_llm(api_key) | StrOutputParser()

# Keep legacy globals for compatibility
critic_chain = get_critic_chain()

