import os
import sys
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS_DIR = os.path.join(ROOT, "agents", "prompts")
CONTENT_PATH = os.path.join(ROOT, "content", "page-data.js")
DESIGN_BRIEF_PATH = os.path.join(ROOT, "agents", "last_design_brief.md")
LAYOUT_PLAN_PATH = os.path.join(ROOT, "agents", "last_layout_plan.md")
REVIEW_PATH = os.path.join(ROOT, "agents", "last_review.md")

DEFAULT_EDITOR_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1")
DEFAULT_DIRECTOR_MODEL = os.getenv("OPENAI_MODEL_DIRECTOR", "gpt-5")

def require_env():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY environment variable.")
    return api_key

def client():
    return OpenAI(api_key=require_env())

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def read_prompt(name):
    return read_file(os.path.join(PROMPTS_DIR, f"{name}.txt"))

def ask_model(system_prompt, user_context, model):
    c = client()
    response = c.responses.create(
        model=model,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_context},
        ],
    )
    return response.output_text.strip()

def run_design_director(offer):
    prompt = read_prompt("design_director")
    context = f"Offer: {offer}\nCurrent content file:\n---\n{read_file(CONTENT_PATH)}"
    result = ask_model(prompt, context, DEFAULT_DIRECTOR_MODEL)
    write_file(DESIGN_BRIEF_PATH, result)
    print(f"Wrote design brief: {DESIGN_BRIEF_PATH}")
    return result

def run_layout_planner(offer, design_brief):
    prompt = read_prompt("layout_planner")
    context = f"Offer: {offer}\n\nDesign brief:\n---\n{design_brief}\n\nCurrent content file:\n---\n{read_file(CONTENT_PATH)}"
    result = ask_model(prompt, context, DEFAULT_DIRECTOR_MODEL)
    write_file(LAYOUT_PLAN_PATH, result)
    print(f"Wrote layout plan: {LAYOUT_PLAN_PATH}")
    return result

def run_content_generator(offer, design_brief, layout_plan):
    prompt = read_prompt("content_generator")
    context = (
        f"Offer: {offer}\n\n"
        f"Design brief:\n---\n{design_brief}\n\n"
        f"Layout plan:\n---\n{layout_plan}\n\n"
        f"Current content/page-data.js:\n---\n{read_file(CONTENT_PATH)}"
    )
    result = ask_model(prompt, context, DEFAULT_EDITOR_MODEL)
    write_file(CONTENT_PATH, result)
    print(f"Updated content: {CONTENT_PATH}")
    return result

def run_conversion_reviewer(offer, design_brief, layout_plan, page_data):
    prompt = read_prompt("conversion_reviewer")
    context = (
        f"Offer: {offer}\n\n"
        f"Design brief:\n---\n{design_brief}\n\n"
        f"Layout plan:\n---\n{layout_plan}\n\n"
        f"Generated content/page-data.js:\n---\n{page_data}"
    )
    result = ask_model(prompt, context, DEFAULT_DIRECTOR_MODEL)
    write_file(REVIEW_PATH, result)
    print(f"Wrote review: {REVIEW_PATH}")
    return result

if __name__ == "__main__":
    offer = sys.argv[1] if len(sys.argv) > 1 else "dentist_ai"
    design_brief = run_design_director(offer)
    layout_plan = run_layout_planner(offer, design_brief)
    page_data = run_content_generator(offer, design_brief, layout_plan)
    run_conversion_reviewer(offer, design_brief, layout_plan, page_data)
    print("Done.")
