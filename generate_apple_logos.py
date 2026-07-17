import re
import uuid

html_file = 'index.html'
css_file = 'css/style.css'

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

glyphs = {
    'word': '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/>',
    'excel': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/>',
    'powerpoint': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><rect x="8" y="12" width="8" height="6"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    'pdf': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 18v-6a2 2 0 1 1 4 0v6"/><path d="M10 15h4"/>',
    'compress': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 14l3 3 3-3"/><path d="M12 11v6"/>',
    'split': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="12" y1="10" x2="12" y2="18"/>',
    'merge': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3-3 3 3"/>',
    'lock': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'unlock': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    'qr': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    'calculator': '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="16" y1="18" x2="16" y2="18.01"/><line x1="12" y1="18" x2="12" y2="18.01"/><line x1="8" y1="18" x2="8" y2="18.01"/>',
    'audio': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
    'video': '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    'crop': '<path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>',
    'text': '<path d="M4 7V4h16v3"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
    'time': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'rotate': '<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.5l4.5 4.5"/>',
    'watermark': '<circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 0 0 8 0"/>',
    'default': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>'
}

def get_glyph_for_label(label):
    lbl = label.lower()
    if 'word' in lbl or 'document' in lbl: return glyphs['word']
    if 'excel' in lbl or 'spreadsheet' in lbl: return glyphs['excel']
    if 'powerpoint' in lbl or 'ppt' in lbl: return glyphs['powerpoint']
    if 'jpg' in lbl or 'image' in lbl or 'photo' in lbl or 'meme' in lbl or 'sketch' in lbl or 'resolution' in lbl: return glyphs['image']
    if 'compress' in lbl or 'resize' in lbl or 'reduce' in lbl: return glyphs['compress']
    if 'split' in lbl or 'extract' in lbl: return glyphs['split']
    if 'merge' in lbl or 'combine' in lbl: return glyphs['merge']
    if 'unlock' in lbl or 'remove password' in lbl: return glyphs['unlock']
    if 'lock' in lbl or 'protect' in lbl or 'security' in lbl: return glyphs['lock']
    if 'qr' in lbl: return glyphs['qr']
    if 'calculat' in lbl: return glyphs['calculator']
    if 'audio' in lbl or 'voice' in lbl: return glyphs['audio']
    if 'video' in lbl or 'youtube' in lbl or 'instagram' in lbl or 'gif' in lbl: return glyphs['video']
    if 'crop' in lbl or 'trim' in lbl: return glyphs['crop']
    if 'text' in lbl or 'markdown' in lbl or 'character' in lbl or 'case' in lbl: return glyphs['text']
    if 'time' in lbl or 'age' in lbl: return glyphs['time']
    if 'rotate' in lbl: return glyphs['rotate']
    if 'watermark' in lbl or 'stamp' in lbl or 'sign' in lbl: return glyphs['watermark']
    if 'pdf' in lbl: return glyphs['pdf']
    return glyphs['default']

def get_gradient_for_label(label):
    lbl = label.lower()
    # iOS vibrant gradients
    # Red / Orange
    if 'pdf' in lbl or 'redact' in lbl or 'delete' in lbl or 'youtube' in lbl:
        return ('#FF3B30', '#FF9500')
    # Blue / Cyan
    if 'image' in lbl or 'photo' in lbl or 'word' in lbl or 'text' in lbl or 'markdown' in lbl:
        return ('#007AFF', '#5AC8FA')
    # Green / Teal
    if 'excel' in lbl or 'spreadsheet' in lbl or 'split' in lbl or 'crop' in lbl:
        return ('#34C759', '#32ADE6')
    # Purple / Pink
    if 'merge' in lbl or 'powerpoint' in lbl or 'ppt' in lbl or 'video' in lbl or 'instagram' in lbl:
        return ('#AF52DE', '#FF2D55')
    # Orange / Yellow
    if 'compress' in lbl or 'resize' in lbl or 'calculat' in lbl or 'time' in lbl:
        return ('#FF9500', '#FFCC00')
    # Indigo / Purple
    if 'lock' in lbl or 'security' in lbl or 'watermark' in lbl or 'sign' in lbl:
        return ('#5856D6', '#AF52DE')
    # Default (Grey to Silver)
    return ('#8E8E93', '#D1D1D6')


