{{-- Decorative hero illustration: a secured planning data hub connected to the
     offices, documents, analytics, science programmes and people it serves. --}}
<svg class="hero-illustration" viewBox="0 0 560 460" role="img" aria-labelledby="hero-illustration-title">
    <title id="hero-illustration-title">A secured planning data hub connected to DOST offices, plans, reports, science programmes and staff</title>
    <defs>
        <linearGradient id="li-blue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2a6cc0"/>
            <stop offset="1" stop-color="#123d73"/>
        </linearGradient>
        <linearGradient id="li-cyan" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#7fdcfb"/>
            <stop offset="1" stop-color="#00aeef"/>
        </linearGradient>
        <linearGradient id="li-disk-top" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="1" stop-color="#d9effb"/>
        </linearGradient>
        <radialGradient id="li-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#00aeef" stop-opacity="0.22"/>
            <stop offset="1" stop-color="#00aeef" stop-opacity="0"/>
        </radialGradient>
        <filter id="li-shadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#174c8f" flood-opacity="0.16"/>
        </filter>
    </defs>

    {{-- Background halo, dotted grid and orbits --}}
    <circle cx="280" cy="250" r="210" fill="url(#li-halo)"/>
    <g fill="#9cc9e6" opacity="0.45">
        <circle cx="40" cy="40" r="2"/><circle cx="64" cy="40" r="2"/><circle cx="88" cy="40" r="2"/>
        <circle cx="40" cy="64" r="2"/><circle cx="64" cy="64" r="2"/>
        <circle cx="472" cy="410" r="2"/><circle cx="496" cy="410" r="2"/><circle cx="520" cy="410" r="2"/>
        <circle cx="496" cy="434" r="2"/><circle cx="520" cy="434" r="2"/>
    </g>
    <ellipse cx="280" cy="255" rx="226" ry="160" fill="none" stroke="#9fd6f2" stroke-width="1.5" stroke-dasharray="4 7"/>
    <ellipse cx="280" cy="300" rx="150" ry="52" fill="none" stroke="#bfe3f6" stroke-width="1.5"/>

    {{-- Connectors from each node to the hub --}}
    <g stroke="#6cc1ea" stroke-width="2" stroke-dasharray="5 6" fill="none">
        <path d="M108 112 Q190 150 236 210"/>
        <path d="M452 112 Q370 150 324 210"/>
        <path d="M96 270 Q160 262 208 268"/>
        <path d="M464 270 Q400 262 352 268"/>
        <path d="M140 378 Q200 350 228 318"/>
        <path d="M420 378 Q360 350 332 318"/>
    </g>
    <g fill="#00aeef">
        <circle cx="236" cy="210" r="4"/><circle cx="324" cy="210" r="4"/>
        <circle cx="208" cy="268" r="4"/><circle cx="352" cy="268" r="4"/>
        <circle cx="228" cy="318" r="4"/><circle cx="332" cy="318" r="4"/>
    </g>

    {{-- Platform base --}}
    <ellipse cx="280" cy="334" rx="112" ry="30" fill="#d4ebf9"/>
    <ellipse cx="280" cy="330" rx="96" ry="24" fill="#e9f6fd" stroke="#bfe3f6"/>

    {{-- Stacked data hub --}}
    <g filter="url(#li-shadow)">
        <path d="M210 296v24a70 22 0 0 0 140 0v-24z" fill="url(#li-blue)"/>
        <ellipse cx="280" cy="296" rx="70" ry="22" fill="url(#li-disk-top)" stroke="#9fd6f2"/>
        <path d="M210 268v24a70 22 0 0 0 140 0v-24z" fill="url(#li-blue)"/>
        <ellipse cx="280" cy="268" rx="70" ry="22" fill="url(#li-disk-top)" stroke="#9fd6f2"/>
        <path d="M210 240v24a70 22 0 0 0 140 0v-24z" fill="url(#li-blue)"/>
        <ellipse cx="280" cy="240" rx="70" ry="22" fill="url(#li-disk-top)" stroke="#9fd6f2"/>
    </g>
    <g fill="#7fdcfb">
        <rect x="228" y="264" width="18" height="3" rx="1.5"/><rect x="228" y="292" width="18" height="3" rx="1.5"/><rect x="228" y="320" width="18" height="3" rx="1.5"/>
    </g>
    <ellipse cx="280" cy="240" rx="40" ry="11" fill="#00aeef" opacity="0.18"/>

    {{-- Security shield --}}
    <g filter="url(#li-shadow)">
        <path d="M280 104l54 19v40c0 31-23 52-54 61-31-9-54-30-54-61v-40z" fill="url(#li-blue)"/>
        <path d="M280 116l42 15v32c0 24-18 41-42 48-24-7-42-24-42-48v-32z" fill="url(#li-cyan)"/>
        <path d="M262 162l13 13 25-27" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>

    {{-- Node: cloud services (top left) --}}
    <g filter="url(#li-shadow)">
        <rect x="58" y="66" width="80" height="76" rx="16" fill="#ffffff" stroke="#d6e6f3"/>
    </g>
    <path d="M80 118h38a11 11 0 0 0 0-22 15 15 0 0 0-28-4 10 10 0 0 0-10 26z" fill="url(#li-cyan)"/>
    <path d="M98 112V100m0 0-5 5m5-5 5 5" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

    {{-- Node: government office (top right) --}}
    <g filter="url(#li-shadow)">
        <rect x="422" y="66" width="80" height="76" rx="16" fill="#ffffff" stroke="#d6e6f3"/>
    </g>
    <path d="M440 96l22-13 22 13z" fill="url(#li-blue)"/>
    <rect x="442" y="97" width="40" height="4" fill="#123d73"/>
    <g fill="url(#li-cyan)">
        <rect x="446" y="104" width="5" height="17"/><rect x="455" y="104" width="5" height="17"/>
        <rect x="464" y="104" width="5" height="17"/><rect x="473" y="104" width="5" height="17"/>
    </g>
    <rect x="440" y="122" width="44" height="5" rx="1" fill="#123d73"/>

    {{-- Node: strategic plan document (left) --}}
    <g filter="url(#li-shadow)">
        <rect x="16" y="232" width="80" height="76" rx="16" fill="#ffffff" stroke="#d6e6f3"/>
    </g>
    <rect x="40" y="248" width="32" height="44" rx="4" fill="#eaf4fb" stroke="#174c8f" stroke-width="2"/>
    <rect x="48" y="243" width="16" height="8" rx="2" fill="#174c8f"/>
    <g stroke="#00aeef" stroke-width="3" stroke-linecap="round">
        <path d="M47 262h18"/><path d="M47 271h18"/><path d="M47 280h11"/>
    </g>

    {{-- Node: analytics dashboard (right) --}}
    <g filter="url(#li-shadow)">
        <rect x="464" y="232" width="80" height="76" rx="16" fill="#ffffff" stroke="#d6e6f3"/>
    </g>
    <rect x="482" y="272" width="8" height="18" rx="1.5" fill="#9fd6f2"/>
    <rect x="495" y="262" width="8" height="28" rx="1.5" fill="url(#li-cyan)"/>
    <rect x="508" y="252" width="8" height="38" rx="1.5" fill="url(#li-blue)"/>
    <path d="M478 292h48" stroke="#174c8f" stroke-width="2" stroke-linecap="round"/>
    <path d="M482 262l12-8 12 2 16-12" fill="none" stroke="#00aeef" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

    {{-- Node: science and technology programmes (bottom left) --}}
    <g filter="url(#li-shadow)">
        <rect x="96" y="346" width="80" height="76" rx="16" fill="#ffffff" stroke="#d6e6f3"/>
    </g>
    <g fill="none" stroke="#174c8f" stroke-width="2.5">
        <ellipse cx="136" cy="384" rx="24" ry="9"/>
        <ellipse cx="136" cy="384" rx="24" ry="9" transform="rotate(60 136 384)"/>
        <ellipse cx="136" cy="384" rx="24" ry="9" transform="rotate(120 136 384)"/>
    </g>
    <circle cx="136" cy="384" r="5" fill="#00aeef"/>

    {{-- Node: offices and personnel (bottom right) --}}
    <g filter="url(#li-shadow)">
        <rect x="384" y="346" width="80" height="76" rx="16" fill="#ffffff" stroke="#d6e6f3"/>
    </g>
    <circle cx="435" cy="374" r="7" fill="url(#li-cyan)"/>
    <path d="M422 402a13 12 0 0 1 26 0z" fill="url(#li-cyan)"/>
    <circle cx="418" cy="372" r="8" fill="url(#li-blue)"/>
    <path d="M402 404a16 14 0 0 1 32 0z" fill="url(#li-blue)"/>

    {{-- Accent sparkles --}}
    <g fill="#00aeef">
        <circle cx="196" cy="70" r="3" opacity="0.6"/>
        <circle cx="372" cy="58" r="4" opacity="0.4"/>
        <circle cx="530" cy="180" r="3" opacity="0.5"/>
        <circle cx="30" cy="190" r="3" opacity="0.5"/>
    </g>
</svg>
