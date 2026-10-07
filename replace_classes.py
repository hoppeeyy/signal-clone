import os
import re

css_path = "frontend/src/app/globals.css"
with open(css_path, "r", encoding="utf-8") as f:
    css_content = f.read()

css_content = css_content.replace("--online-dot: #2EB85C;\n}", "--online-dot: #2EB85C;\n  --input-bg: #F0F0F0;\n}")
css_content = css_content.replace("--online-dot: #2EB85C;\n}", "--online-dot: #2EB85C;\n  --input-bg: #2A2A2A;\n}") # Wait, this won't work well if both are identical strings initially.
# Let's just do regex

css_content = re.sub(r'(--online-dot: #2EB85C;\n})', r'--online-dot: #2EB85C;\n  --input-bg: #F0F0F0;\n}', css_content, count=1)
css_content = re.sub(r'(--online-dot: #2EB85C;\n})', r'--online-dot: #2EB85C;\n  --input-bg: #2A2A2A;\n}', css_content, count=1)

with open(css_path, "w", encoding="utf-8") as f:
    f.write(css_content)

replacements = {
    'bg-theme-bg': 'bg-theme-app',
    'bg-theme-surface': 'bg-theme-app',
    'hover:bg-theme-selected': 'hover:bg-theme-row-hover',
    'bg-theme-selected': 'bg-theme-row-active',
    'border-theme-border': 'border-theme-divider',
    'text-theme-accent-green': 'text-theme-online',
    'bg-theme-accent-green': 'bg-theme-online',
    'rounded-12': 'rounded-[12px]',
    'text-theme-primary': 'text-theme-primary',
}

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        new_content = new_content.replace(old, new)
        
    if new_content != content:
        print(f"Updated {filepath}")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)

for root, _, files in os.walk("frontend/src"):
    for file in files:
        if file.endswith((".tsx", ".ts")):
            process_file(os.path.join(root, file))

print("Done")
