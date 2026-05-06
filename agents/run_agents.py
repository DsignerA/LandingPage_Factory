# Legacy runner preserved for direct file-editing workflows.
# New recommended flow: use build_page.py and let agents edit content/page-data.js.

import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPTS_DIR = os.path.join(ROOT, "agents", "prompts")
REVIEW_PATH = os.path.join(ROOT, "agents", "last_review.md")

FILES = {
    "index": os.path.join(ROOT, "index.html"),
    "hero": os.path.join(ROOT, "components", "hero.js"),
    "features": os.path.join(ROOT, "components", "features.js"),
    "pricing": os.path.join(ROOT, "components", "pricing.js"),
    "cta": os.path.join(ROOT, "components", "cta.js"),
}

PROMPTS = {
    "hero": os.path.join(PROMPTS_DIR, "hero.txt"),
    "features": os.path.join(PROMPTS_DIR, "features.txt"),
    "pricing": os.path.join(PROMPTS_DIR, "pricing.txt"),
    "cta": os.path.join(PROMPTS_DIR, "cta.txt"),
    "reviewer": os.path.join(PROMPTS_DIR, "reviewer.txt"),
}

MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1")

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

def ask_model(system_prompt, user_context):
    c = client()
    response = c.responses.create(
        model=MODEL,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_context},
        ],
    )
    return response.output_text.strip()

def build_context(context_files):
    chunks = []
    for label, path in context_files.items():
        if os.path.exists(path):
            chunks.append(f"FILE: {label}\n---\n{read_file(path)}")
    return "\n\n".join(chunks)

def run_targeted_agent(prompt_name, target_name, context_files):
    prompt = read_file(PROMPTS[prompt_name])
    result = ask_model(prompt, build_context(context_files))
    write_file(FILES[target_name], result)
    print(f"Updated: {FILES[target_name]}")

def run_reviewer():
    prompt = read_file(PROMPTS["reviewer"])
    context = build_context({
        "index.html": FILES["index"],
        "hero.js": FILES["hero"],
        "features.js": FILES["features"],
        "pricing.js": FILES["pricing"],
        "cta.js": FILES["cta"],
        "page-data.js": os.path.join(ROOT, "content", "page-data.js"),
    })
    result = ask_model(prompt, context)
    write_file(REVIEW_PATH, result)
    print(f"Wrote review: {REVIEW_PATH}")

if __name__ == "__main__":
    if os.path.exists(FILES["hero"]):
        run_targeted_agent("hero", "hero", {"hero.js": FILES["hero"]})
    if os.path.exists(FILES["features"]):
        run_targeted_agent("features", "features", {"features.js": FILES["features"]})
    if os.path.exists(FILES["pricing"]):
        run_targeted_agent("pricing", "pricing", {"pricing.js": FILES["pricing"]})
    if os.path.exists(FILES["cta"]):
        run_targeted_agent("cta", "cta", {"cta.js": FILES["cta"]})
    run_reviewer()
    print("Done.")
