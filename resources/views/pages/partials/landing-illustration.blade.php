{{-- Hero illustration: the planning platform at the centre, with the five system roles
     around it exchanging work through the platform and with each other. --}}
<svg class="hero-illustration" viewBox="0 0 560 480" role="img" aria-labelledby="hero-illustration-title">
    <title id="hero-illustration-title">The planning platform at the centre, connecting the Planning Officer, Management, Offices and Units, the Administrative Admin and the Technical Admin</title>
    <defs>
        <linearGradient id="li-blue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2a6cc0"/>
            <stop offset="1" stop-color="#123d73"/>
        </linearGradient>
        <linearGradient id="li-cyan" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#5fd0f7"/>
            <stop offset="1" stop-color="#0098d4"/>
        </linearGradient>
        <linearGradient id="li-disk-top" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="1" stop-color="#d9effb"/>
        </linearGradient>
        <radialGradient id="li-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#00aeef" stop-opacity="0.2"/>
            <stop offset="1" stop-color="#00aeef" stop-opacity="0"/>
        </radialGradient>
        <filter id="li-shadow" x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#174c8f" flood-opacity="0.16"/>
        </filter>
    </defs>

    <circle cx="280" cy="240" r="215" fill="url(#li-halo)"/>

    {{-- Collaboration ring linking the units to one another --}}
    <ellipse class="li-ring" cx="280" cy="240" rx="200" ry="170" fill="none" stroke="#8ccfee" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3 8"/>

    {{-- Spokes: each unit exchanges work with the platform --}}
    <g class="li-flow" stroke="#4fb8e6" stroke-width="2.5" stroke-dasharray="6 5" fill="none">
        <path d="M280 70V240"/>
        <path d="M453 155 280 240"/>
        <path d="M453 325 280 240"/>
        <path d="M107 325 280 240"/>
        <path d="M107 155 280 240"/>
    </g>

    {{-- Platform base --}}
    <ellipse cx="280" cy="318" rx="132" ry="38" fill="#d4ebf9"/>
    <g filter="url(#li-shadow)">
        <path d="M170 288v18a110 32 0 0 0 220 0v-18z" fill="url(#li-blue)"/>
        <ellipse cx="280" cy="288" rx="110" ry="32" fill="url(#li-disk-top)" stroke="#9fd6f2"/>
    </g>
    <ellipse cx="280" cy="288" rx="80" ry="21" fill="none" stroke="#00aeef" stroke-opacity="0.45" stroke-width="2"/>

    {{-- Platform workstation --}}
    <path d="M266 260h28l6 24h-40z" fill="#123d73"/>
    <ellipse cx="280" cy="285" rx="32" ry="7" fill="#123d73"/>
    <g filter="url(#li-shadow)">
        <rect x="196" y="152" width="168" height="112" rx="10" fill="url(#li-blue)"/>
    </g>
    <rect x="204" y="160" width="152" height="94" rx="5" fill="#ffffff"/>
    <rect x="204" y="160" width="152" height="15" rx="5" fill="#eaf4fb"/>
    <g fill="#9fd6f2"><circle cx="213" cy="167.5" r="2.5"/><circle cx="221" cy="167.5" r="2.5"/><circle cx="229" cy="167.5" r="2.5"/></g>
    <rect x="214" y="208" width="10" height="34" rx="2" fill="#9fd6f2"/>
    <rect x="229" y="196" width="10" height="46" rx="2" fill="url(#li-cyan)"/>
    <rect x="244" y="184" width="10" height="58" rx="2" fill="url(#li-blue)"/>
    <path d="M212 243h48" stroke="#174c8f" stroke-width="1.5"/>
    <circle cx="300" cy="206" r="17" fill="none" stroke="#eaf4fb" stroke-width="7"/>
    <circle cx="300" cy="206" r="17" fill="none" stroke="#00aeef" stroke-width="7" stroke-dasharray="72 107" transform="rotate(-90 300 206)"/>
    <g stroke="#cfe3f2" stroke-width="3" stroke-linecap="round">
        <path d="M326 194h18"/><path d="M326 204h14"/><path d="M326 214h18"/><path d="M280 238h64"/>
    </g>
    <g filter="url(#li-shadow)">
        <circle cx="362" cy="156" r="17" fill="url(#li-cyan)" stroke="#ffffff" stroke-width="3"/>
    </g>
    <path d="M354 156l6 6 10-11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>

    <rect x="222" y="314" width="116" height="24" rx="12" fill="#174c8f"/>
    <text x="280" y="330.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#ffffff" letter-spacing="0.5">SPDMS PLATFORM</text>

    {{-- Work moving along the spokes --}}
    <g fill="#00aeef" stroke="#ffffff" stroke-width="2">
        <circle cx="280" cy="122" r="5.5"/>
        <circle cx="384" cy="189" r="5.5"/>
        <circle cx="410" cy="304" r="5.5"/>
        <circle cx="150" cy="304" r="5.5"/>
        <circle cx="176" cy="189" r="5.5"/>
    </g>

    {{-- Units --}}
    <g font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" text-anchor="middle">
        {{-- Planning Officer (top) --}}
        <g filter="url(#li-shadow)"><circle cx="280" cy="70" r="30" fill="#ffffff" stroke="#cfe3f2"/></g>
        <circle cx="280" cy="70" r="22" fill="url(#li-blue)"/>
        <path transform="translate(268 58)" fill="#ffffff" d="M9 2h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1Zm0 2v2h6V4H9Zm-1 7v2h8v-2H8Zm0 4v2h5v-2H8Z"/>
        <rect x="222" y="10" width="116" height="22" rx="11" fill="#ffffff" stroke="#cfe3f2"/>
        <text x="280" y="25" fill="#174c8f">Planning Officer</text>

        {{-- Management (top right) --}}
        <g filter="url(#li-shadow)"><circle cx="453" cy="155" r="30" fill="#ffffff" stroke="#cfe3f2"/></g>
        <circle cx="453" cy="155" r="22" fill="url(#li-cyan)"/>
        <path transform="translate(441 143)" fill="#ffffff" d="M12 2 2 7v2h20V7L12 2ZM4 11v7h3v-7H4Zm6.5 0v7h3v-7h-3ZM17 11v7h3v-7h-3ZM2 20v2h20v-2H2Z"/>
        <rect x="408" y="193" width="90" height="22" rx="11" fill="#ffffff" stroke="#cfe3f2"/>
        <text x="453" y="208" fill="#174c8f">Management</text>

        {{-- Office / Unit (bottom right) --}}
        <g filter="url(#li-shadow)"><circle cx="453" cy="325" r="30" fill="#ffffff" stroke="#cfe3f2"/></g>
        <circle cx="453" cy="325" r="22" fill="url(#li-blue)"/>
        <path transform="translate(441 313)" fill="#ffffff" d="M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM1 20c0-3.3 3.6-6 8-6s8 2.7 8 6v1H1v-1Zm17.5 1v-1c0-1.8-.7-3.4-1.9-4.6 3 .3 5.4 2.2 5.4 4.6v1h-3.5Z"/>
        <rect x="403" y="363" width="100" height="22" rx="11" fill="#ffffff" stroke="#cfe3f2"/>
        <text x="453" y="378" fill="#174c8f">Office / Unit</text>

        {{-- Administrative Admin (bottom left) --}}
        <g filter="url(#li-shadow)"><circle cx="107" cy="325" r="30" fill="#ffffff" stroke="#cfe3f2"/></g>
        <circle cx="107" cy="325" r="22" fill="url(#li-blue)"/>
        <path transform="translate(95 313)" fill="#ffffff" d="M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM9 12h8v2H9v-2Zm0 4h8v2H9v-2Z"/>
        <rect x="30" y="363" width="154" height="22" rx="11" fill="#ffffff" stroke="#cfe3f2"/>
        <text x="107" y="378" fill="#174c8f">Administrative Admin</text>

        {{-- Technical Admin (top left) --}}
        <g filter="url(#li-shadow)"><circle cx="107" cy="155" r="30" fill="#ffffff" stroke="#cfe3f2"/></g>
        <circle cx="107" cy="155" r="22" fill="url(#li-cyan)"/>
        <path transform="translate(95 143)" fill="#ffffff" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z"/>
        <rect x="50" y="193" width="114" height="22" rx="11" fill="#ffffff" stroke="#cfe3f2"/>
        <text x="107" y="208" fill="#174c8f">Technical Admin</text>
    </g>
</svg>
