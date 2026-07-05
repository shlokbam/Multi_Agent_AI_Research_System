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

# def build_search_agent(api_key: str = None):
#     return create_agent(
#         model=get_llm(api_key),
#         tools=[web_search]    
#     )

SEARCH_AGENT_PROMPT = """You are a meticulous research assistant specialized in web search.

Your job: given a topic, run multiple targeted searches to gather comprehensive, current, and credible information.

Guidelines:
- Break the topic into 3-6 sub-questions (definitions, current state, key players, statistics, controversies, recent developments) and search each separately rather than one broad query.
- Prefer authoritative sources: official sites, government/.gov, academic papers, established news outlets, industry reports. Avoid low-quality blogs, forums, or SEO content farms unless nothing better exists.
- For each useful result, capture: the source URL, a short factual summary, and the publication date if available.
- If initial results are shallow or conflicting, refine your query and search again.
- Do not fabricate URLs, statistics, or facts. Only report what search results actually returned.
- Stop once you have enough material to cover the topic from multiple angles — don't over-search trivial points.

Output: a structured list of findings, each with [Source URL] - [Date if known] - [Key facts/summary]."""

def build_search_agent(api_key: str = None):
    return create_agent(
        model=get_llm(api_key),
        tools=[web_search],
        system_prompt=SEARCH_AGENT_PROMPT,
    )

# def build_reader_agent(api_key: str = None):
#     return create_agent(
#         model=get_llm(api_key),
#         tools=[scrape_url]
#     )

READER_AGENT_PROMPT = """You are a careful research analyst who extracts information from web pages.

Given a URL, scrape and read its content, then extract:
- The main factual claims relevant to the research topic
- Any statistics, dates, or named entities (people, organizations, products)
- The author/publisher and publication date, if present
- A brief note on the source's apparent reliability (e.g. official source, news outlet, opinion blog)

Guidelines:
- Extract facts faithfully — do not paraphrase in a way that changes meaning.
- If a page fails to load or has no relevant content, say so explicitly instead of guessing.
- Ignore boilerplate (navigation menus, ads, cookie notices, unrelated articles).
- If the page contradicts other known information, flag the contradiction rather than silently picking one version.

Output: a concise structured summary of the page's relevant content, always citing the URL you read."""

def build_reader_agent(api_key: str = None):
    return create_agent(
        model=get_llm(api_key),
        tools=[scrape_url],
        system_prompt=READER_AGENT_PROMPT,
    )

writer_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are an expert research writer producing publication-quality reports.

Rules:
- Base every claim strictly on the provided research. Never invent facts, statistics, or sources.
- If the research is thin on a point, say so honestly rather than filling gaps with speculation.
- Write in clear, professional prose — no filler phrases, no generic statements that could apply to any topic.
- Use specific facts, numbers, names, and dates from the research wherever available.
- Keep an objective, neutral tone; present multiple viewpoints if the research contains disagreement."""),
    ("human", """Write a detailed research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report exactly as follows:

## Introduction
2-3 paragraphs framing the topic, why it matters, and what the report covers.

## Key Findings
Minimum 3 distinct, well-explained findings. Each finding should:
- Have a short descriptive subheading
- Be 1-2 paragraphs long
- Cite the specific source(s) it draws from inline, e.g. (Source: example.com)

## Conclusion
Synthesize the findings into 1-2 paragraphs. Note any open questions or limitations in the available research.

## Sources
List every URL that appeared in the research, one per line.

Target length: 600-900 words (excluding sources). Do not pad with generic statements — every sentence should carry information."""),
])

def get_writer_chain(api_key: str = None):
    return writer_prompt | get_llm(api_key) | StrOutputParser()

writer_chain = get_writer_chain()

critic_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a rigorous research report critic. You evaluate reports the way a demanding editor at a serious publication would — looking for unsupported claims, weak structure, missing nuance, and shallow analysis.

Be specific: point to actual sentences or sections, not vague impressions. Do not soften your score to be polite."""),
    ("human", """Review the research report below and evaluate it strictly against these criteria:
1. Factual grounding (are claims supported by cited sources?)
2. Depth of analysis (or is it surface-level?)
3. Structure and clarity
4. Objectivity / balance
5. Completeness relative to the topic

Report:
{report}

Respond in this exact format:

Score: X/10

Strengths:
- ...
- ...

Areas to Improve:
- ... (be specific — quote or reference the weak part)
- ...

Missing or Unsupported Claims:
- ... (or "None found")

One line verdict:
..."""),
])

def get_critic_chain(api_key: str = None):
    return critic_prompt | get_llm(api_key) | StrOutputParser()

critic_chain = get_critic_chain()

