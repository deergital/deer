"""Build static PDF fonts from the bundled OFL Manrope; requires fonttools.

The derivative is renamed Deer Text. Italic is an oblique variant because
Manrope has no native italic design. Browser editing uses CSS oblique.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

root = Path(__file__).resolve().parent.parent
for label, weight, italic in [('regular', 400, False), ('bold', 700, False),
                              ('italic', 400, True), ('bold-italic', 700, True)]:
    font = instantiateVariableFont(TTFont(root / 'public/fonts/manrope.ttf'), {'wght': weight}, inplace=True)
    font['OS/2'].fsSelection &= ~64
    if weight >= 700:
        font['OS/2'].fsSelection |= 32
        font['head'].macStyle |= 1
    elif not italic:
        font['OS/2'].fsSelection |= 64
    if italic:
        glyphs = font.getGlyphSet()
        outlines = {}
        for name in font.getGlyphOrder():
            pen = TTGlyphPen(glyphs)
            glyphs[name].draw(TransformPen(pen, (1, 0, .18, 1, 0, 0)))
            outlines[name] = pen.glyph()
        for name, glyph in outlines.items():
            font['glyf'][name] = glyph
        font['post'].italicAngle = -10.2
        font['OS/2'].fsSelection |= 1
        font['head'].macStyle |= 2
    for record in font['name'].names:
        if record.nameID in [1, 2, 3, 4, 6, 16, 17]:
            text = {1:'Deer Text', 16:'Deer Text', 2:label.title(), 17:label.title(),
                    3:'DeerText-'+label, 4:'Deer Text '+label.title(), 6:'DeerText-'+label}[record.nameID]
            record.string = text.encode(record.getEncoding(), errors='replace')
    font.save(root / ('public/fonts/deer-text-'+label+'.ttf'))