def tile_replacer(match):
    full_tile = match.group(0)
    label_match = re.search(r'<div class="app-label">(.*?)</div>', full_tile)
    label = label_match.group(1) if label_match else ""
    
    glyph = get_glyph_for_label(label)
    color_start, color_end = get_gradient_for_label(label)
    
    uid = uuid.uuid4().hex[:8]
    
    # 3D Glassmorphism Apple SVG
    apple_svg = f'''
<svg viewBox="0 0 100 100" class="apple-logo" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad-{uid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{color_start}" />
      <stop offset="100%" stop-color="{color_end}" />
    </linearGradient>
    <filter id="shadow-{uid}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Light Mode Layers -->
  <rect class="apple-bg-light" x="4" y="4" width="92" height="92" rx="22" ry="22" fill="url(#grad-{uid})" />
  <!-- Inner rim reflection for glass aesthetic -->
  <rect class="apple-bg-light" x="4" y="4" width="92" height="92" rx="22" ry="22" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2" />
  
  <g class="apple-glyph-light" transform="translate(28, 28) scale(1.83)" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow-{uid})">
    {glyph}
  </g>

  <!-- Dark Mode Layers (iOS 18 Tinted Style) -->
  <rect class="apple-bg-dark" x="4" y="4" width="92" height="92" rx="22" ry="22" fill="#121212" stroke="#2c2c2e" stroke-width="1.5" />
  <g class="apple-glyph-dark" transform="translate(28, 28) scale(1.83)" fill="none" stroke="url(#grad-{uid})" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    {glyph}
  </g>
</svg>
'''
    new_tile = re.sub(r'<div class="app-icon[^"]*">.*?</div>', f'<div class="app-icon apple-icon-container">{apple_svg}</div>', full_tile, flags=re.DOTALL)
    return new_tile

# Process html
new_content = re.sub(r'<a class="app-tile"[^>]*>.*?</a>', tile_replacer, content, flags=re.DOTALL)

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(new_content)

# Remove the old apple CSS rules to insert the new advanced ones cleanly.
# We will use python string manipulation to truncate everything after /* --- APPLE TIER LOGO DESIGN --- */ if it exists
with open(css_file, 'r', encoding='utf-8') as f:
    css_content = f.read()

if '/* --- APPLE TIER LOGO DESIGN --- */' in css_content:
    css_content = css_content.split('/* --- APPLE TIER LOGO DESIGN --- */')[0]

# Add new CSS rules
css_rules = """
/* --- APPLE TIER LOGO DESIGN --- */
.apple-icon-container {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  padding: 0 !important;
}

.apple-logo {
  width: 100%;
  height: 100%;
  display: block;
}

/* Base Light Mode Styles (Vibrant Gradients + White Glass Icons) */
.apple-bg-light, .apple-glyph-light {
  opacity: 1;
  transition: opacity 0.4s ease, filter 0.4s ease;
}
.apple-bg-dark, .apple-glyph-dark {
  opacity: 0;
  transition: opacity 0.4s ease, filter 0.4s ease;
}

/* Hover effects for liquidly/3D pop */
.app-tile:hover .apple-logo .apple-bg-light {
  filter: drop-shadow(0 14px 24px rgba(0,0,0,0.25)) brightness(1.1);
}
.app-tile:hover .apple-logo .apple-bg-dark {
  filter: drop-shadow(0 14px 24px rgba(0,0,0,0.5)) brightness(1.3);
}

/* iOS 18 Dark Mode Tinted Effect */
[data-theme="dark"] .apple-bg-light, [data-theme="dark"] .apple-glyph-light {
  opacity: 0;
}
[data-theme="dark"] .apple-bg-dark, [data-theme="dark"] .apple-glyph-dark {
  opacity: 1;
}
"""
with open(css_file, 'w', encoding='utf-8') as f:
    f.write(css_content + css_rules)
