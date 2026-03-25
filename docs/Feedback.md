
# Game Board in desktop view

1. Move Directives from the left panel to the right panel

2. clean up left panel
* remove HOPLITE title, subtitle and version (also remove the verision at the bottom of the right panel, all version information can be consolidated in the Hub)
* remove turn sequence
* remove metabolic engine description and title, only keep the status chip
* remove the ruleset
* replace all the info cards with a two column list of core and derived stats

3. clear up the gameboard box
* move the theme selector to the top of left panel
* move override information to the top of the right panel above tactical skills

# Arcade flow

1. Make Arcade mode the default page when loading /Hop
2. Have a dedicated /Hop/Hub page for the Hub
3. remove the HOP ARCADE title and subtitle, center the two buttons
4. Replace the text for the "Tap to Enter" button to "Start"
5. Add a new title at the top, centered, reading "Ashes of the World", see following example:
<h1 class="splash-title-main">ASHES</h1>
.splash-title-main {
    font-size: min(15svh, 25svw);
    font-weight: bold;
    color: var(--splash-title-color);
    text-shadow: var(--splash-title-shadow);
    line-height: 1;
    margin: 0;
    text-transform: uppercase;
}
user agent stylesheet
h1 {
    display: block;
    font-size: 2em;
    margin-block-start: 0.67em;
    margin-block-end: 0.67em;
    margin-inline-start: 0px;
    margin-inline-end: 0px;
    font-weight: bold;
    unicode-bidi: isolate;
}

<h2 class="splash-title-connector">OF THE</h2>
.splash-title-connector {
    font-size: min(5svh, 8svw);
    font-weight: normal;
    color: var(--splash-title-color);
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    line-height: 1;
    margin: -0.2em 0;
    text-transform: uppercase;
}
user agent stylesheet
h2 {
    display: block;
    font-size: 1.5em;
    margin-block-start: 0.83em;
    margin-block-end: 0.83em;
    margin-inline-start: 0px;
    margin-inline-end: 0px;
    font-weight: bold;
    unicode-bidi: isolate;
}

<h1 class="splash-title-main">WORLD</h1>
.splash-title-main {
    font-size: min(15svh, 25svw);
    font-weight: bold;
    color: var(--splash-title-color);
    text-shadow: var(--splash-title-shadow);
    line-height: 1;
    margin: 0;
    text-transform: uppercase;
}
user agent stylesheet
h1 {
    display: block;
    font-size: 2em;
    margin-block-start: 0.67em;
    margin-block-end: 0.67em;
    margin-inline-start: 0px;
    margin-inline-end: 0px;
    font-weight: bold;
    unicode-bidi: isolate;
}

6. Skip the ARCADE MODE ARCHETYPE picker, on click on Start, directly load the Vanguard archetype with a daily seed map.