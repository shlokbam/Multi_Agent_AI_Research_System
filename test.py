from langchain_mistralai import ChatMistralAI
import os
from dotenv import load_dotenv

load_dotenv()

llm = ChatMistralAI()
reponse = llm.invoke("hello tell me about machine learning")
print(reponse.content)