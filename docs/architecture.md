```mermaid
flowchart TD
    U[User<br/>(Voice / Text / File)]
    UI[HR Assistant UI<br/>(Next.js)]
    API[API Routes<br/>(Extract / Transliterate)]
    AI[AI Processing<br/>(OpenRouter – GPT-4.1-mini)]
    DATA[Structured HR Data]

    OUT1[Editable Table]
    OUT2[Email Draft]
    OUT3[Short JD]
    OUT4[WhatsApp Text]
    EXP[Export<br/>(CSV / JSON / MD)]

    U --> UI
    UI --> API
    API --> AI
    AI --> DATA

    DATA --> OUT1
    DATA --> OUT2
    DATA --> OUT3
    DATA --> OUT4
    DATA --> EXP
