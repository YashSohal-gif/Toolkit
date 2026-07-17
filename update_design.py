import re
import os

html_file = 'index.html'
css_file = 'css/style.css'

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

svg_map = {
    'convert-to-pdf': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
    'convert-from-pdf': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><polyline points="12 12 12 18 15 15"/><polyline points="12 18 9 15"/></svg>',
    'pdf-tools': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><circle cx="12" cy="13" r="3"/><line x1="12" y1="16" x2="12" y2="20"/></svg>',
    'pdf-security': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    'image-tools': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    'utility-tools': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    'video-tools': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    'student-tools': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    'default': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'
}

screens = re.split(r'(<div class="app-screen"[^>]*data-category="[^"]*"[^>]*>)', content)

new_content = ""
current_category = 'default'

if len(screens) == 1:
    screens = re.split(r'(<div class="app-screen"[^>]*>)', content)

for part in screens:
    cat_match = re.search(r'data-category="(.*?)"', part)
    if cat_match:
        current_category = cat_match.group(1)
        
    if 'app-tile' in part:
        svg = svg_map.get(current_category, svg_map['default'])
        part = re.sub(r'<div class="app-icon[^"]*">.*?</div>', f'<div class="app-icon"><span class="svg-wrap">{svg}</span></div>', part, flags=re.DOTALL)
        
    new_content += part

new_content = re.sub(r'<div class="app-icon icon-[^"]*">.*?</div>', f'<div class="app-icon"><span class="svg-wrap">{svg_map["default"]}</span></div>', new_content, flags=re.DOTALL)

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(new_content)

css_rules = """

/* --- MINIMALIST PREMIUM DESIGN OVERHAUL --- */
body {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
}

/* Minimalist Logo Styling: Black in light mode, White in dark mode */
.app-icon {
  background: #0f172a !important; /* Almost black */
  color: #ffffff !important;
  border-radius: 16px !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
}
.app-icon::before, .app-icon::after {
  display: none !important; /* Remove glossy gradients to keep it minimalist */
}
.app-icon .svg-wrap svg {
  color: #ffffff !important;
  filter: none !important;
}
.app-icon .svg-wrap {
  filter: none !important;
}

/* Dark mode adaptation */
[data-theme="dark"] .app-icon {
  background: #ffffff !important;
  color: #0f172a !important;
  box-shadow: 0 4px 12px rgba(255,255,255,0.1) !important;
}
[data-theme="dark"] .app-icon .svg-wrap svg {
  color: #0f172a !important;
}

/* Premium Layout Tweaks */
.app-tile {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.app-tile:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 12px 24px -8px rgba(15, 23, 42, 0.15);
  border-color: var(--primary);
}
"""
with open(css_file, 'a', encoding='utf-8') as f:
    f.write(css_rules)
